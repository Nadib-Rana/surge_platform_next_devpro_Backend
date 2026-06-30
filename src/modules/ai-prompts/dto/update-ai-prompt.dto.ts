import { PartialType } from "@nestjs/swagger";
import { CreateAiPromptDto } from "./create-ai-prompt.dto";

export class UpdateAiPromptDto extends PartialType(CreateAiPromptDto) {}
