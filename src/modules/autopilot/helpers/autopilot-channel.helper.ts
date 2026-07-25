import { Queue } from "bullmq";
import { PrismaService } from "../../../common/context/prisma.service";
import { computeBackoffDelayMs } from "../autopilot.utils";

export async function processChannelDispatch(
  prisma: PrismaService,
  failedPostsQueue: Queue,
  publishDraftFn: (channel: any, draft: any) => Promise<any>,
  channel: any,
  draft: any,
  jobId: string,
  attempt: number,
) {
  const idempotencyKey = `${draft.id}:${channel.id}`;
  let publishLog = await prisma.publishedPostsLog.findUnique({
    where: { idempotencyKey },
  });

  if (!publishLog) {
    publishLog = await prisma.publishedPostsLog.create({
      data: {
        draftId: draft.id,
        channelId: channel.id,
        idempotencyKey,
        status: "retrying",
        retryCount: attempt,
      },
    });
  } else {
    await prisma.publishedPostsLog.update({
      where: { id: publishLog.id },
      data: { status: "retrying", retryCount: attempt },
    });
  }

  try {
    const dispatchResult = await publishDraftFn(channel, draft);

    if (!dispatchResult.success) {
      throw new Error(
        dispatchResult.error ||
          `Dispatcher returned an unsuccessful result for ${channel.platform}`,
      );
    }

    await prisma.publishedPostsLog.update({
      where: { id: publishLog.id },
      data: {
        status: "sent",
        livePostUrl:
          dispatchResult.url ?? `https://example.local/${draft.id}`,
      },
    });
    await prisma.generatedDraft.update({
      where: { id: draft.id },
      data: { status: "auto_dispatch" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown dispatch error";
    await prisma.publishedPostsLog.update({
      where: { id: publishLog.id },
      data: { status: "retrying", retryCount: attempt + 1 },
    });

    await prisma.failedPostsQueue.create({
      data: {
        logId: publishLog.id,
        bullmqJobId: jobId,
        errorMessage: message,
        retryConfig: {
          maxRetries: 3,
          backoffMs: computeBackoffDelayMs(attempt),
        },
      },
    });

    await failedPostsQueue.add(
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
