import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from "@nestjs/common";
import { GeneratedDraftsService } from "./generated-drafts.service";
import { CreateGeneratedDraftDto } from "./dto/create-generated-draft.dto";
import { UpdateGeneratedDraftDto } from "./dto/update-generated-draft.dto";

@Controller("generated-drafts")
export class GeneratedDraftsController {
  constructor(
    private readonly generatedDraftsService: GeneratedDraftsService,
  ) {}

  @Post()
  create(@Body() createGeneratedDraftDto: CreateGeneratedDraftDto) {
    return this.generatedDraftsService.create(createGeneratedDraftDto);
  }

  @Get()
  findAll() {
    return this.generatedDraftsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.generatedDraftsService.findOne(+id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateGeneratedDraftDto: UpdateGeneratedDraftDto,
  ) {
    return this.generatedDraftsService.update(+id, updateGeneratedDraftDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.generatedDraftsService.remove(+id);
  }
}
