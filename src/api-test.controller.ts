import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

@Controller("api-test")
export class ApiTestController {
  constructor(private readonly configService: ConfigService) {}

  @Get("credentials")
  async checkCredentials() {
    const report = {
      timestamp: new Date().toISOString(),
      services: {
        openai: await this.checkOpenAi(),
        anthropic: await this.checkAnthropic(),
        ideogram: await this.checkIdeogram(),
        stripe: await this.checkStripe(),
      },
    };

    return report;
  }

  private async checkOpenAi() {
    const apiKey = this.configService.get<string>("OPENAI_API_KEY");

    if (!apiKey) {
      return { valid: false, error: "OPENAI_API_KEY is not configured" };
    }

    try {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey });
      await client.models.list();

      return { valid: true, message: "OpenAI models list succeeded" };
    } catch (error) {
      return { valid: false, error: this.formatError(error) };
    }
  }

  private async checkAnthropic() {
    const apiKey = this.configService.get<string>("ANTHROPIC_API_KEY");

    if (!apiKey) {
      return { valid: false, error: "ANTHROPIC_API_KEY is not configured" };
    }

    try {
      const { Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: "claude-3-5-haiku-latest",
        max_tokens: 16,
        messages: [{ role: "user", content: "hi" }],
      });

      return { valid: true, message: "Anthropic message create succeeded" };
    } catch (error) {
      return { valid: false, error: this.formatError(error) };
    }
  }

  private async checkIdeogram() {
    const apiKey =
      this.configService.get<string>("IDEOGRAM_API_KEY") ||
      this.configService.get<string>("IDEOGRAM_API_TOKEN") ||
      this.configService.get<string>("IDEOGRAM_KEY");

    if (!apiKey) {
      return { valid: false, error: "IDEOGRAM_API_KEY is not configured" };
    }

    try {
      const response = await axios.post(
        "https://api.ideogram.ai/generate",
        {
          prompt: "test",
          aspect_ratio: "1:1",
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      return {
        valid: response.status >= 200 && response.status < 300,
        message: `Ideogram request returned ${response.status}`,
        status: response.status,
      };
    } catch (error) {
      return { valid: false, error: this.formatError(error) };
    }
  }

  private async checkStripe() {
    const apiKey = this.configService.get<string>("STRIPE_SECRET_KEY");

    if (!apiKey) {
      return { valid: false, error: "STRIPE_SECRET_KEY is not configured" };
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
        message: `Stripe account lookup returned ${response.status}`,
        status: response.status,
      };
    } catch (error) {
      return { valid: false, error: this.formatError(error) };
    }
  }

  private formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      return (
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message
      );
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "Unknown error";
  }
}
