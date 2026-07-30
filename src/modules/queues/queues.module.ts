import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QueuesService } from "./queues.service";
import { QueuesController } from "./queues.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({
      name: "content-generation-queue",
    }),
  ],
  controllers: [QueuesController],
  providers: [QueuesService],
  exports: [QueuesService],
})
export class QueuesModule {}
