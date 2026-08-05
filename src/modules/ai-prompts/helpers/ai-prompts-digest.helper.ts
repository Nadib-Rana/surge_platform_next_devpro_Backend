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

  const normalizeKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");

  const pattern = /\{\{\s*([^}]+)\s*\}\}|\[\s*([^\]]+)\s*\]/g;

  return template.replace(pattern, (match, curlyKey, bracketKey) => {
    const rawKey = (curlyKey || bracketKey || "").trim();
    if (!rawKey) return match;

    const normKey = normalizeKey(rawKey);

    let foundKey = Object.keys(variables).find(
      (k) => normalizeKey(k) === normKey,
    );

    if (!foundKey) {
      if (normKey === "companybrandname" || normKey === "brandname" || normKey === "companyname") {
        foundKey = Object.keys(variables).find((k) => {
          const nk = normalizeKey(k);
          return nk === "companyname" || nk === "companybrandname" || nk === "brandname";
        });
      } else if (normKey === "companywebsite" || normKey === "website") {
        foundKey = Object.keys(variables).find((k) => {
          const nk = normalizeKey(k);
          return nk === "companywebsite" || nk === "website";
        });
      }
    }

    if (foundKey && variables[foundKey] !== undefined) {
      return variables[foundKey];
    }

    return match;
  });

}

export async function resolveWorkspaceBrandVariables(
  prisma: any,
  workspaceId: string,
  overrideTone?: string,
): Promise<Record<string, string>> {
  if (!workspaceId) return {};

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        company: {
          include: {
            owner: true,
          },
        },
      },
    });

    if (!workspace) return {};

    const queueConfig = (workspace.queueConfig as any) || {};
    const company = workspace.company || {};
    const owner = company.owner || {};

    const companyName = company.name || workspace.name || "Company";
    const companyWebsite = queueConfig.website || queueConfig.companyWebsite || "https://example.com";
    const industry = queueConfig.industry || "Industry";
    const brandTopicList = queueConfig.brandTopicList || queueConfig.topics || "Industry News & Insights";
    const businessContentFocusArea = queueConfig.businessContentFocusArea || queueConfig.focusArea || "Strategic Insights";
    const businessAudience = queueConfig.targetAudience || queueConfig.businessAudience || "Business Audience";
    let brandVoice =
      overrideTone ||
      queueConfig.brandVoice ||
      queueConfig.writingTone ||
      queueConfig.toneProfileId ||
      "Professional, Analytical, Concise";

    // If a toneProfileId or UUID is stored, resolve its prompt description / name from DB
    if (
      queueConfig.toneProfileId ||
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        brandVoice,
      )
    ) {
      const targetId = queueConfig.toneProfileId || brandVoice;
      try {
        const tp = await prisma.toneProfile.findUnique({
          where: { id: targetId },
        });
        if (tp) {
          brandVoice = tp.promptDescription || tp.name;
        }
      } catch {
        // Fallback to raw string
      }
    } else {
      // Check if brandVoice matches a ToneProfile name in DB
      try {
        const tpByName = await prisma.toneProfile.findFirst({
          where: { name: brandVoice },
        });
        if (tpByName?.promptDescription) {
          brandVoice = tpByName.promptDescription;
        }
      } catch {
        // Fallback to raw string
      }
    }

    const editorialRules = Array.isArray(queueConfig.editorialRules)
      ? queueConfig.editorialRules.join(", ")
      : queueConfig.editorialRules || "None";
    const fullName = owner.fullName || owner.name || "Founder";
    const roleTitle = queueConfig.roleTitle || owner.role || "Founder & CEO";

    return {
      companyName,
      companyBrandName: companyName,
      "company/brand name": companyName,
      companyWebsite,
      "company website": companyWebsite,
      industry,
      brandTopicList,
      "brand topic list": brandTopicList,
      businessContentFocusArea,
      "business content focus area": businessContentFocusArea,
      businessAudience,
      "business audience": businessAudience,
      targetAudience: businessAudience,
      "target audience": businessAudience,
      brandVoice,
      "brand voice": brandVoice,
      writingTone: brandVoice,
      "writing tone": brandVoice,
      editorialRules,
      "editorial rules": editorialRules,
      excludedTopics: editorialRules,
      "excluded topics": editorialRules,
      fullName,
      "full name": fullName,
      roleTitle,
      "role/title": roleTitle,
    };
  } catch (error) {
    return {};
  }
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
