import { Module } from "@nestjs/common";
import { RssFeedsService } from "./rss-feeds.service";
import { RssFeedsController } from "./rss-feeds.controller";

@Module({
  controllers: [RssFeedsController],
  providers: [RssFeedsService],
})
export class RssFeedsModule {}
