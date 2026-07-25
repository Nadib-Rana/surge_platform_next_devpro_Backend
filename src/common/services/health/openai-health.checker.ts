import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { formatHealthError } from "./error-formatter.util";

export async function checkOpenAi(configService: ConfigService) {
  const apiKey = configService.get<string>("OPENAI_API_KEY");

  if (!apiKey) {
    return { valid: false, error: "OPENAI_API_KEY is not configured in .env" };
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });

    await client.models.list();

    let billingInfo = "Could not fetch usage details";
    let isOutOfCredit = false;
    try {
      const billingRes = await axios.get(
        "https://api.openai.com/v1/dashboard/billing/subscription",
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );
      if (billingRes.data) {
        billingInfo = `Plan: ${billingRes.data.plan?.title || "N/A"}. Hard Limit: $${billingRes.data.hard_limit_usd || 0}`;
      }
    } catch (bErr: any) {
      if (bErr.response?.status === 401 || bErr.response?.status === 403) {
        billingInfo =
          "Billing retrieval unauthorized - Check if key is expired/invalid";
      } else if (bErr.response?.data?.error?.code === "insufficient_quota") {
        isOutOfCredit = true;
        billingInfo = "CRITICAL: Insufficient Quota! (Out of credit/balance)";
      }
    }

    return {
      valid: !isOutOfCredit,
      message: isOutOfCredit
        ? "OpenAI API Key is valid, but you have OUT OF CREDIT/INSUFFICIENT QUOTA."
        : "OpenAI connection succeeded",
      billing: billingInfo,
      hasDalle3Support: true,
    };
  } catch (error: any) {
    const formatted = formatHealthError(error);
    const isQuotaError =
      formatted.toLowerCase().includes("quota") ||
      formatted.toLowerCase().includes("credit");
    return {
      valid: false,
      error: formatted,
      possibleReason: isQuotaError
        ? "Your OpenAI billing card was declined or your usage limit/credits expired."
        : "Invalid API key or network restriction",
    };
  }
}
