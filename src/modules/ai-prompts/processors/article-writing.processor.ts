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
export class ArticleWritingProcessor {
  private readonly logger = new Logger(ArticleWritingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue("content-generation-queue") private readonly queue: Queue,
  ) { }

  async process(job: Job<any>) {
    const { groupId, toneProfileId, model = "gpt-4o", tone = "professional" } = job.data;
    this.logger.log(`Running Article Writing for group: ${groupId}`);

    const group = await this.prisma.articleGroup.findUnique({
      where: { id: groupId },
      include: { rawPosts: true },
    });
    if (!group) throw new Error(`Article Group ${groupId} not found`);

    const toneProfile = toneProfileId
      ? await this.prisma.toneProfile.findUnique({
          where: { id: toneProfileId },
          include: { stepOneRawDraftPrompt: true },
        })
      : await this.prisma.toneProfile.findFirst({
          where: { name: { equals: tone, mode: "insensitive" } },
          include: { stepOneRawDraftPrompt: true },
        });

    const brandVariables = await resolveWorkspaceBrandVariables(this.prisma, group.workspaceId);

    let systemPrompt = "You are an expert copywriter. You follow structural guidelines and length boundaries strictly.";
    let userPrompt = `Write a structured blog article based on the following theme and editorial angle.
Theme: ${group.sharedTheme}
Angle: ${group.editorialAngle}

Requirements:
- Length: 800 - 1200 words.
- Format: HTML/Markdown.
- Title: <= 8 words.
- Specific section rules: Include Introduction, Main Insights, Case Study / Examples, and Conclusion.
- Banned phrases: Do not use generic AI transitional phrases.

Return a JSON response with keys: title, blogPostContent.`;

    const contextStr = `Theme: ${group.sharedTheme}\nAngle: ${group.editorialAngle}`;
    const rawPosts = group.rawPosts || [];

    if (toneProfile?.stepOneRawDraftPrompt?.isActive) {
      const mergedVariables = {
        ...brandVariables,
        articleContext: contextStr,
        theme: group.sharedTheme,
        sharedTheme: group.sharedTheme,
        angle: group.editorialAngle,
        editorialAngle: group.editorialAngle,
        articleUrls: rawPosts.map((p: any) => p.url || p.urlHash).filter(Boolean).join(", "),
        articleTitles: rawPosts.map((p) => p.title).filter(Boolean).join(", "),
        articleSources: rawPosts.map((p) => p.sourceName || "Source").filter(Boolean).join(", "),
        articleCount: String(rawPosts.length),
      };
      systemPrompt = interpolateTemplate(toneProfile.stepOneRawDraftPrompt.systemPrompt, mergedVariables);
      userPrompt = interpolateTemplate(toneProfile.stepOneRawDraftPrompt.template, mergedVariables);
    }

    const openAiKey = this.config.get<string>("OPENAI_API_KEY");
    const openai = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;

    const llmOutput = await generateLlmCompletion({
      selectedModel: model,
      systemPrompt,
      tone,
      articleContext: contextStr,
      openai,
      anthropic: null,
      userPrompt,
    });

    let parsed: { title: string; blogPostContent: string };
    try {
      const cleaned = extractJsonString(llmOutput);
      parsed = JSON.parse(cleaned);
      if (!parsed.blogPostContent) {
        throw new Error("Missing blogPostContent in LLM output");
      }
    } catch (parseErr: any) {
      this.logger.warn(`Article writing JSON parse warning: ${parseErr.message}. Using full LLM text.`);
      parsed = {
        title: group.sharedTheme || "Generated Article",
        blogPostContent: llmOutput,
      };
    }

    const draft = await this.prisma.generatedDraft.create({
      data: {
        workspaceId: group.workspaceId,
        toneProfileId,
        groupId,
        status: "RAW_DRAFT",
        rawContent: parsed.blogPostContent,
        blogPostContent: parsed.blogPostContent, // legacy map
        editorState: { title: parsed.title },
        generationType: "batch_digest",
      },
    });

    // Chain next task
    await this.queue.add("article-polishing", {
      draftId: draft.id,
      model,
      tone,
    });

    this.logger.log(`Completed Raw Article Writing for Draft ${draft.id}. Enqueued article-polishing.`);

    return { draftId: draft.id };
  }
}
