import { Logger } from "@nestjs/common";
import OpenAI from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { type TextBlock } from "@anthropic-ai/sdk/resources/messages";

const logger = new Logger("AiPromptsLlmHelper");

export async function generateLlmCompletion(params: {
  selectedModel: string;
  systemPrompt: string;
  tone: string;
  articleContext: string;
  openai: OpenAI | null;
  anthropic: Anthropic | null;
  userPrompt?: string;
  overrideSystemPrompt?: string;
}): Promise<string> {
  const {
    selectedModel,
    systemPrompt,
    tone,
    articleContext,
    openai,
    anthropic,
    userPrompt,
    overrideSystemPrompt,
  } = params;

  try {
    if (selectedModel.startsWith("claude")) {
      if (anthropic) {
        return await invokeAnthropic(
          selectedModel,
          systemPrompt,
          tone,
          articleContext,
          anthropic,
          userPrompt,
          overrideSystemPrompt,
        );
      }
      if (openai) {
        logger.warn(
          `Anthropic client unavailable for ${selectedModel}. Cascading fallback to OpenAI gpt-4o.`,
        );
        return await invokeOpenAI(
          "gpt-4o",
          systemPrompt,
          tone,
          articleContext,
          openai,
          userPrompt,
          overrideSystemPrompt,
        );
      }
    } else {
      if (openai) {
        return await invokeOpenAI(
          selectedModel,
          systemPrompt,
          tone,
          articleContext,
          openai,
          userPrompt,
          overrideSystemPrompt,
        );
      }
      if (anthropic) {
        logger.warn(
          `OpenAI client unavailable for ${selectedModel}. Cascading fallback to Anthropic claude-3-5-sonnet.`,
        );
        return await invokeAnthropic(
          "claude-3-5-sonnet-20241022",
          systemPrompt,
          tone,
          articleContext,
          anthropic,
          userPrompt,
          overrideSystemPrompt,
        );
      }
    }
  } catch (err: any) {
    logger.error(
      `Primary LLM generation failed: ${err.message}. Triggering fallback circuit breaker.`,
    );

    if (selectedModel.startsWith("claude") && openai) {
      try {
        return await invokeOpenAI(
          "gpt-4o",
          systemPrompt,
          tone,
          articleContext,
          openai,
          userPrompt,
          overrideSystemPrompt,
        );
      } catch (fallbackErr: any) {
        logger.error(
          `Secondary OpenAI fallback failed: ${fallbackErr.message}`,
        );
      }
    } else if (!selectedModel.startsWith("claude") && anthropic) {
      try {
        return await invokeAnthropic(
          "claude-3-5-sonnet-20241022",
          systemPrompt,
          tone,
          articleContext,
          anthropic,
          userPrompt,
          overrideSystemPrompt,
        );
      } catch (fallbackErr: any) {
        logger.error(
          `Secondary Anthropic fallback failed: ${fallbackErr.message}`,
        );
      }
    }
  }

  logger.warn(
    "All LLM providers unavailable. Using rule-based fallback digest synthesizer.",
  );
  return generateRuleBasedFallbackDigest(articleContext, tone);
}

async function invokeOpenAI(
  model: string,
  systemPrompt: string,
  tone: string,
  articleContext: string,
  openai: OpenAI,
  userPrompt?: string,
  overrideSystemPrompt?: string,
): Promise<string> {
  const finalSystem =
    overrideSystemPrompt ??
    `${systemPrompt}\n\nTone: ${tone}\nRespond strictly in valid JSON format with keys: socialPlainText, blogPostContent, imagePrompt, hashtags.`;
  const finalUser =
    userPrompt ??
    `Create a single high-engagement social media digest from the raw articles below:\n\n${articleContext}`;

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.7,
    messages: [
      { role: "system", content: finalSystem },
      { role: "user", content: finalUser },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() || "";
}

async function invokeAnthropic(
  model: string,
  systemPrompt: string,
  tone: string,
  articleContext: string,
  anthropic: Anthropic,
  userPrompt?: string,
  overrideSystemPrompt?: string,
): Promise<string> {
  const finalSystem =
    overrideSystemPrompt ??
    `${systemPrompt}\n\nTone: ${tone}\nRespond strictly in valid JSON format with keys: socialPlainText, blogPostContent, imagePrompt, hashtags.`;
  const finalUser =
    userPrompt ??
    `Create a single high-engagement social media digest from the raw articles below:\n\n${articleContext}`;

  const completion = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    temperature: 0.7,
    system: finalSystem,
    messages: [{ role: "user", content: finalUser }],
  });
  const textBlock = completion.content.find(
    (item): item is TextBlock => item.type === "text",
  );
  return textBlock?.text.trim() || "";
}

function generateRuleBasedFallbackDigest(
  articleContext: string,
  tone: string,
): string {
  const snippet = articleContext.substring(0, 500).replace(/\s+/g, " ").trim();
  return JSON.stringify({
    socialPlainText: `🚀 [${tone.toUpperCase()} DIGEST] ${snippet}... #SurgeDigest #Automation`,
    blogPostContent: `<article><h2>Surge Automated Digest</h2><p>${snippet}</p></article>`,
    imagePrompt: `High quality conceptual image representing AI automation and digital publishing`,
    hashtags: ["SurgeDigest", "Automation", "AIContent"],
  });
}
