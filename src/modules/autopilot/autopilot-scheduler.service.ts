import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { PrismaService } from "../../common/context/prisma.service";
import { buildDailyCronExpression } from "./autopilot.utils";

interface WorkspaceQueueConfig {
  postingTimes?: string[];
}

@Injectable()
export class AutopilotSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AutopilotSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue("autopilot-dispatch-queue")
    private readonly dispatchQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.syncSchedulesFromWorkspaces();
  }

  async syncSchedulesFromWorkspaces() {
    const workspaces = await this.prisma.workspace.findMany();

    for (const workspace of workspaces) {
      await this.syncWorkspaceSchedules(
        workspace.id,
        workspace.queueConfig as WorkspaceQueueConfig | null,
      );
    }
  }

  async syncWorkspaceSchedules(
    workspaceId: string,
    queueConfig: WorkspaceQueueConfig | null | undefined,
  ) {
    const postingTimes = queueConfig?.postingTimes ?? [];

    await this.removeWorkspaceJobs(workspaceId);

    for (const [index, postingTime] of postingTimes.entries()) {
      if (!postingTime?.trim()) continue;

      const cronExpression = buildDailyCronExpression(postingTime);
      const jobName = `autopilot:${workspaceId}:${index}`;

      await this.dispatchQueue.add(
        jobName,
        {
          workspaceId,
          triggerSource: "scheduled",
          postingTime,
        },
        {
          jobId: `${jobName}:${cronExpression}`,
          removeOnComplete: true,
          removeOnFail: false,
          repeat: {
            pattern: cronExpression,
            tz: this.config.get<string>("WORKSPACE_TIMEZONE") || "UTC",
          },
        },
      );
    }

    this.logger.log(
      `Synced ${postingTimes.length} autopilot schedules for workspace ${workspaceId}`,
    );
  }

  private async removeWorkspaceJobs(workspaceId: string) {
    const repeatableJobs = await this.dispatchQueue.getRepeatableJobs();

    for (const repeatableJob of repeatableJobs) {
      if (repeatableJob.name.startsWith(`autopilot:${workspaceId}:`)) {
        await this.dispatchQueue.removeRepeatableByKey(repeatableJob.key);
      }
    }
  }
}
