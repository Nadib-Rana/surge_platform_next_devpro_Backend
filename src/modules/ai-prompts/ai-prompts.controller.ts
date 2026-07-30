import { Controller, Post, Body } from "@nestjs/common";
import { AiPromptsService } from "./ai-prompts.service";
import { GenerateBatchDigestDto } from "./dto/generate-batch-digest.dto";

@Controller("ai-prompts")
export class AiPromptsController {
  constructor(private readonly aiPromptsService: AiPromptsService) {}

  @Post("batch-digest")
  generateBatchDigest(@Body() dto: GenerateBatchDigestDto) {
    return this.aiPromptsService.generateBatchDigest(dto);
  }
}
