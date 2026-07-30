import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { GenerateBatchDigestDto } from "./dto/generate-batch-digest.dto";

@Injectable()
export class AiPromptsService {
  constructor(
    @InjectQueue("content-generation-queue")
    private readonly contentGenerationQueue: Queue,
  ) {}

  async generateBatchDigest(dto: GenerateBatchDigestDto) {
    await this.contentGenerationQueue.add("step-one", dto, {
      removeOnComplete: true,
      removeOnFail: 100,
    });
    return { message: "Generation process started" };
  }
}
