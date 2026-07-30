import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import OpenAI from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/context/prisma.service";
import { GeneratedDraftsService } from "../generated-drafts/generated-drafts.service";
import { AiAssetService } from "./ai-asset.service";
import { GenerateBatchDigestDto } from "./dto/generate-batch-digest.dto";
import { generateLlmCompletion } from "./helpers/ai-prompts-llm.helper";
import { checkPerspectiveToxicity, interpolateTemplate } from "./helpers/ai-prompts-digest.helper";
import { stripMarkdownFences, sleep } from "./helpers/ai-prompts-parser.util";

function tryParseBlogJson(
  content: string,
): { blogPostContent: string; imagePrompt?: string } | null {
  try {
    const cleaned = stripMarkdownFences(content.trim());
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.blogPostContent === "string") {
      return {
        blogPostContent: parsed.blogPostContent,
        imagePrompt: parsed.imagePrompt,
      };
    }
  } catch {}
  return null;
}

function tryParsePolishedJson(
  content: string,
): { blogPostContent: string; socialPlainText: string; hashtags?: string[] } | null {
  try {
    const cleaned = stripMarkdownFences(content.trim());
    const parsed = JSON.parse(cleaned);
    if (
      typeof parsed.blogPostContent === "string" &&
      typeof parsed.socialPlainText === "string"
    ) {
      return {
        blogPostContent: parsed.blogPostContent,
        socialPlainText: parsed.socialPlainText,
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      };
    }
  } catch {}
  return null;
}

function tryParseImagePromptJson(
  content: string,
): { imagePrompt: string } | null {
  try {
    const cleaned = stripMarkdownFences(content.trim());
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.imagePrompt === "string") {
      return {
        imagePrompt: parsed.imagePrompt,
      };
    }
  } catch {}
  return null;
}

function getStepDelay(queueConfigJson: any): number {
  try {
    if (typeof queueConfigJson === "string") {
      const config = JSON.parse(queueConfigJson);
      if (typeof config.stepDelayMs === "number") {
        return config.stepDelayMs;
      }
    } else if (queueConfigJson && typeof queueConfigJson.stepDelayMs === "number") {
      return queueConfigJson.stepDelayMs;
    }
  } catch {}
  return 180000; // 3 minutes default delay
}

