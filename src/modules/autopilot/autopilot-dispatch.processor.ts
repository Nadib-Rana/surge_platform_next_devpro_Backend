import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import Redis from "ioredis";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/context/prisma.service";
import { DispatcherService } from "../dispatcher/dispatcher.service";
import { DispatchResult } from "../dispatcher/interfaces/base-dispatcher.interface";
import { EncryptionService } from "../../common/security/encryption.service";
import {
  acquireAutopilotLock,
  releaseAutopilotLock,
} from "./helpers/autopilot-lock.util";
import {
  buildAutopilotDispatchPayload,
  ChannelForDispatch,
  DraftForDispatch,
} from "./helpers/autopilot-payload.builder";
import { processChannelDispatch } from "./helpers/autopilot-channel.helper";

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
    private readonly dispatcher: DispatcherService,
    private readonly encryptionService: EncryptionService,
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

    const { acquired, lockKey, lockValue } = await acquireAutopilotLock(
      this.redis,
      draft.id,
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
        await processChannelDispatch(
          this.prisma,
          this.failedPostsQueue,
          (c, d) => this.publishDraft(c, d),
          channel,
          draft,
          job.id as string,
          attempt,
        );
      }

      return { dispatched: true, draftId: draft.id };
    } finally {
      await releaseAutopilotLock(this.redis, lockKey, lockValue);
    }
  }

  private async publishDraft(
    channel: ChannelForDispatch,
    draft: DraftForDispatch,
  ): Promise<DispatchResult> {
    const payload = buildAutopilotDispatchPayload(
      channel,
      draft,
      this.logger,
      this.encryptionService,
    );
    return this.dispatcher.dispatch(payload);
  }
}
