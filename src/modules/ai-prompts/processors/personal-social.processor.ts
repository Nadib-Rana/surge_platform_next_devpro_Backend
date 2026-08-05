import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/context/prisma.service";
import { generateLlmCompletion } from "../helpers/ai-prompts-llm.helper";
import { interpolateTemplate, resolveWorkspaceBrandVariables } from "../helpers/ai-prompts-digest.helper";
import OpenAI from "openai";
import { ConfigService } from "@nestjs/config";
import { Job } from "bullmq";

@Injectable()
export class PersonalSocialProcessor {
  private readonly logger = new Logger(PersonalSocialProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) { }

  async process(job: Job<any>) {
    const { draftId, model = "gpt-4o", tone = "professional" } = job.data;
    this.logger.log(`Generating personal founder social post for Draft: ${draftId}`);

    const draft = await this.prisma.generatedDraft.findUnique({
      where: { id: draftId },
    });
    if (!draft || !draft.polishedContent) throw new Error(`Draft ${draftId} or polishedContent not found`);

    const toneProfile = await this.prisma.toneProfile.findFirst({
      where: { name: { equals: tone, mode: "insensitive" } },
      include: { stepPersonalSocialPrompt: true },
    });

    const brandVariables = await resolveWorkspaceBrandVariables(this.prisma, draft.workspaceId);

    let systemPrompt = "You are a tech founder and leader. You write thoughtful, conversational thoughts on industry trends.";
    let userPrompt = `Create a 2-4 sentence first-person founder/leader social media share post based on the article content.
Requirements:
1. Written in first person ("I" or "we").
2. Thoughtful, conversational, and sharing a founder's perspective.
Return ONLY the post text.`;

    if (toneProfile?.stepPersonalSocialPrompt?.isActive) {
      const editorState = (draft.editorState as any) || {};
      const mergedVariables = {
        ...brandVariables,
        blogPostContent: draft.polishedContent,
        blogTitle: editorState.title || (draft as any).topicTitle || "",
        tone,
      };
      systemPrompt = interpolateTemplate(toneProfile.stepPersonalSocialPrompt.systemPrompt, mergedVariables);
      userPrompt = interpolateTemplate(toneProfile.stepPersonalSocialPrompt.template, mergedVariables);
    }

    const openAiKey = this.config.get<string>("OPENAI_API_KEY");
    const openai = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;

    const personalPost = await generateLlmCompletion({
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
        personalSocialPost: personalPost.trim(),
        status: "READY_FOR_REVIEW",
      },
    });

    this.logger.log(`Successfully completed entire sequential pipeline for Draft ${draftId}. Status set to READY_FOR_REVIEW.`);

    return { draftId, personalSocialPost: personalPost };
  }
}
