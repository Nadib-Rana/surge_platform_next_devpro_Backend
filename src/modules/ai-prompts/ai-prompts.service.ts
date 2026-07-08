import {
  BadRequestException,
  ForbiddenException,
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
import { Prisma } from "@prisma/client";
import OpenAI from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { type TextBlock } from "@anthropic-ai/sdk/resources/messages";

interface AuthenticatedUser {
  userId: string;
  role: string;
}

type PromptScope = "GLOBAL" | "WORKSPACE";

interface UpdateablePrompt {
  name: string;
  description: string | null;
  scope: PromptScope;
}

@Injectable()
export class AiPromptsService {
  private readonly openai: OpenAI | null;
  private readonly anthropic: Anthropic | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiAssetService: AiAssetService,
  ) {
    const openAiKey = this.configService.get<string>("OPENAI_API_KEY");
    this.openai = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;

    const anthropicKey = this.configService.get<string>("ANTHROPIC_API_KEY");
    this.anthropic = anthropicKey
      ? new Anthropic({ apiKey: anthropicKey })
      : null;
  }

  async create(createAiPromptDto: CreateAiPromptDto, user: AuthenticatedUser) {
    return this.createPromptWithVersion(createAiPromptDto, user);
  }

  async findGlobalPrompts() {
    return this.prisma.aiPrompt.findMany({
      where: { scope: "GLOBAL" },
      include: { versions: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findWorkspacePrompts(user: AuthenticatedUser) {
    return this.prisma.aiPrompt.findMany({
      where: { scope: "WORKSPACE", createdById: user.userId },
      include: { versions: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const prompt = await this.prisma.aiPrompt.findUnique({
      where: { id },
      include: { versions: true },
    });

    if (
      !prompt ||
      (prompt.scope === "WORKSPACE" && prompt.createdById !== user.userId)
    ) {
      throw new NotFoundException(`AI prompt ${id} not found`);
    }

    return prompt;
  }

  async updateGlobalPrompt(id: string, updateAiPromptDto: UpdateAiPromptDto) {
    const prompt = await this.prisma.aiPrompt.findFirst({
      where: { id, scope: "GLOBAL" },
    });

    if (!prompt) {
      throw new NotFoundException(`AI prompt ${id} not found`);
    }

    return this.updatePromptWithVersion(id, updateAiPromptDto, prompt);
  }

  async updateWorkspacePrompt(
    id: string,
    updateAiPromptDto: UpdateAiPromptDto,
    user: AuthenticatedUser,
  ) {
    const prompt = await this.prisma.aiPrompt.findFirst({
      where: { id, scope: "WORKSPACE", createdById: user.userId },
    });

    if (!prompt) {
      throw new NotFoundException(`AI prompt ${id} not found`);
    }

    return this.updatePromptWithVersion(id, updateAiPromptDto, prompt);
  }

  private async updatePromptWithVersion(
    id: string,
    updateAiPromptDto: UpdateAiPromptDto,
    prompt: {
      name: string;
      description: string | null;
      scope: PromptScope;
    },
  ) {
    return this.prisma.$transaction((tx) =>
      this.updatePromptWithVersionTransaction(
        tx,
        id,
        updateAiPromptDto,
        prompt,
      ),
    );
  }

  private async updatePromptWithVersionTransaction(
    tx: Prisma.TransactionClient,
    id: string,
    updateAiPromptDto: UpdateAiPromptDto,
    prompt: UpdateablePrompt,
  ) {
    await tx.aiPrompt.update({
      where: { id },
      data: {
        name: updateAiPromptDto.name ?? prompt.name,
        description: updateAiPromptDto.description ?? prompt.description,
      },
    });

    if (this.hasVersionChange(updateAiPromptDto)) {
      const activeVersion = await tx.promptVersion.findFirst({
        where: { promptId: id, isActive: true },
        orderBy: { createdAt: "desc" },
      });
      const versionCount = await tx.promptVersion.count({
        where: { promptId: id },
      });

      await tx.promptVersion.updateMany({
        where: { promptId: id },
        data: { isActive: false },
      });

      await tx.promptVersion.create({
        data: {
          promptId: id,
          versionTag: `v${versionCount + 1}`,
          systemPrompt:
            updateAiPromptDto.systemPrompt ??
            activeVersion?.systemPrompt ??
            "You are an expert social media copywriter.",
          tone: updateAiPromptDto.tone ?? activeVersion?.tone ?? "professional",
          isActive: true,
        },
      });
    }

    const updatedPrompt = await tx.aiPrompt.findUnique({
      where: { id },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!updatedPrompt) {
      throw new NotFoundException(`AI prompt ${id} not found`);
    }

    return updatedPrompt;
  }

  private hasVersionChange(updateAiPromptDto: UpdateAiPromptDto) {
    return (
      updateAiPromptDto.systemPrompt !== undefined ||
      updateAiPromptDto.tone !== undefined
    );
  }

  async remove(id: string) {
    const prompt = await this.prisma.aiPrompt.findUnique({ where: { id } });
    if (!prompt) {
      throw new NotFoundException(`AI prompt ${id} not found`);
    }

    return this.prisma.aiPrompt.delete({ where: { id } });
  }

  async createPromptWithVersion(
    dto: CreateAiPromptDto,
    user?: AuthenticatedUser,
  ) {
    if (!dto.createdById) {
      throw new BadRequestException("createdById is required");
    }

    if (dto.scope === "GLOBAL") {
      if (user?.role !== "admin") {
        throw new ForbiddenException("Only admins can create global prompts");
      }

      if (dto.workspaceId) {
        throw new BadRequestException(
          "workspaceId must be omitted for global prompts",
        );
      }
    } else if (!dto.workspaceId) {
      throw new BadRequestException(
        "workspaceId is required for workspace prompts",
      );
    }

    const prompt = await this.prisma.aiPrompt.create({
      data: {
        scope: dto.scope ?? "WORKSPACE",
        workspaceId: dto.scope === "GLOBAL" ? null : (dto.workspaceId ?? null),
        createdById: dto.createdById,
        name: dto.name,
        description: dto.description,
      },
    });

    const version = await this.prisma.promptVersion.create({
      data: {
        promptId: prompt.id,
        versionTag: dto.versionTag ?? "v1",
        systemPrompt:
          dto.systemPrompt ?? "You are an expert social media copywriter.",
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

    const posts = await this.prisma.rawPostsBuffer.findMany({
      where: {
        workspaceId: dto.workspaceId,
        status: "buffered",
      },
      orderBy: { publishedAt: "desc" },
      take: dto.limit ?? 5,
    });

    if (!posts.length) {
      throw new BadRequestException(
        `No buffered posts found for workspace ${dto.workspaceId}`,
      );
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
              OR: [{ scope: "GLOBAL" }, { workspaceId: dto.workspaceId }],
            },
          },
          orderBy: { createdAt: "desc" },
          include: { aiPrompt: true },
        });

    if (!promptVersion) {
      throw new NotFoundException(
        "No active prompt version found for the workspace",
      );
    }

    const articleContext = posts
      .map(
        (post, index) =>
          `Article ${index + 1}: ${post.title}\n${post.rawContent}`,
      )
      .join("\n\n");

    const selectedModel = dto.model ?? "gpt-4o-mini";
    let digestText = "Batch digest generation completed.";

    if (selectedModel.startsWith("claude")) {
      if (!this.anthropic) {
        throw new InternalServerErrorException(
          "ANTHROPIC_API_KEY is not configured",
        );
      }

      const completion = await this.anthropic.messages.create({
        model: selectedModel,
        max_tokens: 1024,
        temperature: 0.8,
        system: `${promptVersion.systemPrompt}\n\nTone: ${promptVersion.tone ?? "professional"}`,
        messages: [
          {
            role: "user",
            content: `Create a single, high-engagement social media digest from the following raw articles. Preserve the key points, keep it concise, and make it ready for posting.\n\n${articleContext}`,
          },
        ],
      });

      const textBlock = completion.content.find(
        (item): item is TextBlock => item.type === "text",
      );
      digestText = textBlock?.text.trim() || digestText;
    } else {
      if (!this.openai) {
        throw new InternalServerErrorException(
          "OPENAI_API_KEY is not configured",
        );
      }

      const completion = await this.openai.chat.completions.create({
        model: selectedModel,
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

      digestText =
        completion.choices[0]?.message?.content?.trim() ?? digestText;
    }

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
        imageProvider: selectedModel.startsWith("claude")
          ? "anthropic"
          : "openai",
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
