import { Controller, Get, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { checkOpenAi } from "./common/services/health/openai-health.checker";
import { checkAnthropic } from "./common/services/health/anthropic-health.checker";
import { checkIdeogram } from "./common/services/health/ideogram-health.checker";
import { checkStripe } from "./common/services/health/stripe-health.checker";
import { checkMinioConfig } from "./common/services/health/minio-health.checker";
import { PrismaService } from "./common/context/prisma.service";
import Parser from "rss-parser";
import { createUrlHash } from "./modules/raw-posts/utils/url-hash.util";
import { extractAndSanitizeArticleContent } from "./modules/raw-posts/utils/rss-article-extractor.util";

@Controller("api-test")
export class ApiTestController {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("credentials")
  async checkCredentials() {
    const report = {
      timestamp: new Date().toISOString(),
      services: {
        openai: await checkOpenAi(this.configService),
        anthropic: await checkAnthropic(this.configService),
        ideogram: await checkIdeogram(this.configService),
        stripe: await checkStripe(this.configService),
        minio: await checkMinioConfig(this.configService),
      },
    };

    const summary = {
      totalServices: Object.keys(report.services).length,
      healthyServices: Object.values(report.services).filter((s) => s.valid)
        .length,
      unhealthyServices: Object.values(report.services).filter((s) => !s.valid)
        .length,
      allHealthy: Object.values(report.services).every((s) => s.valid),
    };

    return { summary, ...report };
  }

  @Get("rss-test")
  async testRss(@Query("feedUrl") customFeedUrl?: string) {
    // 1. Get or create a dummy company & workspace
    let company = await this.prisma.company.findFirst();
    if (!company) {
      let user = await this.prisma.user.findFirst();
      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email: "test-rss@example.com",
            password: "secret123",
            fullName: "RSS Tester",
            role: "customer",
            isVerified: true,
          }
        });
      }
      company = await this.prisma.company.create({
        data: {
          name: "Test Company",
          status: "active",
          ownerId: user.id,
        }
      });
    }

    let workspace = await this.prisma.workspace.findFirst({
      where: { companyId: company.id }
    });
    if (!workspace) {
      workspace = await this.prisma.workspace.create({
        data: {
          name: "Test Workspace",
          companyId: company.id,
          timezone: "UTC",
        }
      });
    }

    const feedUrl = customFeedUrl || "https://news.ycombinator.com/rss";
    let feed = await this.prisma.rssFeed.findFirst({
      where: { workspaceId: workspace.id, feedUrl }
    });
    if (!feed) {
      feed = await this.prisma.rssFeed.create({
        data: {
          workspaceId: workspace.id,
          feedUrl,
          status: "active",
        }
      });
    }

    const parser = new Parser({
      customFields: {
        item: ["content", "contentSnippet", "pubDate"],
      },
    });

    const response = await fetch(feed.feedUrl, {
      method: "GET",
      headers: { "User-Agent": "SurgePlatform/1.0 RSS bot" },
    });

    if (!response.ok) {
      return { success: false, error: `Fetch failed with status ${response.status}` };
    }

    const xml = await response.text();
    const parsed = await parser.parseString(xml);
    
    let inserted = 0;
    let skipped = 0;
    const sampleItems: any[] = [];

    for (const item of (parsed.items ?? []).slice(0, 5)) {
      const articleUrl = item.link?.trim() || item.guid?.trim();
      if (!articleUrl) {
        skipped++;
        continue;
      }

      const urlHash = createUrlHash(articleUrl);
      const existing = await this.prisma.rawPostsBuffer.findUnique({
        where: { urlHash }
      });

      if (existing) {
        skipped++;
        continue;
      }

      const rawBody = [item.content, item.contentSnippet].filter(Boolean).join("\n\n");
      const sanitizedContent = extractAndSanitizeArticleContent(rawBody);
      const publishedAt = item.isoDate ? new Date(item.isoDate) : new Date();

      const created = await this.prisma.rawPostsBuffer.create({
        data: {
          workspaceId: workspace.id,
          feedId: feed.id,
          urlHash,
          title: item.title?.trim() || "Untitled article",
          rawContent: sanitizedContent || item.title?.trim() || "No content",
          publishedAt,
          status: "buffered",
        }
      });
      sampleItems.push(created);
      inserted++;
    }

    return {
      success: true,
      workspaceId: workspace.id,
      feedId: feed.id,
      feedUrl: feed.feedUrl,
      itemsFound: parsed.items?.length || 0,
      parsedItems: (parsed.items ?? []).slice(0, 5).map(item => ({
        title: item.title,
        link: item.link,
        guid: item.guid,
      })),
      insertedCount: inserted,
      skippedCount: skipped,
      insertedSample: sampleItems,
    };
  }
}