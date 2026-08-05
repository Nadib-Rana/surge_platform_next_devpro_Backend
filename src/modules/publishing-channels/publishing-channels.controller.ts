import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from "@nestjs/common";
import { PublishingChannelsService } from "./publishing-channels.service";
import { CreatePublishingChannelDto } from "./dto/create-publishing-channel.dto";
import { UpdatePublishingChannelDto } from "./dto/update-publishing-channel.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin", "customer")
@Controller("publishing-channels")
export class PublishingChannelsController {
  constructor(
    private readonly publishingChannelsService: PublishingChannelsService,
  ) {}

  @Post()
  create(@Body() createPublishingChannelDto: CreatePublishingChannelDto) {
    return this.publishingChannelsService.create(createPublishingChannelDto);
  }

  @Get()
  findAll(@Query("workspaceId") workspaceId?: string) {
    return this.publishingChannelsService.findAll(workspaceId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.publishingChannelsService.findOne(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updatePublishingChannelDto: UpdatePublishingChannelDto,
  ) {
    return this.publishingChannelsService.update(
      id,
      updatePublishingChannelDto,
    );
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.publishingChannelsService.remove(id);
  }
}
