import { Queue } from "bullmq";

const MANUAL_SCHEDULE_QUEUE_PREFIX = "manual-schedule";

export async function removeExistingManualScheduleJobs(
  dispatchQueue: Queue,
  draftId: string,
) {
  const jobs = await dispatchQueue.getJobs([
    "delayed",
    "waiting",
    "active",
    "paused",
  ]);

  await Promise.all(
    jobs
      .filter(
        (job) => job.name === `${MANUAL_SCHEDULE_QUEUE_PREFIX}:${draftId}`,
      )
      .map((job) => job.remove()),
  );
}

export function getManualScheduleJobName(draftId: string) {
  return `${MANUAL_SCHEDULE_QUEUE_PREFIX}:${draftId}`;
}

export function getManualScheduleJobId(draftId: string, scheduledAt: Date) {
  return `${MANUAL_SCHEDULE_QUEUE_PREFIX}:${draftId}:${scheduledAt.toISOString()}`;
}
