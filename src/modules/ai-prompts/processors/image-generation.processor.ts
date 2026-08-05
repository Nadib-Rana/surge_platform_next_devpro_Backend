import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/context/prisma.service";
import { GeminiImageProvider } from "../providers/gemini-image-provider.service";
import { StorageService } from "../../storage/storage.service";
import { Job, Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";

@Injectable()
export class ImageGenerationProcessor {
  private readonly logger = new Logger(ImageGenerationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiImageProvider,
    private readonly storage: StorageService,
    @InjectQueue("content-generation-queue") private readonly queue: Queue,
  ) {}

  async process(job: Job<any>) {
    const { draftId, model = "gpt-4o", tone = "professional" } = job.data;
    this.logger.log(`Invoking image generation for Draft: ${draftId}`);

    const draft = await this.prisma.generatedDraft.findUnique({
      where: { id: draftId },
    });
    if (!draft || !draft.imageConcept) throw new Error(`Draft ${draftId} or imageConcept not found`);

    const imageBuffer = await this.gemini.generateImage({
      prompt: `${draft.imageConcept}. Caption: ${draft.imageCaption || ""}`,
      negativeConstraints: draft.negativeConstraints || "photo, color, realistic",
      temperature: 0.4, // Strict Temp 0.4
    });

    const objectName = `workspaces/${draft.workspaceId}/assets/${Date.now()}-cartoon.png`;
    const presignedUrl = await this.storage.uploadBuffer(objectName, imageBuffer, "image/png");

    await this.prisma.generatedDraft.update({
      where: { id: draftId },
      data: {
        imageUrl: presignedUrl,
        imageProvider: "gemini",
      },
    });

    // Chain next task
    await this.queue.add("company-social", {
      draftId,
      model,
      tone,
    });

    this.logger.log(`Completed Image Generation for Draft ${draftId}. Image uploaded to ${presignedUrl}. Enqueued company-social.`);

    return { draftId, imageUrl: presignedUrl };
  }
}
