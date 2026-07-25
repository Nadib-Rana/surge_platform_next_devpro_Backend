import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { formatHealthError } from "./error-formatter.util";

export async function checkStripe(configService: ConfigService) {
  const apiKey = configService.get<string>("STRIPE_SECRET_KEY");

  if (!apiKey) {
    return { valid: false, error: "STRIPE_SECRET_KEY is not configured in .env" };
  }

  try {
    const response = await axios.get("https://api.stripe.com/v1/account", {
      auth: {
        username: apiKey,
        password: "",
      },
    });

    return {
      valid: response.status >= 200 && response.status < 300,
      message: `Stripe connection active. Connected business: ${response.data?.business_profile?.name || "Generic"}`,
      currency: response.data?.default_currency || "usd",
      status: response.status,
    };
  } catch (error: any) {
    const formatted = formatHealthError(error);
    return {
      valid: false,
      error: formatted,
      possibleReason:
        "The Stripe Secret Key is invalid, restricted, or has been revoked in Stripe Dashboard.",
    };
  }
}
