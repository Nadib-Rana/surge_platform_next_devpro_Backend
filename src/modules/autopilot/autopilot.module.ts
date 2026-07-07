import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AutopilotSchedulerService } from "./autopilot-scheduler.service";
import { AutopilotDispatchProcessor } from "./autopilot-dispatch.processor";
import { FailedPostsRetryProcessor } from "./autopilot-retry.processor";

@Module({
  imports: [
    BullModule.registerQueue({ name: "autopilot-dispatch-queue" }),
    BullModule.registerQueue({ name: "FailedPostsQueue" }),
  ],
  providers: [
    AutopilotSchedulerService,
    AutopilotDispatchProcessor,
    FailedPostsRetryProcessor,
  ],
  exports: [AutopilotSchedulerService],
})
export class AutopilotModule {}
