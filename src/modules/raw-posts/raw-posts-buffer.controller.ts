import { Controller, Get, Param, Query } from "@nestjs/common";
import { RawPostsService } from "./raw-posts.service";

@Controller("workspaces/:workspaceId")
export class RawPostsBufferController {
  constructor(private readonly rawPostsService: RawPostsService) {}

  @Get("buffer-posts")
  getBufferPosts(
    @Param("workspaceId") workspaceId: string,
    @Query("days") days?: string,
  ) {
    return this.rawPostsService.findBufferedPosts(workspaceId, days);
  }
}
