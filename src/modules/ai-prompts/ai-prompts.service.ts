import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/context/prisma.service";
import { CreateAiPromptDto } from "./dto/create-ai-prompt.dto";
import { GenerateBatchDigestDto } from "./dto/generate-batch-digest.dto";
import { UpdateAiPromptDto } from "./dto/update-ai-prompt.dto";
import { AiAssetService } from "./ai-asset.service";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

@Injectable()
export class AiPromptsService {
  private readonly openai: OpenAI | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiAssetService: AiAssetService,
  ) {
    const apiKey = this.configService.get<string>("OPENAI_API_KEY");
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async create(createAiPromptDto: CreateAiPromptDto) {
    return this.createPromptWithVersion(createAiPromptDto);
  }

  async findAll() {
    return this.prisma.aiPrompt.findMany({
      include: { versions: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const prompt = await this.prisma.aiPrompt.findUnique({
      where: { id },
      include: { versions: true },
    });

    if (!prompt) {
      throw new NotFoundException(`AI prompt ${id} not found`);
    }

    return prompt;
  }

  async update(id: string, updateAiPromptDto: UpdateAiPromptDto) {
    const prompt = await this.prisma.aiPrompt.findUnique({ where: { id } });
    if (!prompt) {
      throw new NotFoundException(`AI prompt ${id} not found`);
    }

    const updatedPrompt = await this.prisma.aiPrompt.update({
      where: { id },
      data: {
        name: updateAiPromptDto.name ?? prompt.name,
        description: updateAiPromptDto.description ?? prompt.description,
        workspaceId: updateAiPromptDto.workspaceId ?? prompt.workspaceId,
      },
    });

    if (updateAiPromptDto.systemPrompt || updateAiPromptDto.versionTag || updateAiPromptDto.tone) {
      const previousVersions = await this.prisma.promptVersion.findMany({
        where: { promptId: id },
        orderBy: { createdAt: "desc" },
      });

      const activeVersion = previousVersions.find((version) => version.isActive);
      if (activeVersion) {
        await this.prisma.promptVersion.updateMany({
          where: { promptId: id, isActive: true },
          data: { isActive: false },
        });
      }

      await this.prisma.promptVersion.create({
        data: {
          promptId: id,
          versionTag: updateAiPromptDto.versionTag ?? `v${previousVersions.length + 1}`,
          systemPrompt: updateAiPromptDto.systemPrompt ?? activeVersion?.systemPrompt ?? "You are an expert social media copywriter.",
          tone: updateAiPromptDto.tone ?? activeVersion?.tone ?? "professional",
          isActive: true,
        },
      });
    }

    return updatedPrompt;
  }

  async remove(id: string) {
    const prompt = await this.prisma.aiPrompt.findUnique({ where: { id } });
    if (!prompt) {
      throw new NotFoundException(`AI prompt ${id} not found`);
    }

    return this.prisma.aiPrompt.delete({ where: { id } });
  }

  async createPromptWithVersion(dto: CreateAiPromptDto) {
    const prompt = await this.prisma.aiPrompt.create({
      data: {
        workspaceId: dto.workspaceId ?? null,
        name: dto.name,
        description: dto.description,
      },
    });

    const version = await this.prisma.promptVersion.create({
      data: {
        promptId: prompt.id,
        versionTag: dto.versionTag ?? "v1",
        systemPrompt: dto.systemPrompt ?? "You are an expert social media copywriter.",
        tone: dto.tone ?? "professional",
        isActive: true,
      },
    });

    return { prompt, version };
  }

  async generateBatchDigest(dto: GenerateBatchDigestDto) {
    if (!dto.workspaceId) {
      throw new BadRequestException("workspaceId is required");
    }

    if (!this.openai) {
      throw new InternalServerErrorException("OPENAI_API_KEY is not configured");
    }

    const posts = await this.prisma.rawPostsBuffer.findMany({
      where: {
        workspaceId: dto.workspaceId,
        status: "buffered",
      },
      orderBy: { publishedAt: "desc" },
      take: dto.limit ?? 5,
    });

    if (!posts.length) {
      throw new BadRequestException(`No buffered posts found for workspace ${dto.workspaceId}`);
    }

    const promptVersion = dto.promptVersionId
      ? await this.prisma.promptVersion.findUnique({
          where: { id: dto.promptVersionId },
          include: { aiPrompt: true },
        })
      : await this.prisma.promptVersion.findFirst({
          where: {
            isActive: true,
            aiPrompt: {
              workspaceId: dto.workspaceId,
            },
          },
          orderBy: { createdAt: "desc" },
          include: { aiPrompt: true },
        });

    if (!promptVersion) {
      throw new NotFoundException("No active prompt version found for the workspace");
    }

    const articleContext = posts
      .map((post, index) => `Article ${index + 1}: ${post.title}\n${post.rawContent}`)
      .join("\n\n");

    const completion = await this.openai.chat.completions.create({
      model: dto.model ?? "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `${promptVersion.systemPrompt}\n\nTone: ${promptVersion.tone ?? "professional"}`,
        },
        {
          role: "user",
          content: `Create a single, high-engagement social media digest from the following raw articles. Preserve the key points, keep it concise, and make it ready for posting.\n\n${articleContext}`,
        },
      ],
    });

    const digestText = completion.choices[0]?.message?.content?.trim() ?? "Batch digest generation completed.";

    await this.sleep(3000);

    const asset = await this.aiAssetService.generateImageFromDigest({
      workspaceId: dto.workspaceId,
      digestText,
      promptVersionId: promptVersion.id,
    });

    const draft = await this.prisma.generatedDraft.create({
      data: {
        workspaceId: dto.workspaceId,
        promptVersionId: promptVersion.id,
        rawPostId: null,
        generationType: "batch_digest",
        socialPlainText: digestText,
        imageUrl: asset.imageUrl,
        imageProvider: "openai",
        status: "pending",
      },
    });

    return {
      draft,
      digestText,
      asset,
    };
  }

  private async sleep(delayMs: number) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
