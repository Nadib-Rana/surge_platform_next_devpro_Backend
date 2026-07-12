import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { GeneratedDraftsService } from "./generated-drafts.service";
import { GeneratedDraftsController } from "./generated-drafts.controller";
import { DispatcherModule } from "../dispatcher/dispatcher.module";

@Module({
  imports: [
    DispatcherModule,
    BullModule.registerQueue({ name: "autopilot-dispatch-queue" }),
  ],
  controllers: [GeneratedDraftsController],
  providers: [GeneratedDraftsService],
  exports: [GeneratedDraftsService],
})
export class GeneratedDraftsModule {}
