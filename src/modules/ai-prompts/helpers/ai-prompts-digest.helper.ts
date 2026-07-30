import { BadRequestException, NotFoundException } from "@nestjs/common";
import OpenAI from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { PrismaService } from "../../../common/context/prisma.service";
import { GeneratedDraftsService } from "../../generated-drafts/generated-drafts.service";
import { AiAssetService } from "../ai-asset.service";
import { GenerateBatchDigestDto } from "../dto/generate-batch-digest.dto";
import { generateLlmCompletion } from "./ai-prompts-llm.helper";
import { stripMarkdownFences, sleep } from "./ai-prompts-parser.util";

export function interpolateTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  if (!template) return "";
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    const lowerKey = key.toLowerCase();
    const foundKey = Object.keys(variables).find(
      (k) => k.toLowerCase() === lowerKey,
    );
    return foundKey ? variables[foundKey] : match;
  });
}

export async function checkPerspectiveToxicity(
  content: string,
  apiKey: string | null,
): Promise<void> {
  if (!apiKey) {
    // Basic local fallback safety check for toxicity if no API key is set
    const toxicWords = ["abuse", "hate speech", "violence", "threat", "harass"];
    const containsToxic = toxicWords.some((word) =>
      content.toLowerCase().includes(word),
    );
    if (containsToxic) {
      throw new BadRequestException(
        "Content failed safety checks (local check detects sensitive words)",
      );
    }
    return;
  }

  try {
    const url = `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`;
    const response = await axios.post(url, {
      comment: { text: content },
      languages: ["en"],
      requestedAttributes: { TOXICITY: {} },
    });

    const toxicityScore =
      response.data?.attributeScores?.TOXICITY?.summaryScore?.value;
    if (toxicityScore !== undefined && toxicityScore > 0.7) {
      throw new BadRequestException(
        `Content failed safety checks (Toxicity Score: ${toxicityScore})`,
      );
    }
  } catch (error: any) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    console.warn(`Perspective API validation request failed: ${error.message}`);
  }
}

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
