import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/context/prisma.service";
import { Job, Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";

@Injectable()
export class RssExtractionProcessor {
  private readonly logger = new Logger(RssExtractionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue("content-generation-queue") private readonly queue: Queue,
  ) {}

  async process(job: Job<any>) {
    const { title, url, source, workspaceId, feedId } = job.data;
    this.logger.log(`Processing RSS extraction for item: ${title} from ${source}`);

    const urlHash = Buffer.from(url).toString("base64").substring(0, 100);

    // Create post in buffer
    const post = await this.prisma.rawPostsBuffer.upsert({
      where: { urlHash },
      update: { status: "buffered" },
      create: {
        workspaceId,
        feedId,
        urlHash,
        title: title || "Untitled Item",
        rawContent: `Source: ${source}\nURL: ${url}\n\nTitle: ${title}`,
        publishedAt: new Date(),
        status: "buffered",
        sourceName: source || "RSS Feed",
      },
    });

    return { postId: post.id };
  }
}
