import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PrismaService } from "../../common/context/prisma.service";
import { computeBackoffDelayMs } from "./autopilot.utils";

interface FailedPostRetryPayload {
  logId: string;
  attempt: number;
}

@Injectable()
@Processor("failed-posts-queue")
export class FailedPostsRetryProcessor extends WorkerHost {
  private readonly logger = new Logger(FailedPostsRetryProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<FailedPostRetryPayload>) {
    const { logId } = job.data;
    const publishLog = await this.prisma.publishedPostsLog.findUnique({
      where: { id: logId },
    });

    if (!publishLog) {
      return { skipped: true, reason: "not-found" };
    }

    if (publishLog.status === "sent") {
      return { skipped: true, reason: "already-sent" };
    }

    const attemptNumber = job.attemptsMade + 1;
    const delayMs = computeBackoffDelayMs(attemptNumber);
    this.logger.warn(
      `Retrying failed publish ${logId} on attempt ${attemptNumber} with ${delayMs}ms delay`,
    );

    if (attemptNumber >= 3) {
      await this.prisma.publishedPostsLog.update({
        where: { id: logId },
        data: { status: "failed" },
      });
      return { failed: true, reason: "max-retries-exhausted" };
    }

    await this.prisma.publishedPostsLog.update({
      where: { id: logId },
      data: { status: "retrying", retryCount: attemptNumber },
    });

    throw new Error(`Retry attempt ${attemptNumber} failed for ${logId}`);
  }
}
