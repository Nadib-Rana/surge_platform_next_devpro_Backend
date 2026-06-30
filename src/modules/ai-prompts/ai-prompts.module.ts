import { Module } from "@nestjs/common";
import { AiPromptsService } from "./ai-prompts.service";
import { AiPromptsController } from "./ai-prompts.controller";

@Module({
  controllers: [AiPromptsController],
  providers: [AiPromptsService],
})
export class AiPromptsModule {}
