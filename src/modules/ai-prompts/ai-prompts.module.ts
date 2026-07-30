import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AiPromptsService } from "./ai-prompts.service";
import { AiPromptsController } from "./ai-prompts.controller";
import { AiAssetService } from "./ai-asset.service";
import { ConfigModule } from "@nestjs/config";
import { StorageModule } from "../storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { GeneratedDraftsModule } from "../generated-drafts/generated-drafts.module";
import { ContentGenerationProcessor } from "./content-generation.processor";

@Module({
  imports: [
    ConfigModule,
    StorageModule,
    AuthModule,
    GeneratedDraftsModule,
    BullModule.registerQueue({
      name: "content-generation-queue",
    }),
  ],
  controllers: [AiPromptsController],
  providers: [AiPromptsService, AiAssetService, ContentGenerationProcessor],
  exports: [AiPromptsService, AiAssetService, BullModule],
})
export class AiPromptsModule {}
