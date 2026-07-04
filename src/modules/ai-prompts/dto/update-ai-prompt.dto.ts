import { PartialType } from "@nestjs/mapped-types";
import { CreateAiPromptDto } from "./create-ai-prompt.dto";

export class UpdateAiPromptDto extends PartialType(CreateAiPromptDto) {}
