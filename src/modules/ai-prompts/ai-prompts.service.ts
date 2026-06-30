import { Injectable } from "@nestjs/common";
import { CreateAiPromptDto } from "./dto/create-ai-prompt.dto";
import { UpdateAiPromptDto } from "./dto/update-ai-prompt.dto";

@Injectable()
export class AiPromptsService {
  create(createAiPromptDto: CreateAiPromptDto) {
    return "This action adds a new aiPrompt";
  }

  findAll() {
    return `This action returns all aiPrompts`;
  }

  findOne(id: number) {
    return `This action returns a #${id} aiPrompt`;
  }

  update(id: number, updateAiPromptDto: UpdateAiPromptDto) {
    return `This action updates a #${id} aiPrompt`;
  }

  remove(id: number) {
    return `This action removes a #${id} aiPrompt`;
  }
}