@Injectable()
@Processor("content-generation-queue")
export class ContentGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ContentGenerationProcessor.name);
  private readonly openai: OpenAI | null;
  private readonly anthropic: Anthropic | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiAssetService: AiAssetService,
    private readonly generatedDraftsService: GeneratedDraftsService,
    @InjectQueue("content-generation-queue")
    private readonly contentGenerationQueue: Queue,
  ) {
    super();
    const openAiKey = this.configService.get<string>("OPENAI_API_KEY");
    this.openai = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;

    const anthropicKey = this.configService.get<string>("ANTHROPIC_API_KEY");
    this.anthropic = anthropicKey
      ? new Anthropic({ apiKey: anthropicKey })
      : null;
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing content generation job: ${job.name} (ID: ${job.id})`);
    switch (job.name) {
      case "step-one":
        return this.processStepOne(job.data);
      case "step-two":
        return this.processStepTwo(job.data);
      case "step-three":
        return this.processStepThree(job.data);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  private async processStepOne(dto: GenerateBatchDigestDto) {
    let createdDraftId: string | null = null;
    try {
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

      const model = dto.model ?? "claude-3-5-sonnet-20241022";
      const tone = dto.tone ?? "professional";
      const audience = "general professional audience";

      // 0. Content Safety Check
      const articleContext = posts
        .map(
          (post, index) =>
            `Article ${index + 1}: ${post.title}\n${post.rawContent}`,
        )
        .join("\n\n");

      try {
        const perspectiveApiKey =
          this.configService.get<string>("PERSPECTIVE_API_KEY") || null;
        await checkPerspectiveToxicity(articleContext, perspectiveApiKey);
      } catch (safetyErr: any) {
        await this.prisma.systemLog.create({
          data: {
            traceId: `err-safety-${dto.workspaceId}`,
            serviceName: "AIWorker",
            level: "WARN",
            message: `Step 1 safety/toxicity check failed for workspace ${dto.workspaceId}: ${safetyErr.message}`,
          },
        });
        throw safetyErr;
      }

      // Fetch active Step 1 prompt config through ToneProfile relation
      const toneProfile = await this.prisma.toneProfile.findFirst({
        where: {
          name: {
            equals: tone,
            mode: "insensitive",
          },
        },
        include: {
          stepOneRawDraftPrompt: true,
        },
      });

      if (!toneProfile) {
        throw new NotFoundException(
          `ToneProfile matching tone '${tone}' not found`,
        );
      }

      const activePrompt = toneProfile.stepOneRawDraftPrompt;
      if (!activePrompt) {
        throw new NotFoundException(
          `StepOneRawDraftPrompt for tone profile '${toneProfile.name}' not found`,
        );
      }

      const systemPromptFallback =
        activePrompt.systemPrompt;
      const templateText =
        activePrompt.template;

      const systemPromptCombined = `${systemPromptFallback}\n\nTone: {{tone}}\nAudience: {{audience}}\n\n${templateText}`;
      const blogSystemPrompt = interpolateTemplate(systemPromptCombined, {
        tone,
        audience,
        articleContext,
      });

      const blogOutput = await generateLlmCompletion({
        selectedModel: model,
        systemPrompt: blogSystemPrompt,
        tone,
        articleContext,
        openai: this.openai,
        anthropic: this.anthropic,
        userPrompt:
          "Generate a high-quality blog post and an image prompt based on the articles context provided.",
        overrideSystemPrompt: blogSystemPrompt,
      });

      const parsedBlog = tryParseBlogJson(blogOutput) || {
        blogPostContent: blogOutput,
        imagePrompt:
          "High quality conceptual image representing AI automation and digital publishing",
      };

      // Save RAW_DRAFT
      const draft = await this.prisma.generatedDraft.create({
        data: {
          workspaceId: dto.workspaceId,
          toneProfileId: toneProfile.id,
          rawPostId: null,
          generationType: "batch_digest",
          blogPostContent: parsedBlog.blogPostContent,
          socialPlainText: "",
          imageUrl: null,
          imageProvider: null,
          status: "RAW_DRAFT",
        },
        include: {
          workspace: true,
        },
      });

      createdDraftId = draft.id;

      const delayMs = getStepDelay(draft.workspace.queueConfig);
      await this.contentGenerationQueue.add(
        "step-two",
        {
          draftId: draft.id,
          model,
          tone,
          audience,
          workspaceId: dto.workspaceId,
        },
        {
          delay: delayMs,
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );

      return { draftId: draft.id, status: "RAW_DRAFT" };
    } catch (err: any) {
      if (createdDraftId) {
        await this.prisma.generatedDraft.update({
          where: { id: createdDraftId },
          data: { status: "failed" },
        });
        await this.prisma.systemLog.create({
          data: {
            traceId: `err-${createdDraftId}`,
            serviceName: "AIWorker",
            level: "ERROR",
            message: `Step 1 generation failed for draft ${createdDraftId}: ${err.message}`,
          },
        });
      }
      throw err;
    }
  }

  private async processStepTwo(data: {
    draftId: string;
    model: string;
    tone: string;
    audience: string;
    workspaceId: string;
  }) {
    try {
      const draft = await this.prisma.generatedDraft.findUnique({
        where: { id: data.draftId },
        include: { workspace: true },
      });

      if (!draft) {
        throw new NotFoundException(`Draft ${data.draftId} not found`);
      }

      // Fetch active Step 2 prompt config through ToneProfile relation
      const toneProfile = await this.prisma.toneProfile.findFirst({
        where: {
          name: {
            equals: data.tone,
            mode: "insensitive",
          },
        },
        include: {
          stepTwoPolishingPrompt: true,
        },
      });

      if (!toneProfile) {
        throw new NotFoundException(
          `ToneProfile matching tone '${data.tone}' not found`,
        );
      }

      const activePrompt = toneProfile.stepTwoPolishingPrompt;
      if (!activePrompt) {
        throw new NotFoundException(
          `StepTwoPolishingPrompt for tone profile '${toneProfile.name}' not found`,
        );
      }

      const systemPromptFallback = activePrompt.systemPrompt;
      const templateText = activePrompt.template;

      const polishSystemPrompt = interpolateTemplate(
        `${systemPromptFallback}\n\n${templateText}`,
        {
          tone: data.tone,
          audience: data.audience,
          blogPostContent: draft.blogPostContent || "",
        },
      );

      const polishedOutput = await generateLlmCompletion({
        selectedModel: data.model,
        systemPrompt: polishSystemPrompt,
        tone: data.tone,
        articleContext: draft.blogPostContent || "",
        openai: this.openai,
        anthropic: this.anthropic,
        userPrompt:
          "Polish the raw draft to improve formatting, structure, and tone.",
        overrideSystemPrompt: polishSystemPrompt,
      });

      const parsedPolished = tryParsePolishedJson(polishedOutput) || {
        blogPostContent: draft.blogPostContent || "",
        socialPlainText: (draft.blogPostContent || "").substring(0, 200),
        hashtags: ["SurgeDigest", "Automation"],
      };

      // Update POLISHED
      await this.prisma.generatedDraft.update({
        where: { id: draft.id },
        data: {
          blogPostContent: parsedPolished.blogPostContent,
          socialPlainText: parsedPolished.socialPlainText,
          status: "POLISHED",
        },
      });

      const delayMs = getStepDelay(draft.workspace.queueConfig);
      await this.contentGenerationQueue.add(
        "step-three",
        {
          draftId: draft.id,
          model: data.model,
          tone: data.tone,
          audience: data.audience,
          workspaceId: data.workspaceId,
          hashtags: parsedPolished.hashtags,
        },
        {
          delay: delayMs,
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );

      return { draftId: draft.id, status: "POLISHED" };
    } catch (err: any) {
      await this.prisma.generatedDraft.update({
        where: { id: data.draftId },
        data: { status: "failed" },
      });
      await this.prisma.systemLog.create({
        data: {
          traceId: `err-${data.draftId}`,
          serviceName: "AIWorker",
          level: "ERROR",
          message: `Step 2 polishing failed for draft ${data.draftId}: ${err.message}`,
        },
      });
      throw err;
    }
  }

  private async processStepThree(data: {
    draftId: string;
    model: string;
    tone: string;
    audience: string;
    workspaceId: string;
    hashtags?: string[];
  }) {
    try {
      let draft = await this.prisma.generatedDraft.findUnique({
        where: { id: data.draftId },
      });

      if (!draft) {
        throw new NotFoundException(`Draft ${data.draftId} not found`);
      }

      // Fetch active Step 3 prompt config through ToneProfile relation
      const toneProfile = await this.prisma.toneProfile.findFirst({
        where: {
          name: {
            equals: data.tone,
            mode: "insensitive",
          },
        },
        include: {
          stepThreeImagePrompt: true,
        },
      });

      if (!toneProfile) {
        throw new NotFoundException(
          `ToneProfile matching tone '${data.tone}' not found`,
        );
      }

      const activePrompt = toneProfile.stepThreeImagePrompt;
      if (!activePrompt) {
        throw new NotFoundException(
          `StepThreeImagePrompt for tone profile '${toneProfile.name}' not found`,
        );
      }

      const systemPromptFallback = activePrompt.systemPrompt;
      const templateText = activePrompt.template;

      const imageSystemPrompt = interpolateTemplate(
        `${systemPromptFallback}\n\n${templateText}`,
        {
          blogPostContent: draft.blogPostContent || "",
        },
      );

      const imagePromptOutput = await generateLlmCompletion({
        selectedModel: data.model,
        systemPrompt: imageSystemPrompt,
        tone: data.tone,
        articleContext: draft.blogPostContent || "",
        openai: this.openai,
        anthropic: this.anthropic,
        userPrompt: "Generate a detailed visual image prompt based on the content.",
        overrideSystemPrompt: imageSystemPrompt,
      });

      const parsedImagePrompt = tryParseImagePromptJson(imagePromptOutput) || {
        imagePrompt: "High quality conceptual image representing AI automation and digital publishing",
      };

      await this.sleep(3000);

      const asset = await this.aiAssetService.generateImageFromDigest({
        workspaceId: data.workspaceId,
        digestText: parsedImagePrompt.imagePrompt,
        toneProfileId: draft.toneProfileId || undefined,
      });

      // Update READY_FOR_REVIEW
      draft = await this.prisma.generatedDraft.update({
        where: { id: draft.id },
        data: {
          imageUrl: asset.imageUrl,
          imageProvider: asset.provider,
          status: "READY_FOR_REVIEW",
          editorState: {
            hashtags: data.hashtags || ["SurgeDigest"],
          },
        },
      });

      const finalDraft = await this.generatedDraftsService.applyAutoPostPolicy(
        draft.id,
      );

      return { draftId: draft.id, status: finalDraft.status };
    } catch (err: any) {
      await this.prisma.generatedDraft.update({
        where: { id: data.draftId },
        data: { status: "failed" },
      });
      await this.prisma.systemLog.create({
        data: {
          traceId: `err-${data.draftId}`,
          serviceName: "AIWorker",
          level: "ERROR",
          message: `Step 3 image generation failed for draft ${data.draftId}: ${err.message}`,
        },
      });
    }
  }

  private async sleep(ms: number) {
    await sleep(ms);
  }
}
