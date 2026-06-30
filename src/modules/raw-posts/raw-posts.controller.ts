import { Controller, Get, Post, Body, Patch, Param, Delete } from "@nestjs/common";
import { RawPostsService } from "./raw-posts.service";
import { CreateRawPostDto } from "./dto/create-raw-post.dto";
import { UpdateRawPostDto } from "./dto/update-raw-post.dto";

@Controller("raw-posts")
export class RawPostsController {
  constructor(private readonly rawPostsService: RawPostsService) {}

  @Post()
  create(@Body() createRawPostDto: CreateRawPostDto) {
    return this.rawPostsService.create(createRawPostDto);
  }

  @Get()
  findAll() {
    return this.rawPostsService.findAll();
  }

  @Get(":id")
  findOne(@Param('id') id: string) {
    return this.rawPostsService.findOne(+id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateRawPostDto: UpdateRawPostDto) {
    return this.rawPostsService.update(+id, updateRawPostDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.rawPostsService.remove(+id);
  }
}
