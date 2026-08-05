import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../../common/context/prisma.service";
import { validateHyperlinksPreservation } from "../helpers/hyperlink-validator";
import { generateLlmCompletion } from "../helpers/ai-prompts-llm.helper";
import { interpolateTemplate, resolveWorkspaceBrandVariables } from "../helpers/ai-prompts-digest.helper";
import OpenAI from "openai";
import { ConfigService } from "@nestjs/config";
import { Job, Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";

@Injectable()
export class ArticlePolishingProcessor {
  private readonly logger = new Logger(ArticlePolishingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue("content-generation-queue") private readonly queue: Queue,
  ) { }

  async process(job: Job<any>) {
    const { draftId, model = "gpt-4o", tone = "professional" } = job.data;
    this.logger.log(`Polishing article Draft: ${draftId}`);

    const draft = await this.prisma.generatedDraft.findUnique({
      where: { id: draftId },
    });
    if (!draft || !draft.rawContent) throw new Error(`Draft ${draftId} or rawContent not found`);

    const toneProfile = await this.prisma.toneProfile.findFirst({
      where: { name: { equals: tone, mode: "insensitive" } },
      include: { stepTwoPolishingPrompt: true },
    });

    const brandVariables = await resolveWorkspaceBrandVariables(this.prisma, draft.workspaceId);

    let systemPrompt = "You are a professional editor. You polish text while strictly preserving raw hyperlinks.";
    let userPrompt = `Polish this article content.
Requirements:
1. ABSOLUTE RULE: Preserve every single HTML hyperlink <a href="...">text</a> exactly as it is. Do NOT change href or link text.
2. Vary sentence structure and improve prose quality.
3. Filter banned AI words (e.g. "delve", "testament", "tapestry").
Return ONLY the polished HTML/Markdown content.`;

    if (toneProfile?.stepTwoPolishingPrompt?.isActive) {
      const editorState = (draft.editorState as any) || {};
      const mergedVariables = {
        ...brandVariables,
        blogPostContent: draft.rawContent,
        blogTitle: editorState.title || (draft as any).topicTitle || "",
        tone,
        audience: brandVariables.businessAudience || "general",
      };
      systemPrompt = interpolateTemplate(toneProfile.stepTwoPolishingPrompt.systemPrompt, mergedVariables);
      userPrompt = interpolateTemplate(toneProfile.stepTwoPolishingPrompt.template, mergedVariables);
    }

    const openAiKey = this.config.get<string>("OPENAI_API_KEY");
    const openai = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;

    const polishedContent = await generateLlmCompletion({
      selectedModel: model,
      systemPrompt,
      tone,
      articleContext: draft.rawContent,
      openai,
      anthropic: null,
      userPrompt,
    });

    // Enforce Hyperlink Retention Validator
    const validation = validateHyperlinksPreservation(draft.rawContent, polishedContent);
    if (!validation.valid) {
      this.logger.error(`Validation failed. Altered/missing links: ${JSON.stringify(validation)}`);
      throw new BadRequestException("Polishing failed link retention check. Retrying...");
    }

    await this.prisma.generatedDraft.update({
      where: { id: draftId },
      data: {
        polishedContent,
        blogPostContent: polishedContent, // legacy map
        status: "POLISHED",
      },
    });

    // Chain next task
    await this.queue.add("image-concept", {
      draftId,
      model,
      tone,
    });

    this.logger.log(`Completed Article Polishing for Draft ${draftId}. Enqueued image-concept.`);

    return { draftId };
  }
}
