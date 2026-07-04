import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from "@nestjs/common";
import { AiPromptsService } from "./ai-prompts.service";
import { CreateAiPromptDto } from "./dto/create-ai-prompt.dto";
import { GenerateBatchDigestDto } from "./dto/generate-batch-digest.dto";
import { UpdateAiPromptDto } from "./dto/update-ai-prompt.dto";

@Controller("ai-prompts")
export class AiPromptsController {
  constructor(private readonly aiPromptsService: AiPromptsService) {}

  @Post()
  create(@Body() createAiPromptDto: CreateAiPromptDto) {
    return this.aiPromptsService.create(createAiPromptDto);
  }

  @Post("batch-digest")
  generateBatchDigest(@Body() dto: GenerateBatchDigestDto) {
    return this.aiPromptsService.generateBatchDigest(dto);
  }

  @Get()
  findAll() {
    return this.aiPromptsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.aiPromptsService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateAiPromptDto: UpdateAiPromptDto) {
    return this.aiPromptsService.update(id, updateAiPromptDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.aiPromptsService.remove(id);
  }
}
