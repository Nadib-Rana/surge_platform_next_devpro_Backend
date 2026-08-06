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
import { GetUser } from "../auth/decorators/get-user.decorator";
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
  @ApiOperation({ summary: "List all active tone profiles (customers receive id & name only)" })
  @ApiOkResponse({ description: "List of tone profiles returned successfully" })
  async findAll(@GetUser("role") role: string) {
    const profiles = await this.toneProfilesService.findAll();
    // Customers only get id + name for dropdown selection
    if (role !== "admin") {
      return profiles.map(({ id, name }) => ({ id, name }));
    }
    return profiles;
  }

  @Get(":id")
  @Roles("admin", "customer")
  @ApiOperation({ summary: "Get tone profile details (customers receive id & name only)" })
  @ApiOkResponse({ description: "Tone profile details returned successfully" })
  async findOne(@Param("id") id: string, @GetUser("role") role: string) {
    const profile = await this.toneProfilesService.findOne(id);
    // Customers only get id + name
    if (role !== "admin") {
      return { id: profile.id, name: profile.name };
    }
    return profile;
  }

  @Post()
  @Roles("admin")
  @ApiOperation({ summary: "Create a new tone profile (Admin Only)" })
  @ApiOkResponse({ description: "Tone profile created successfully" })
  create(@Body() createToneProfileDto: CreateToneProfileDto) {
    return this.toneProfilesService.create(createToneProfileDto);
  }

  @Patch(":id")
  @Roles("admin")
  @ApiOperation({ summary: "Update a tone profile (Admin Only)" })
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
