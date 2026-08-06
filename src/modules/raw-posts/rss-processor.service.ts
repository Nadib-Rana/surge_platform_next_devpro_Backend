import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/context/prisma.service";
import { createUrlHash } from "./utils/url-hash.util";
import { extractAndSanitizeArticleContent } from "./utils/rss-article-extractor.util";
import Parser from "rss-parser";
import { validateUrlForSsrf } from "../../common/helpers/ssrf-protection.util";

interface RssJobPayload {
  workspaceId: string;
  feedId: string;
  feedUrl: string;
}

interface ParsedFeedItem {
  title?: string;
  link?: any;
  guid?: any;
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
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    timeout: 15000,
  });

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<RssJobPayload>, token?: string) {
    const { workspaceId, feedId, feedUrl } = job.data;

    this.logger.log(
      `Processing RSS feed ${feedId} for workspace ${workspaceId}`,
    );

    // Validate workspace exists to prevent foreign key constraint failures
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!workspace) {
      this.logger.warn(
        `Workspace ${workspaceId} does not exist in database. Deactivating orphan RSS feed ${feedId}.`,
      );
      await this.prisma.rssFeed.update({
        where: { id: feedId },
        data: { status: "inactive" },
      }).catch(() => null);
      return { inserted: 0, skipped: 0, error: `Workspace ${workspaceId} not found` };
    }

    try {
      validateUrlForSsrf(feedUrl);
      let items: ParsedFeedItem[] = [];

      // 1. Primary approach: fetch with custom headers and timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(feedUrl, {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            Accept: "application/rss+xml, application/xml, text/xml, */*",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const xml = await response.text();
          const parsed = await this.parser.parseString(xml);
          items = (parsed.items ?? []) as ParsedFeedItem[];
        } else {
          this.logger.warn(
            `Direct fetch returned HTTP ${response.status} for ${feedUrl}. Retrying with rss-parser.parseURL...`,
          );
          const parsed = await this.parser.parseURL(feedUrl);
          items = (parsed.items ?? []) as ParsedFeedItem[];
        }
      } catch (fetchErr: any) {
        this.logger.warn(
          `Direct fetch failed for ${feedUrl} (${fetchErr.message}). Retrying with rss-parser.parseURL...`,
        );
        const parsed = await this.parser.parseURL(feedUrl);
        items = (parsed.items ?? []) as ParsedFeedItem[];
      }

      let inserted = 0;
      let skipped = 0;

      for (const item of items) {
        const rawLink = typeof item.link === "string" ? item.link : (item.link as any)?.$;
        const rawGuid = typeof item.guid === "string" ? item.guid : (item.guid as any)?.$;
        const articleUrl = (rawLink || rawGuid || "").trim();

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

      this.logger.log(
        `Successfully ingested RSS feed ${feedId}: ${inserted} inserted, ${skipped} skipped.`,
      );

      return { inserted, skipped, feedId, workspaceId };
    } catch (err: any) {
      this.logger.error(`Failed to ingest RSS feed ${feedId}: ${err.message}`);
      return { inserted: 0, skipped: 0, error: err.message };
    }
  }
}
