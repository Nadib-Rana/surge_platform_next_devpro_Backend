import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from "@nestjs/common";
import { ToneProfilesService } from "./tone-profiles.service";
import { CreateToneProfileDto, UpdateToneProfileDto } from "./dto/tone-profile.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

@ApiTags("Tone Profiles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("tone-profiles")
export class ToneProfilesController {
  constructor(private readonly toneProfilesService: ToneProfilesService) {}

  @Get()
  @Roles("admin", "customer")
  @ApiOperation({ summary: "List all active tone profiles" })
  @ApiOkResponse({ description: "List of tone profiles returned successfully" })
  findAll() {
    return this.toneProfilesService.findAll();
  }

  @Get(":id")
  @Roles("admin", "customer")
  @ApiOperation({ summary: "Get tone profile details by id" })
  @ApiOkResponse({ description: "Tone profile details returned successfully" })
  findOne(@Param("id") id: string) {
    return this.toneProfilesService.findOne(id);
  }

  @Post()
  @Roles("admin")
  @ApiOperation({ summary: "Create a new tone profile with prompts (Admin Only)" })
  @ApiOkResponse({ description: "Tone profile created successfully" })
  create(@Body() createToneProfileDto: CreateToneProfileDto) {
    return this.toneProfilesService.create(createToneProfileDto);
  }

  @Patch(":id")
  @Roles("admin")
  @ApiOperation({ summary: "Update a tone profile and its prompts (Admin Only)" })
  @ApiOkResponse({ description: "Tone profile updated successfully" })
  update(
    @Param("id") id: string,
    @Body() updateToneProfileDto: UpdateToneProfileDto,
  ) {
    return this.toneProfilesService.update(id, updateToneProfileDto);
  }

  @Delete(":id")
  @Roles("admin")
  @ApiOperation({ summary: "Delete a tone profile (Admin Only)" })
  @ApiOkResponse({ description: "Tone profile deleted successfully" })
  remove(@Param("id") id: string) {
    return this.toneProfilesService.remove(id);
  }
}
