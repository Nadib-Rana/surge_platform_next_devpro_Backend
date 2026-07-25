import { Processor } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { WorkerHost } from "@nestjs/bullmq";
import { PrismaService } from "../../common/context/prisma.service";
import { createUrlHash } from "./utils/url-hash.util";
import { extractAndSanitizeArticleContent } from "./utils/rss-article-extractor.util";
import Parser from "rss-parser";

interface RssJobPayload {
  workspaceId: string;
  feedId: string;
  feedUrl: string;
}

interface ParsedFeedItem {
  title?: string;
  link?: string;
  guid?: string;
  content?: string;
  contentSnippet?: string;
  isoDate?: string;
  pubDate?: string;
}

@Injectable()
@Processor("rss-fetch-queue")
export class RssProcessor extends WorkerHost {
  private readonly logger = new Logger(RssProcessor.name);
  private readonly parser = new Parser({
    customFields: {
      item: ["content", "contentSnippet", "pubDate"],
    },
  });

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<RssJobPayload>, token?: string) {
    const { workspaceId, feedId, feedUrl } = job.data;

    this.logger.log(
      `Processing RSS feed ${feedId} for workspace ${workspaceId}`,
    );

    try {
      const response = await fetch(feedUrl, {
        method: "GET",
        headers: { "User-Agent": "SurgePlatform/1.0 RSS bot" },
      });

      if (!response.ok) {
        this.logger.warn(`RSS feed fetch returned status ${response.status} for ${feedUrl}`);
        return { inserted: 0, skipped: 0, error: response.statusText };
      }

      const xml = await response.text();
      const parsed = await this.parser.parseString(xml);
      const items = (parsed.items ?? []) as ParsedFeedItem[];

      let inserted = 0;
      let skipped = 0;

      for (const item of items) {
        const articleUrl = item.link?.trim() || item.guid?.trim();
        if (!articleUrl) {
          skipped += 1;
          continue;
        }

        const urlHash = createUrlHash(articleUrl);
        const existing = await this.prisma.rawPostsBuffer.findUnique({
          where: { urlHash },
          select: { id: true },
        });

        if (existing) {
          skipped += 1;
          continue;
        }

        const rawBody = [item.content, item.contentSnippet].filter(Boolean).join("\n\n");
        const sanitizedContent = extractAndSanitizeArticleContent(rawBody);

        const publishedAtValue = item.isoDate || item.pubDate;
        const parsedPublishedAt = publishedAtValue ? new Date(publishedAtValue) : new Date();
        const publishedAt = Number.isNaN(parsedPublishedAt.getTime()) ? new Date() : parsedPublishedAt;

        await this.prisma.rawPostsBuffer.create({
          data: {
            workspaceId,
            feedId,
            urlHash,
            title: item.title?.trim() || "Untitled article",
            rawContent: sanitizedContent || item.title?.trim() || "No content",
            publishedAt,
            status: "buffered",
          },
        });
        inserted += 1;
      }

      await this.prisma.rssFeed.update({
        where: { id: feedId },
        data: { lastFetchedAt: new Date() },
      });

      return { inserted, skipped, feedId, workspaceId };
    } catch (err: any) {
      this.logger.error(`Failed to ingest RSS feed ${feedId}: ${err.message}`);
      return { inserted: 0, skipped: 0, error: err.message };
    }
  }
}
