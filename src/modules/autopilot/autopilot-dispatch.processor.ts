import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import Redis from "ioredis";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/context/prisma.service";
import { computeBackoffDelayMs } from "./autopilot.utils";

interface AutopilotDispatchJobPayload {
  workspaceId: string;
  triggerSource: string;
  postingTime?: string;
  draftId?: string;
  attempt?: number;
}

@Injectable()
@Processor("autopilot-dispatch-queue")
export class AutopilotDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(AutopilotDispatchProcessor.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue("FailedPostsQueue") private readonly failedPostsQueue: Queue,
  ) {
    super();
    const redisUrl = this.config.get<string>("REDIS_URL") || "redis://127.0.0.1:6379";
    this.redis = new Redis(redisUrl);
  }

  async process(job: Job<AutopilotDispatchJobPayload>, token?: string) {
    const { workspaceId, draftId, attempt = 0 } = job.data;

    this.logger.log(`Processing autopilot job ${job.id} for workspace ${workspaceId}`);

    const draft = await this.prisma.generatedDraft.findFirst({
      where: {
        workspaceId,
        status: { in: ["approved", "scheduled", "auto_dispatch"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!draft) {
      this.logger.warn(`No dispatchable draft found for workspace ${workspaceId}`);
      return { skipped: true, reason: "no-draft" };
    }

    const lockKey = `autopilot-lock:${draft.id}`;
    const lockValue = `${process.pid}:${Date.now()}`;
    const acquired = await this.redis.set(lockKey, lockValue, "PX", 600_000, "NX");

    if (!acquired) {
      this.logger.warn(`Skipping already-processing draft ${draft.id}`);
      return { skipped: true, reason: "lock-busy" };
    }

    try {
      const channels = await this.prisma.publishingChannel.findMany({
        where: { workspaceId, isActive: true },
      });

      for (const channel of channels) {
        const idempotencyKey = `${draft.id}:${channel.id}`;
        let publishLog = await this.prisma.publishedPostsLog.findUnique({ where: { idempotencyKey } });

        if (!publishLog) {
          publishLog = await this.prisma.publishedPostsLog.create({
            data: {
              draftId: draft.id,
              channelId: channel.id,
              idempotencyKey,
              status: "retrying",
              retryCount: attempt,
            },
          });
        } else {
          await this.prisma.publishedPostsLog.update({
            where: { id: publishLog.id },
            data: { status: "retrying", retryCount: attempt },
          });
        }

        try {
          await this.simulatePublish(channel, draft);
          await this.prisma.publishedPostsLog.update({
            where: { id: publishLog.id },
            data: { status: "sent", livePostUrl: `https://example.local/${draft.id}` },
          });
          await this.prisma.generatedDraft.update({
            where: { id: draft.id },
            data: { status: "auto_dispatch" },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown dispatch error";
          await this.prisma.publishedPostsLog.update({
            where: { id: publishLog.id },
            data: { status: "retrying", retryCount: attempt + 1 },
          });

          await this.prisma.failedPostsQueue.create({
            data: {
              logId: publishLog.id,
              bullmqJobId: job.id as string,
              errorMessage: message,
              retryConfig: {
                maxRetries: 3,
                backoffMs: computeBackoffDelayMs(attempt),
              },
            },
          });

          await this.failedPostsQueue.add(
            `retry:${publishLog.id}`,
            { logId: publishLog.id, attempt: attempt + 1 },
            {
              attempts: 3,
              backoff: { type: "exponential", delay: 1000 },
              removeOnComplete: true,
              removeOnFail: false,
            },
          );
        }
      }

      return { dispatched: true, draftId: draft.id };
    } finally {
      await this.redis.del(lockKey);
    }
  }

  private async simulatePublish(channel: { platform: string }, draft: { socialPlainText: string | null }) {
    if (!draft.socialPlainText?.trim()) {
      throw new Error("Draft does not contain publishable content");
    }

    if (channel.platform === "linkedin") {
      return Promise.resolve();
    }

    return Promise.resolve();
  }
}
