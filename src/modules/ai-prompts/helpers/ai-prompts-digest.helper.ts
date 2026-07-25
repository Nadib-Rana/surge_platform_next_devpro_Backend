import { BadRequestException, NotFoundException } from "@nestjs/common";
import OpenAI from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { PrismaService } from "../../../common/context/prisma.service";
import { GeneratedDraftsService } from "../../generated-drafts/generated-drafts.service";
import { AiAssetService } from "../ai-asset.service";
import { GenerateBatchDigestDto } from "../dto/generate-batch-digest.dto";
import { generateLlmCompletion } from "./ai-prompts-llm.helper";
import { parseBatchDigestContent, sleep } from "./ai-prompts-parser.util";

export async function executeBatchDigestGeneration(params: {
  prisma: PrismaService;
  aiAssetService: AiAssetService;
  generatedDraftsService: GeneratedDraftsService;
  openai: OpenAI | null;
  anthropic: Anthropic | null;
  dto: GenerateBatchDigestDto;
}) {
  const {
    prisma,
    aiAssetService,
    generatedDraftsService,
    openai,
    anthropic,
    dto,
  } = params;

  if (!dto.workspaceId) {
    throw new BadRequestException("workspaceId is required");
  }

  const posts = await prisma.rawPostsBuffer.findMany({
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
    ? await prisma.promptVersion.findUnique({
        where: { id: dto.promptVersionId },
        include: { aiPrompt: true },
      })
    : await prisma.promptVersion.findFirst({
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

  const digestText = await generateLlmCompletion({
    selectedModel: dto.model ?? "gpt-4o-mini",
    systemPrompt: promptVersion.systemPrompt,
    tone: promptVersion.tone ?? "professional",
    articleContext,
    openai,
    anthropic,
  });

  const generatedContent = parseBatchDigestContent(digestText);

  await sleep(3000);

  const asset = await aiAssetService.generateImageFromDigest({
    workspaceId: dto.workspaceId,
    digestText: generatedContent.socialPlainText,
    promptVersionId: promptVersion.id,
  });

  const draft = await prisma.generatedDraft.create({
    data: {
      workspaceId: dto.workspaceId,
      promptVersionId: promptVersion.id,
      rawPostId: null,
      generationType: "batch_digest",
      wordpressHtmlContent: generatedContent.wordpressHtmlContent,
      socialPlainText: generatedContent.socialPlainText,
      imageUrl: asset.imageUrl,
      imageProvider: asset.provider,
      status: "review",
    },
  });

  const finalDraft = await generatedDraftsService.applyAutoPostPolicy(
    draft.id,
  );

  return {
    draft: finalDraft,
    digestText: generatedContent.socialPlainText,
    asset,
  };
}
