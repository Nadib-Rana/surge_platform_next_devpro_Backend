import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { formatHealthError } from "./error-formatter.util";

export async function checkIdeogram(configService: ConfigService) {
  const apiKey =
    configService.get<string>("IDEOGRAM_API_KEY") ||
    configService.get<string>("IDEOGRAM_API_TOKEN") ||
    configService.get<string>("IDEOGRAM_KEY");

  if (!apiKey) {
    return { valid: false, error: "IDEOGRAM_API_KEY is not configured in .env" };
  }

  try {
    const response = await axios.get("https://api.ideogram.ai/users/me", {
      headers: {
        "Api-Key": apiKey,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    return {
      valid: response.status >= 200 && response.status < 300,
      message: `Ideogram token validated successfully via profile audit. Status ${response.status}`,
      status: response.status,
    };
  } catch (error: any) {
    try {
      const fallbackRes = await axios.post(
        "https://api.ideogram.ai/generate",
        { prompt: "test", aspect_ratio: "1:1", model: "V_2" },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );
      return {
        valid: fallbackRes.status >= 200 && fallbackRes.status < 300,
        message: `Ideogram verified via generation pipeline. Status ${fallbackRes.status}`,
        status: fallbackRes.status,
      };
    } catch (fallbackError: any) {
      const formatted = formatHealthError(fallbackError);
      const isCreditIssue =
        formatted.toLowerCase().includes("credit") ||
        formatted.toLowerCase().includes("payment") ||
        formatted.toLowerCase().includes("402");
      return {
        valid: false,
        error: formatted,
        possibleReason: isCreditIssue
          ? "Ideogram platform subscription has expired or has insufficient credits."
          : "API endpoint changed, or invalid Ideogram API credential.",
      };
    }
  }
}
