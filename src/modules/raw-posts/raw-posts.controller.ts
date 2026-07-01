import { Controller, Get, Param } from "@nestjs/common";
import { RawPostsService } from "./raw-posts.service";

@Controller("raw-posts")
export class RawPostsController {
  constructor(private readonly rawPostsService: RawPostsService) {}

  @Get()
  findAll() {
    return this.rawPostsService.findBufferedPosts("", "3");
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.rawPostsService.findBufferedPosts(id, "3");
  }
}
