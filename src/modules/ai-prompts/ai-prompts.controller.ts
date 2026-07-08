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
import { AiPromptsService } from "./ai-prompts.service";
import { CreateAiPromptDto } from "./dto/create-ai-prompt.dto";
import { GenerateBatchDigestDto } from "./dto/generate-batch-digest.dto";
import { UpdateAiPromptDto } from "./dto/update-ai-prompt.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

interface AuthenticatedUser {
  userId: string;
  role: string;
}

@Controller("ai-prompts")
export class AiPromptsController {
  constructor(private readonly aiPromptsService: AiPromptsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() createAiPromptDto: CreateAiPromptDto,
    @GetUser() user: AuthenticatedUser,
  ) {
    return this.aiPromptsService.create(createAiPromptDto, user);
  }

  @Post("batch-digest")
  generateBatchDigest(@Body() dto: GenerateBatchDigestDto) {
    return this.aiPromptsService.generateBatchDigest(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("global")
  findGlobalPrompts() {
    return this.aiPromptsService.findGlobalPrompts();
  }

  @UseGuards(JwtAuthGuard)
  @Get("workspace")
  findWorkspacePrompts(@GetUser() user: AuthenticatedUser) {
    return this.aiPromptsService.findWorkspacePrompts(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Patch("global/:id")
  updateGlobalPrompt(
    @Param("id") id: string,
    @Body() updateAiPromptDto: UpdateAiPromptDto,
  ) {
    return this.aiPromptsService.updateGlobalPrompt(id, updateAiPromptDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("workspace/:id")
  updateWorkspacePrompt(
    @Param("id") id: string,
    @Body() updateAiPromptDto: UpdateAiPromptDto,
    @GetUser() user: AuthenticatedUser,
  ) {
    return this.aiPromptsService.updateWorkspacePrompt(
      id,
      updateAiPromptDto,
      user,
    );
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.aiPromptsService.remove(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  findOne(@Param("id") id: string, @GetUser() user: AuthenticatedUser) {
    return this.aiPromptsService.findOne(id, user);
  }
}
