import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete
} from "@nestjs/common";
import { RssFeedsService } from "./rss-feeds.service";
import { CreateRssFeedDto } from "./dto/create-rss-feed.dto";
import { UpdateRssFeedDto } from "./dto/update-rss-feed.dto";

@Controller("rss-feeds")
export class RssFeedsController {
  constructor(private readonly rssFeedsService: RssFeedsService) {}

  @Post()
  create(@Body() createRssFeedDto: CreateRssFeedDto) {
    return this.rssFeedsService.create(createRssFeedDto);
  }

  @Get()
  findAll() {
    return this.rssFeedsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.rssFeedsService.findOne(+id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateRssFeedDto: UpdateRssFeedDto) {
    return this.rssFeedsService.update(+id, updateRssFeedDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.rssFeedsService.remove(+id);
  }
}
