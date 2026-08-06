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
import { GeminiImageProvider } from "./providers/gemini-image-provider.service";
import { RssExtractionProcessor } from "./processors/rss-extraction.processor";
import { ArticleGroupingProcessor } from "./processors/article-grouping.processor";
import { ArticleWritingProcessor } from "./processors/article-writing.processor";
import { ArticlePolishingProcessor } from "./processors/article-polishing.processor";
import { ImageConceptProcessor } from "./processors/image-concept.processor";
import { ImageGenerationProcessor } from "./processors/image-generation.processor";
import { CompanySocialProcessor } from "./processors/company-social.processor";
import { PersonalSocialProcessor } from "./processors/personal-social.processor";

@Module({
  imports: [
    ConfigModule,
    StorageModule,
    AuthModule,
    GeneratedDraftsModule,
    BullModule.registerQueue({
      name: "content-generation-queue",
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
  ],
  controllers: [AiPromptsController],
  providers: [
    AiPromptsService,
    AiAssetService,
    GeminiImageProvider,
    ContentGenerationProcessor,
    RssExtractionProcessor,
    ArticleGroupingProcessor,
    ArticleWritingProcessor,
    ArticlePolishingProcessor,
    ImageConceptProcessor,
    ImageGenerationProcessor,
    CompanySocialProcessor,
    PersonalSocialProcessor,
  ],
  exports: [AiPromptsService, AiAssetService, BullModule],
})
export class AiPromptsModule {}
