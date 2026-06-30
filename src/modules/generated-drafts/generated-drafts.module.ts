import { Module } from "@nestjs/common";
import { GeneratedDraftsService } from "./generated-drafts.service";
import { GeneratedDraftsController } from "./generated-drafts.controller";

@Module({
  controllers: [GeneratedDraftsController],
  providers: [GeneratedDraftsService],
})
export class GeneratedDraftsModule {}
