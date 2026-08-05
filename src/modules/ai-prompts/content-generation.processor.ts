import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { RssExtractionProcessor } from "./processors/rss-extraction.processor";
import { ArticleGroupingProcessor } from "./processors/article-grouping.processor";
import { ArticleWritingProcessor } from "./processors/article-writing.processor";
import { ArticlePolishingProcessor } from "./processors/article-polishing.processor";
import { ImageConceptProcessor } from "./processors/image-concept.processor";
import { ImageGenerationProcessor } from "./processors/image-generation.processor";
import { CompanySocialProcessor } from "./processors/company-social.processor";
import { PersonalSocialProcessor } from "./processors/personal-social.processor";

@Injectable()
@Processor("content-generation-queue")
export class ContentGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ContentGenerationProcessor.name);

  constructor(
    private readonly rssExtraction: RssExtractionProcessor,
    private readonly articleGrouping: ArticleGroupingProcessor,
    private readonly articleWriting: ArticleWritingProcessor,
    private readonly articlePolishing: ArticlePolishingProcessor,
    private readonly imageConcept: ImageConceptProcessor,
    private readonly imageGeneration: ImageGenerationProcessor,
    private readonly companySocial: CompanySocialProcessor,
    private readonly personalSocial: PersonalSocialProcessor,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Routing job name: ${job.name} (Job ID: ${job.id})`);

    switch (job.name) {
      case "rss-extraction":
        return this.rssExtraction.process(job);
      case "article-grouping":
      case "step-one": // Legacy route maps directly to grouping
        return this.articleGrouping.process(job);
      case "article-writing":
        return this.articleWriting.process(job);
      case "article-polishing":
      case "step-two": // Legacy route
        return this.articlePolishing.process(job);
      case "image-concept":
        return this.imageConcept.process(job);
      case "image-generation":
      case "step-three": // Legacy route
        return this.imageGeneration.process(job);
      case "company-social":
        return this.companySocial.process(job);
      case "personal-social":
        return this.personalSocial.process(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }
}
