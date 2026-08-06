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
import { GetUser } from "../auth/decorators/get-user.decorator";

interface AuthenticatedUser {
  userId: string;
  role: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin", "customer")
@Controller("publishing-channels")
export class PublishingChannelsController {
  constructor(
    private readonly publishingChannelsService: PublishingChannelsService,
  ) {}

  @Post()
  create(
    @Body() createPublishingChannelDto: CreatePublishingChannelDto,
    @GetUser() user: AuthenticatedUser,
  ) {
    return this.publishingChannelsService.create(
      createPublishingChannelDto,
      user,
    );
  }

  @Get()
  findAll(
    @Query("workspaceId") workspaceId: string,
    @GetUser() user: AuthenticatedUser,
  ) {
    return this.publishingChannelsService.findAll(workspaceId, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @GetUser() user: AuthenticatedUser) {
    return this.publishingChannelsService.findOne(id, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updatePublishingChannelDto: UpdatePublishingChannelDto,
    @GetUser() user: AuthenticatedUser,
  ) {
    return this.publishingChannelsService.update(
      id,
      updatePublishingChannelDto,
      user,
    );
  }

  @Delete(":id")
  remove(@Param("id") id: string, @GetUser() user: AuthenticatedUser) {
    return this.publishingChannelsService.remove(id, user);
  }
}
