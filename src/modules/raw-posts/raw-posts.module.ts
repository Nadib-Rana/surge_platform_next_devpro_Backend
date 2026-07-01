import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { RawPostsService } from "./raw-posts.service";
import { RawPostsBufferController } from "./raw-posts-buffer.controller";
import { RssProcessor } from "./rss-processor.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "rss-fetch-queue",
    }),
  ],
  controllers: [RawPostsBufferController],
  providers: [RawPostsService, RssProcessor],
  exports: [RawPostsService, RssProcessor],
})
export class RawPostsModule {}
