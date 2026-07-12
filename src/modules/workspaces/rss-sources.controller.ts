import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Delete,
  Query,
  Patch,
} from "@nestjs/common";
import { RssSourcesService } from "./rss-sources.service";
import { CreateRssSourceDto } from "./dto/create-rss-source.dto";

@Controller("workspaces/:workspaceId/rss-sources")
export class RssSourcesController {
  constructor(private readonly rssService: RssSourcesService) {}

  @Post()
  create(
    @Param("workspaceId") workspaceId: string,
    @Body() dto: CreateRssSourceDto,
  ) {
    return this.rssService.create(workspaceId, dto);
  }

  @Get()
  list(@Param("workspaceId") workspaceId: string) {
    return this.rssService.list(workspaceId);
  }

  @Get(":sourceId")
  getOne(
    @Param("workspaceId") workspaceId: string,
    @Param("sourceId") sourceId: string,
  ) {
    return this.rssService.getOne(workspaceId, sourceId);
  }

  @Patch(":sourceId")
  update(
    @Param("workspaceId") workspaceId: string,
    @Param("sourceId") sourceId: string,
    @Body() dto: Partial<CreateRssSourceDto>,
  ) {
    return this.rssService.update(workspaceId, sourceId, dto);
  }

  @Delete(":sourceId")
  remove(
    @Param("workspaceId") workspaceId: string,
    @Param("sourceId") sourceId: string,
    @Query("force") force?: string,
  ) {
    const hard = force === "true";
    return this.rssService.remove(workspaceId, sourceId, hard);
  }
}
