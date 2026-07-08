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

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateAiPromptDto: UpdateAiPromptDto,
  ) {
    return this.aiPromptsService.update(id, updateAiPromptDto);
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
