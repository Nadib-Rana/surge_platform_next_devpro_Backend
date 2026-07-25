import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/context/prisma.service";
import { CreateAiPromptDto } from "./dto/create-ai-prompt.dto";
import { GenerateBatchDigestDto } from "./dto/generate-batch-digest.dto";
import { UpdateAiPromptDto } from "./dto/update-ai-prompt.dto";
import { AiAssetService } from "./ai-asset.service";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { GeneratedDraftsService } from "../generated-drafts/generated-drafts.service";
import {
  createPromptWithVersionHelper,
  updatePromptWithVersionTransaction,
} from "./helpers/ai-prompts-version.helper";
import { executeBatchDigestGeneration } from "./helpers/ai-prompts-digest.helper";

interface AuthenticatedUser {
  userId: string;
  role: string;
}

@Injectable()
export class AiPromptsService {
  private readonly openai: OpenAI | null;
  private readonly anthropic: Anthropic | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiAssetService: AiAssetService,
    private readonly generatedDraftsService: GeneratedDraftsService,
  ) {
    const openAiKey = this.configService.get<string>("OPENAI_API_KEY");
    this.openai = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;

    const anthropicKey = this.configService.get<string>("ANTHROPIC_API_KEY");
    this.anthropic = anthropicKey
      ? new Anthropic({ apiKey: anthropicKey })
      : null;
  }

  async create(createAiPromptDto: CreateAiPromptDto, user: AuthenticatedUser) {
    return createPromptWithVersionHelper(this.prisma, createAiPromptDto, user);
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

    return this.prisma.$transaction((tx) =>
      updatePromptWithVersionTransaction(tx, id, updateAiPromptDto, prompt),
    );
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

    return this.prisma.$transaction((tx) =>
      updatePromptWithVersionTransaction(tx, id, updateAiPromptDto, prompt),
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
    return createPromptWithVersionHelper(this.prisma, dto, user);
  }

  async generateBatchDigest(dto: GenerateBatchDigestDto) {
    return executeBatchDigestGeneration({
      prisma: this.prisma,
      aiAssetService: this.aiAssetService,
      generatedDraftsService: this.generatedDraftsService,
      openai: this.openai,
      anthropic: this.anthropic,
      dto,
    });
  }
}
