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
import { GeneratedDraftsService } from "./generated-drafts.service";
import { CreateGeneratedDraftDto } from "./dto/create-generated-draft.dto";
import { UpdateGeneratedDraftDto } from "./dto/update-generated-draft.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { GeneratedDraftQueryDto } from "./dto/generated-draft-query.dto";
import { PublishGeneratedDraftDto } from "./dto/publish-generated-draft.dto";
import { ScheduleGeneratedDraftDto } from "./dto/schedule-generated-draft.dto";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

interface AuthenticatedUser {
  userId: string;
  role: string;
}

@ApiTags("Generated Drafts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("generated-drafts")
export class GeneratedDraftsController {
  constructor(
    private readonly generatedDraftsService: GeneratedDraftsService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a manual generated draft" })
  @ApiOkResponse({ description: "Draft created" })
  create(
    @Body() createGeneratedDraftDto: CreateGeneratedDraftDto,
    @GetUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.generatedDraftsService.create(createGeneratedDraftDto, user);
  }

  @Get()
  @ApiOperation({ summary: "List generated drafts" })
  findAll(
    @Query() query: GeneratedDraftQueryDto,
    @GetUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.generatedDraftsService.findAll(query, user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get generated draft details" })
  findOne(
    @Param("id") id: string,
    @GetUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.generatedDraftsService.findOne(id, user);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update generated draft content or status" })
  update(
    @Param("id") id: string,
    @Body() updateGeneratedDraftDto: UpdateGeneratedDraftDto,
    @GetUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.generatedDraftsService.update(
      id,
      updateGeneratedDraftDto,
      user,
    );
  }

  @Delete(":id")
  @ApiOperation({ summary: "Soft delete a generated draft" })
  remove(
    @Param("id") id: string,
    @GetUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.generatedDraftsService.remove(id, user);
  }

  @Post(":id/publish")
  @ApiOperation({ summary: "Publish a draft immediately" })
  @ApiBody({ type: PublishGeneratedDraftDto })
  publish(
    @Param("id") id: string,
    @Body() publishGeneratedDraftDto: PublishGeneratedDraftDto,
    @GetUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.generatedDraftsService.publish(
      id,
      user,
      publishGeneratedDraftDto,
    );
  }

  @Post(":id/schedule")
  @ApiOperation({ summary: "Schedule a draft for later publishing" })
  @ApiBody({ type: ScheduleGeneratedDraftDto })
  schedule(
    @Param("id") id: string,
    @Body() scheduleGeneratedDraftDto: ScheduleGeneratedDraftDto,
    @GetUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.generatedDraftsService.schedule(
      id,
      user,
      scheduleGeneratedDraftDto,
    );
  }
}
