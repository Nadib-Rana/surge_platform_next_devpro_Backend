import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import Redis from "ioredis";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/context/prisma.service";
import { computeBackoffDelayMs } from "./autopilot.utils";
import { DispatcherService } from "../dispatcher/dispatcher.service";
import {
  DispatchPayload,
  DispatchResult,
} from "../dispatcher/interfaces/base-dispatcher.interface";

interface AutopilotDispatchJobPayload {
  workspaceId: string;
  triggerSource: string;
  postingTime?: string;
  draftId?: string;
  attempt?: number;
}

interface DraftForDispatch {
  id: string;
  workspaceId: string;
  wordpressHtmlContent: string | null;
  socialPlainText: string | null;
  imageUrl: string | null;
  imageProvider: string | null;
}

interface ChannelForDispatch {
  id: string;
  workspaceId: string;
  platform: string;
  encryptedCredentials: string;
}

@Injectable()
@Processor("autopilot-dispatch-queue")
export class AutopilotDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(AutopilotDispatchProcessor.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly dispatcher: DispatcherService,
    @InjectQueue("FailedPostsQueue") private readonly failedPostsQueue: Queue,
  ) {
    super();
    const redisUrl =
      this.config.get<string>("REDIS_URL") || "redis://127.0.0.1:6379";
    this.redis = new Redis(redisUrl);
  }

  async process(job: Job<AutopilotDispatchJobPayload>) {
    const { workspaceId, draftId, attempt = 0 } = job.data;

    this.logger.log(
      `Processing autopilot job ${job.id} for workspace ${workspaceId}`,
    );

    const draft = await this.prisma.generatedDraft.findFirst({
      where: {
        workspaceId,
        ...(draftId ? { id: draftId } : {}),
        status: { in: ["approved", "scheduled", "auto_dispatch"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!draft) {
      this.logger.warn(
        draftId
          ? `No dispatchable draft ${draftId} found for workspace ${workspaceId}`
          : `No dispatchable draft found for workspace ${workspaceId}`,
      );
      return { skipped: true, reason: "no-draft" };
    }

    const lockKey = `autopilot-lock:${draft.id}`;
    const lockValue = `${process.pid}:${Date.now()}`;
    const acquired = await this.redis.set(
      lockKey,
      lockValue,
      "PX",
      600_000,
      "NX",
    );

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
        let publishLog = await this.prisma.publishedPostsLog.findUnique({
          where: { idempotencyKey },
        });

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
          const dispatchResult = await this.publishDraft(channel, draft);

          if (!dispatchResult.success) {
            throw new Error(
              dispatchResult.error ||
                `Dispatcher returned an unsuccessful result for ${channel.platform}`,
            );
          }

          await this.prisma.publishedPostsLog.update({
            where: { id: publishLog.id },
            data: {
              status: "sent",
              livePostUrl:
                dispatchResult.url ?? `https://example.local/${draft.id}`,
            },
          });
          await this.prisma.generatedDraft.update({
            where: { id: draft.id },
            data: { status: "auto_dispatch" },
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown dispatch error";
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
      await this.releaseLock(lockKey, lockValue);
    }
  }

  private async publishDraft(
    channel: ChannelForDispatch,
    draft: DraftForDispatch,
  ): Promise<DispatchResult> {
    const payload = this.buildDispatchPayload(channel, draft);
    return this.dispatcher.dispatch(payload);
  }

  private buildDispatchPayload(
    channel: ChannelForDispatch,
    draft: DraftForDispatch,
  ): DispatchPayload {
    const content = this.resolveContentForChannel(channel.platform, draft);
    if (!content) {
      throw new Error("Draft does not contain publishable content");
    }

    const imageUrl = draft.imageUrl?.trim();
    const images = imageUrl ? [imageUrl] : undefined;

    return {
      channel: channel.platform,
      title: "Surge Autopilot Digest",
      content,
      images,
      credentials: this.parseChannelCredentials(channel),
      metadata: {
        draftId: draft.id,
        workspaceId: draft.workspaceId,
        imageProvider: draft.imageProvider ?? undefined,
        hasGeneratedAsset: Boolean(imageUrl),
      },
    };
  }

  private resolveContentForChannel(
    platform: string,
    draft: DraftForDispatch,
  ): string {
    const isWordPress = platform.toLowerCase() === "wordpress";
    const content = isWordPress
      ? draft.wordpressHtmlContent || draft.socialPlainText
      : draft.socialPlainText || this.stripHtml(draft.wordpressHtmlContent);

    return content?.trim() ?? "";
  }

  private parseChannelCredentials(
    channel: ChannelForDispatch,
  ): Record<string, any> {
    try {
      const parsed = JSON.parse(channel.encryptedCredentials) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, any>;
      }
    } catch {
      this.logger.warn(
        `Publishing channel ${channel.id} credentials are not plain JSON; dispatcher will fail closed until credential decryption is wired.`,
      );
    }

    return {};
  }

  private stripHtml(content: string | null): string {
    return (
      content
        ?.replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim() ?? ""
    );
  }

  private async releaseLock(lockKey: string, lockValue: string) {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      end
      return 0
    `;

    await this.redis.eval(script, 1, lockKey, lockValue);
  }
}
