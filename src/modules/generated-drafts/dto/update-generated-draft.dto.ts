import { PartialType } from "@nestjs/swagger";
import { CreateGeneratedDraftDto } from "./create-generated-draft.dto";

export class UpdateGeneratedDraftDto extends PartialType(CreateGeneratedDraftDto) {}
