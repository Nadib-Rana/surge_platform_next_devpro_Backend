import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/context/prisma.service";
import { generateLlmCompletion } from "../helpers/ai-prompts-llm.helper";
import { interpolateTemplate, resolveWorkspaceBrandVariables } from "../helpers/ai-prompts-digest.helper";
import { extractJsonString } from "../helpers/ai-prompts-parser.util";
import OpenAI from "openai";
import { ConfigService } from "@nestjs/config";
import { Job, Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";

@Injectable()
export class ArticleGroupingProcessor {
  private readonly logger = new Logger(ArticleGroupingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue("content-generation-queue") private readonly queue: Queue,
  ) {}

  async process(job: Job<any>) {
    const { workspaceId, limit = 5, tone = "professional", model = "gpt-4o" } = job.data;
    this.logger.log(`Running Article Grouping for workspace: ${workspaceId}`);

    try {
      const posts = await this.prisma.rawPostsBuffer.findMany({
        where: { workspaceId, status: "buffered" },
        take: limit,
      });

      if (posts.length < 2) {
        this.logger.warn(`Insufficient articles to group. Found: ${posts.length}`);
        return { skipped: true, reason: "Insufficient articles to group" };
      }

      let toneProfile: any = null;
      try {
        toneProfile = await this.prisma.toneProfile.findFirst({
          where: {
            OR: [
              { id: tone },
              { name: { equals: tone, mode: "insensitive" } },
            ],
          },
          include: { stepGroupingPrompt: true },
        });
      } catch {
        // Fallback gracefully
      }

      const brandVariables = await resolveWorkspaceBrandVariables(
        this.prisma,
        workspaceId,
        tone,
      );

      const context = posts
        .map((p, idx) => `[Article ${idx + 1}] Title: ${p.title}\nContent: ${p.rawContent}`)
        .join("\n\n");

      let systemPrompt = "You are an Article Grouping Bot. Categorize, cluster, and find the editorial link.";
      let userPrompt = `Analyze these articles and group them. Output a JSON with keys: sharedTheme (max 10 words) and editorialAngle (2-3 sentences explaining perspective).`;

      if (toneProfile?.stepGroupingPrompt?.isActive) {
        const mergedVariables = {
          ...brandVariables,
          articleContext: context,
        };
        systemPrompt = interpolateTemplate(toneProfile.stepGroupingPrompt.systemPrompt, mergedVariables);
        userPrompt = interpolateTemplate(toneProfile.stepGroupingPrompt.template, mergedVariables);
      }

      const openAiKey = this.config.get<string>("OPENAI_API_KEY");
      const openai = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;

      const llmOutput = await generateLlmCompletion({
        selectedModel: model,
        systemPrompt,
        tone,
        articleContext: context,
        openai,
        anthropic: null,
        userPrompt,
      });

      let parsed: { sharedTheme: string; editorialAngle: string };
      try {
        const cleaned = extractJsonString(llmOutput);
        parsed = JSON.parse(cleaned);
        if (!parsed.sharedTheme || !parsed.editorialAngle) {
          throw new Error("Missing required keys in LLM output");
        }
      } catch (parseErr: any) {
        this.logger.warn(`LLM JSON parse warning: ${parseErr.message}. Extracting fallback theme and angle.`);
        const cleanText = llmOutput.replace(/^Sure[!\.,]?\s*/i, "").trim();
        parsed = {
          sharedTheme: cleanText.split("\n")[0]?.substring(0, 80) || "Featured Article Group",
          editorialAngle: cleanText.substring(0, 300) || "Analysis of recent workspace articles.",
        };
      }

      const group = await this.prisma.articleGroup.create({
        data: {
          workspaceId,
          sharedTheme: parsed.sharedTheme,
          editorialAngle: parsed.editorialAngle,
          articleUrls: posts.map((p) => p.urlHash),
          articleTitles: posts.map((p) => p.title),
          articleSources: posts.map((p) => p.sourceName || "Unknown"),
          articleCount: posts.length,
        },
      });

      await this.prisma.rawPostsBuffer.updateMany({
        where: { id: { in: posts.map((p) => p.id) } },
        data: { status: "processing", groupId: group.id },
      });

      // Chain next task
      await this.queue.add("article-writing", {
        groupId: group.id,
        toneProfileId: toneProfile?.id || tone,
        model,
        tone,
      });

      this.logger.log(`Completed Article Grouping for workspace ${workspaceId}. Created Group ${group.id}.`);

      return { groupId: group.id, count: posts.length };
    } catch (err: any) {
      this.logger.error(`Article Grouping failed for workspace ${workspaceId}: ${err.message}`, err.stack);
      throw err;
    }
  }
}
