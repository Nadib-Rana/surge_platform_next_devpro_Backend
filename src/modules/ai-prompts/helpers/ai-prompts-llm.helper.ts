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
}): Promise<string> {
  const { selectedModel, systemPrompt, tone, articleContext, openai, anthropic } =
    params;

  try {
    if (selectedModel.startsWith("claude")) {
      if (anthropic) {
        return await invokeAnthropic(selectedModel, systemPrompt, tone, articleContext, anthropic);
      }
      if (openai) {
        logger.warn(`Anthropic client unavailable for ${selectedModel}. Cascading fallback to OpenAI gpt-4o.`);
        return await invokeOpenAI("gpt-4o", systemPrompt, tone, articleContext, openai);
      }
    } else {
      if (openai) {
        return await invokeOpenAI(selectedModel, systemPrompt, tone, articleContext, openai);
      }
      if (anthropic) {
        logger.warn(`OpenAI client unavailable for ${selectedModel}. Cascading fallback to Anthropic claude-3-5-sonnet.`);
        return await invokeAnthropic("claude-3-5-sonnet-20241022", systemPrompt, tone, articleContext, anthropic);
      }
    }
  } catch (err: any) {
    logger.error(`Primary LLM generation failed: ${err.message}. Triggering fallback circuit breaker.`);

    if (!selectedModel.startsWith("claude") && anthropic) {
      try {
        return await invokeAnthropic("claude-3-5-sonnet-20241022", systemPrompt, tone, articleContext, anthropic);
      } catch (fallbackErr: any) {
        logger.error(`Secondary Anthropic fallback failed: ${fallbackErr.message}`);
      }
    } else if (selectedModel.startsWith("claude") && openai) {
      try {
        return await invokeOpenAI("gpt-4o", systemPrompt, tone, articleContext, openai);
      } catch (fallbackErr: any) {
        logger.error(`Secondary OpenAI fallback failed: ${fallbackErr.message}`);
      }
    }
  }

  logger.warn("All LLM providers unavailable. Using rule-based fallback digest synthesizer.");
  return generateRuleBasedFallbackDigest(articleContext, tone);
}

async function invokeOpenAI(
  model: string,
  systemPrompt: string,
  tone: string,
  articleContext: string,
  openai: OpenAI,
): Promise<string> {
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.7,
    messages: [
      { role: "system", content: `${systemPrompt}\n\nTone: ${tone}\nRespond strictly in valid JSON format with keys: socialPlainText, wordpressHtmlContent, imagePrompt, hashtags.` },
      { role: "user", content: `Create a single high-engagement social media digest from the raw articles below:\n\n${articleContext}` },
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
): Promise<string> {
  const completion = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    temperature: 0.7,
    system: `${systemPrompt}\n\nTone: ${tone}\nRespond strictly in valid JSON format with keys: socialPlainText, wordpressHtmlContent, imagePrompt, hashtags.`,
    messages: [
      { role: "user", content: `Create a single high-engagement social media digest from the raw articles below:\n\n${articleContext}` },
    ],
  });
  const textBlock = completion.content.find((item): item is TextBlock => item.type === "text");
  return textBlock?.text.trim() || "";
}

function generateRuleBasedFallbackDigest(articleContext: string, tone: string): string {
  const snippet = articleContext.substring(0, 500).replace(/\s+/g, " ").trim();
  return JSON.stringify({
    socialPlainText: `🚀 [${tone.toUpperCase()} DIGEST] ${snippet}... #SurgeDigest #Automation`,
    wordpressHtmlContent: `<article><h2>Surge Automated Digest</h2><p>${snippet}</p></article>`,
    imagePrompt: `High quality conceptual image representing AI automation and digital publishing`,
    hashtags: ["SurgeDigest", "Automation", "AIContent"],
  });
}
