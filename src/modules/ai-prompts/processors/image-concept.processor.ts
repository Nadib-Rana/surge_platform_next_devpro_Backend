import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/context/prisma.service";
import { generateLlmCompletion } from "../helpers/ai-prompts-llm.helper";
import { interpolateTemplate, resolveWorkspaceBrandVariables } from "../helpers/ai-prompts-digest.helper";
import { extractJsonString } from "../helpers/ai-prompts-parser.util";
import OpenAI from "openai";
import { ConfigService } from "@nestjs/config";
import { Job, Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";

@Injectable()
export class ImageConceptProcessor {
  private readonly logger = new Logger(ImageConceptProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue("content-generation-queue") private readonly queue: Queue,
  ) { }

  async process(job: Job<any>) {
    const { draftId, model = "gpt-4o", tone = "professional" } = job.data;
    this.logger.log(`Generating cartoon concept for Draft: ${draftId}`);

    const draft = await this.prisma.generatedDraft.findUnique({
      where: { id: draftId },
    });
    if (!draft || !draft.polishedContent) throw new Error(`Draft ${draftId} or polishedContent not found`);

    const toneProfile = await this.prisma.toneProfile.findFirst({
      where: { name: { equals: tone, mode: "insensitive" } },
      include: { stepThreeImagePrompt: true },
    });

    const brandVariables = await resolveWorkspaceBrandVariables(this.prisma, draft.workspaceId);

    let systemPrompt = "You are an art director and humorist. You design classic New Yorker style monochrome cartoons.";
    let userPrompt = `Read the following article and generate a New Yorker style cartoon concept representing the theme.
Provide a JSON response with keys:
1. imagePrompt (A clear description of the drawing context/prompt).
2. negativeConstraints (Things to avoid, e.g. "color", "hyperrealistic", "complex borders").
3. caption (The witty cartoon text caption/dialogue at the bottom).`;

    if (toneProfile?.stepThreeImagePrompt?.isActive) {
      const editorState = (draft.editorState as any) || {};
      const mergedVariables = {
        ...brandVariables,
        blogPostContent: draft.polishedContent,
        blogTitle: editorState.title || (draft as any).topicTitle || "",
      };
      systemPrompt = interpolateTemplate(toneProfile.stepThreeImagePrompt.systemPrompt, mergedVariables);
      userPrompt = interpolateTemplate(toneProfile.stepThreeImagePrompt.template, mergedVariables);
    }

    const openAiKey = this.config.get<string>("OPENAI_API_KEY");
    const openai = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;

    const llmOutput = await generateLlmCompletion({
      selectedModel: model,
      systemPrompt,
      tone: "witty",
      articleContext: draft.polishedContent,
      openai,
      anthropic: null,
      userPrompt,
    });

    let parsed: { imagePrompt: string; negativeConstraints: string; caption: string };
    try {
      const cleaned = extractJsonString(llmOutput);
      parsed = JSON.parse(cleaned);
      if (!parsed.imagePrompt) {
        throw new Error("Missing imagePrompt in LLM output");
      }
    } catch (parseErr: any) {
      this.logger.warn(`Image concept JSON parse warning: ${parseErr.message}. Using fallback concept.`);
      parsed = {
        imagePrompt: llmOutput.substring(0, 300),
        negativeConstraints: "photo, color, realistic",
        caption: "Editorial Cartoon",
      };
    }

    await this.prisma.generatedDraft.update({
      where: { id: draftId },
      data: {
        imageConcept: parsed.imagePrompt,
        negativeConstraints: parsed.negativeConstraints,
        imageCaption: parsed.caption,
      },
    });

    // Chain next task
    await this.queue.add("image-generation", {
      draftId,
      model,
      tone,
    });

    this.logger.log(`Completed Image Concept generation for Draft ${draftId}. Enqueued image-generation.`);

    return { draftId, concept: parsed };
  }
}
