import { ConfigService } from "@nestjs/config";
import { formatHealthError } from "./error-formatter.util";

export async function checkAnthropic(configService: ConfigService) {
  const apiKey = configService.get<string>("ANTHROPIC_API_KEY");

  if (!apiKey) {
    return { valid: false, error: "ANTHROPIC_API_KEY is not configured in .env" };
  }

  const targetModel = "claude-3-haiku-20240307";

  try {
    const { Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: targetModel,
      max_tokens: 5,
      messages: [{ role: "user", content: "ok" }],
    });

    return {
      valid: true,
      message: "Anthropic message generation succeeded",
      modelUsed: targetModel,
      tokenUsage: message.usage || "N/A",
    };
  } catch (error: any) {
    const formatted = formatHealthError(error);
    const isQuotaError =
      formatted.toLowerCase().includes("credit") ||
      formatted.toLowerCase().includes("quota") ||
      formatted.toLowerCase().includes("balance");
    return {
      valid: false,
      error: formatted,
      possibleReason: isQuotaError
        ? "Anthropic balance is $0. Please top up your Anthropic Console."
        : `Check if the API Key is correct and has permission for '${targetModel}'`,
    };
  }
}
