import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/context/prisma.service";
import { generateLlmCompletion } from "../helpers/ai-prompts-llm.helper";
import { interpolateTemplate, resolveWorkspaceBrandVariables } from "../helpers/ai-prompts-digest.helper";
import OpenAI from "openai";
import { ConfigService } from "@nestjs/config";
import { Job, Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";

@Injectable()
export class CompanySocialProcessor {
  private readonly logger = new Logger(CompanySocialProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue("content-generation-queue") private readonly queue: Queue,
  ) {}

  async process(job: Job<any>) {
    const { draftId, model = "gpt-4o", tone = "professional" } = job.data;
    this.logger.log(`Generating Company Social copy for draft: ${draftId}`);

    const draft = await this.prisma.generatedDraft.findUnique({
      where: { id: draftId },
    });
    if (!draft || !draft.polishedContent) throw new Error(`Draft ${draftId} or polishedContent not found`);

    const toneProfile = await this.prisma.toneProfile.findFirst({
      where: { name: { equals: tone, mode: "insensitive" } },
      include: { stepCompanySocialPrompt: true },
    });

    const brandVariables = await resolveWorkspaceBrandVariables(this.prisma, draft.workspaceId);

    let systemPrompt = "You are a corporate PR representative. You write factual, concise social posts.";
    let userPrompt = `Create a 2-3 sentence institutional/company social media post based on the article content.
Requirements:
1. Do NOT include any links.
2. Do NOT include any emojis.
3. Use a factual, objective, professional tone.
Return ONLY the social media post text.`;

    if (toneProfile?.stepCompanySocialPrompt?.isActive) {
      const editorState = (draft.editorState as any) || {};
      const mergedVariables = {
        ...brandVariables,
        blogPostContent: draft.polishedContent,
        blogTitle: editorState.title || (draft as any).topicTitle || "",
        tone,
      };
      systemPrompt = interpolateTemplate(toneProfile.stepCompanySocialPrompt.systemPrompt, mergedVariables);
      userPrompt = interpolateTemplate(toneProfile.stepCompanySocialPrompt.template, mergedVariables);
    }

    const openAiKey = this.config.get<string>("OPENAI_API_KEY");
    const openai = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;

    const companyPost = await generateLlmCompletion({
      selectedModel: model,
      systemPrompt,
      tone,
      articleContext: draft.polishedContent,
      openai,
      anthropic: null,
      userPrompt,
    });

    await this.prisma.generatedDraft.update({
      where: { id: draftId },
      data: {
        companySocialPost: companyPost.trim(),
        socialPlainText: companyPost.trim(), // legacy map
      },
    });

    // Chain next task
    await this.queue.add("personal-social", {
      draftId,
      model,
      tone,
    });

    this.logger.log(`Completed Company Social Post generation for Draft ${draftId}. Enqueued personal-social.`);

    return { draftId, companySocialPost: companyPost };
  }
}
