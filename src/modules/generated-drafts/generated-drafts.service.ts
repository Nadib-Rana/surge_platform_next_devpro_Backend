import { Injectable } from "@nestjs/common";
import { CreateGeneratedDraftDto } from "./dto/create-generated-draft.dto";
import { UpdateGeneratedDraftDto } from "./dto/update-generated-draft.dto";

@Injectable()
export class GeneratedDraftsService {
  create(createGeneratedDraftDto: CreateGeneratedDraftDto) {
    return "This action adds a new generatedDraft";
  }

  findAll() {
    return `This action returns all generatedDrafts`;
  }

  findOne(id: number) {
    return `This action returns a #${id} generatedDraft`;
  }

  update(id: number, updateGeneratedDraftDto: UpdateGeneratedDraftDto) {
    return `This action updates a #${id} generatedDraft`;
  }

  remove(id: number) {
    return `This action removes a #${id} generatedDraft`;
  }
}
