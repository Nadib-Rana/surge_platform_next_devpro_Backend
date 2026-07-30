import { Injectable, NotFoundException } from "@nestjs/common";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";

@Injectable()
export class QueuesService {
  constructor(
    @InjectQueue("content-generation-queue")
    private readonly contentGenerationQueue: Queue,
  ) {}

  async getStats() {
    const counts = await this.contentGenerationQueue.getJobCounts();
    return {
      "content-generation-queue": counts,
    };
  }

  async getFailedJobs() {
    const jobs = await this.contentGenerationQueue.getFailed();
    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      processedOn: job.processedOn ? new Date(job.processedOn) : null,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
    }));
  }

  async retryJob(jobId: string) {
    const job = await this.contentGenerationQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found in content-generation-queue`);
    }

    const state = await job.getState();
    if (state !== "failed") {
      throw new Error(`Job ${jobId} is not in a failed state. Current state is: ${state}`);
    }

    await job.retry();
    return { message: `Job ${jobId} retried successfully` };
  }

  async cleanHistory() {
    // Clean completed jobs older than 0ms (all)
    await this.contentGenerationQueue.clean(0, 1000, "completed");
    // Clean failed jobs older than 0ms (all)
    await this.contentGenerationQueue.clean(0, 1000, "failed");
    return { message: "Queue history cleaned successfully" };
  }
}
