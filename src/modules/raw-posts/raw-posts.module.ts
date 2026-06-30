import { Module } from "@nestjs/common";
import { RawPostsService } from "./raw-posts.service";
import { RawPostsController } from "./raw-posts.controller";

@Module({
  controllers: [RawPostsController],
  providers: [RawPostsService],
})
export class RawPostsModule {}
