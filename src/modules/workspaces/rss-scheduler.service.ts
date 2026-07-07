import { Injectable, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/context/prisma.service";

@Injectable()
export class RssSchedulerService implements OnModuleInit {
  private queue: Queue;
  private redis: Redis;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const redisUrl =
      this.config.get<string>("REDIS_URL") || "redis://127.0.0.1:6379";
    this.redis = new Redis(redisUrl);
    this.queue = new Queue("rss-fetch-queue", {
      connection: this.redis as any,
    });
  }

  async onModuleInit() {
    // On boot, register repeatable jobs for existing active feeds using workspace config
    const feeds = await this.prisma.rssFeed.findMany({
      where: { status: "active" },
    });
    for (const f of feeds) {
      await this.ensureFeedScheduled(f.workspaceId, f.id, f.feedUrl);
    }
  }

  private jobName(workspaceId: string, feedId: string) {
    return `rss:${workspaceId}:${feedId}`;
  }

  private repeatKeyFor(feedId: string) {
    return `rss-feed:${feedId}`;
  }

  async ensureFeedScheduled(
    workspaceId: string,
    feedId: string,
    feedUrl: string,
  ) {
    // read workspace config
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    const freqHours = (ws?.queueConfig as any)?.fetchFrequencyHours ?? 1;
    await this.scheduleRepeatableJob(workspaceId, feedId, feedUrl, freqHours);
  }

  async scheduleFeedJob(workspaceId: string, feedId: string, feedUrl: string) {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    const freqHours = (ws?.queueConfig as any)?.fetchFrequencyHours ?? 1;
    await this.scheduleRepeatableJob(workspaceId, feedId, feedUrl, freqHours);
  }

  private async scheduleRepeatableJob(
    workspaceId: string,
    feedId: string,
    feedUrl: string,
    freqHours: number,
  ) {
    // remove existing
    await this.removeFeedJob(workspaceId, feedId);

    const name = this.jobName(workspaceId, feedId);
    const every = Math.max(1, Number(freqHours)) * 60 * 60 * 1000;

    await this.queue.add(
      name,
      { workspaceId, feedUrl, feedId },
      {
        removeOnComplete: true,
        removeOnFail: false,
        jobId: name,
        repeat: { every },
      },
    );
  }

  async removeFeedJob(workspaceId: string, feedId: string) {
    const name = this.jobName(workspaceId, feedId);
    // get repeatable jobs and remove matching key
    const jobs = await this.queue.getRepeatableJobs();
    for (const j of jobs) {
      if (j.name === name || j.key.includes(feedId)) {
        await this.queue.removeRepeatableByKey(j.key);
      }
    }
  }

  // Called when workspace config changes
  async onWorkspaceConfigChange(workspaceId: string) {
    // find active feeds for workspace and reschedule
    const feeds = await this.prisma.rssFeed.findMany({
      where: { workspaceId, status: "active" },
    });
    for (const f of feeds) {
      await this.ensureFeedScheduled(workspaceId, f.id, f.feedUrl);
    }
  }
}
