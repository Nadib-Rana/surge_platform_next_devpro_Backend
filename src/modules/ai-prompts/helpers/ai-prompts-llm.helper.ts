import { InternalServerErrorException } from "@nestjs/common";
import OpenAI from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { type TextBlock } from "@anthropic-ai/sdk/resources/messages";

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
  let digestText = "Batch digest generation completed.";

  if (selectedModel.startsWith("claude")) {
    if (!anthropic) {
      throw new InternalServerErrorException(
        "ANTHROPIC_API_KEY is not configured",
      );
    }

    const completion = await anthropic.messages.create({
      model: selectedModel,
      max_tokens: 1024,
      temperature: 0.8,
      system: `${systemPrompt}\n\nTone: ${tone}`,
      messages: [
        {
          role: "user",
          content: `Create a single, high-engagement social media digest from the following raw articles. Preserve the key points, keep it concise, and make it ready for posting.\n\n${articleContext}`,
        },
      ],
    });

    const textBlock = completion.content.find(
      (item): item is TextBlock => item.type === "text",
    );
    digestText = textBlock?.text.trim() || digestText;
  } else {
    if (!openai) {
      throw new InternalServerErrorException(
        "OPENAI_API_KEY is not configured",
      );
    }

    const completion = await openai.chat.completions.create({
      model: selectedModel,
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\nTone: ${tone}`,
        },
        {
          role: "user",
          content: `Create a single, high-engagement social media digest from the following raw articles. Preserve the key points, keep it concise, and make it ready for posting.\n\n${articleContext}`,
        },
      ],
    });

    digestText = completion.choices[0]?.message?.content?.trim() ?? digestText;
  }

  return digestText;
}
