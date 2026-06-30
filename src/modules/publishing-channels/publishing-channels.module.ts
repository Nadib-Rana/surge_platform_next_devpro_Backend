import { Module } from "@nestjs/common";
import { PublishingChannelsService } from "./publishing-channels.service";
import { PublishingChannelsController } from "./publishing-channels.controller";

@Module({
  controllers: [PublishingChannelsController],
  providers: [PublishingChannelsService],
})
export class PublishingChannelsModule {}
