import { Controller, Delete, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { RawPostsService } from "./raw-posts.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { GetUser } from "../auth/decorators/get-user.decorator";

interface AuthenticatedUser {
  userId: string;
  role: string;
}

@Controller("workspaces/:workspaceId")
export class RawPostsBufferController {
  constructor(private readonly rawPostsService: RawPostsService) {}

  @Get("buffer-posts")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  getBufferPosts(
    @Param("workspaceId") workspaceId: string,
    @Query("days") days?: string,
    @GetUser() user?: AuthenticatedUser,
  ) {
    return this.rawPostsService.findBufferedPosts(workspaceId, days, user);
  }

  @Get("buffer-posts/:bufferPostId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  getBufferPostById(
    @Param("workspaceId") workspaceId: string,
    @Param("bufferPostId") bufferPostId: string,
    @GetUser() user?: AuthenticatedUser,
  ) {
    return this.rawPostsService.findBufferedPostById(workspaceId, bufferPostId, user);
  }

  @Patch("buffer-posts/:bufferPostId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  updateBufferPost(
    @Param("workspaceId") workspaceId: string,
    @Param("bufferPostId") bufferPostId: string,
    @GetUser() user?: AuthenticatedUser,
  ) {
    return this.rawPostsService.updateBufferedPost(workspaceId, bufferPostId, user);
  }

  @Delete("buffer-posts/:bufferPostId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  deleteBufferPost(
    @Param("workspaceId") workspaceId: string,
    @Param("bufferPostId") bufferPostId: string,
    @GetUser() user?: AuthenticatedUser,
  ) {
    return this.rawPostsService.deleteBufferedPost(workspaceId, bufferPostId, user);
  }
}
