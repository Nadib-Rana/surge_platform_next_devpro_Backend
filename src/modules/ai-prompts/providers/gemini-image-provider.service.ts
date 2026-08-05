import { Injectable, Logger, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class GeminiImageProvider {
  private readonly logger = new Logger(GeminiImageProvider.name);

  constructor(private readonly config: ConfigService) {}

  async generateImage(params: {
    prompt: string;
    negativeConstraints?: string;
    temperature?: number;
  }): Promise<Buffer> {
    const apiKey = this.config.get<string>("GEMINI_API_KEY") || this.config.get<string>("OPENAI_API_KEY"); // Fallback check
    if (!apiKey) {
      this.logger.error("GEMINI_API_KEY is not configured.");
      throw new InternalServerErrorException("GEMINI_API_KEY is not configured");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key=${apiKey}`;

    const payload = {
      prompt: params.prompt,
      numberOfImages: 1,
      outputMimeType: "image/png",
      aspectRatio: "1:1",
      parameters: {
        negativePrompt: params.negativeConstraints || "",
        temperature: params.temperature ?? 0.4, // Strict Temp 0.4
      },
    };

    try {
      this.logger.log(
        `Sending request to Gemini Imagen API (Prompt: "${params.prompt.substring(0, 60)}...", Temp: ${payload.parameters.temperature})`,
      );

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini Imagen API error (Status ${response.status}): ${errorText}`);
      }

      const result = (await response.json()) as {
        generatedImages?: Array<{ image?: { imageBytes?: string } }>;
      };

      const base64Image = result.generatedImages?.[0]?.image?.imageBytes;
      if (!base64Image) {
        throw new Error("No image bytes returned from Gemini Imagen API");
      }

      return Buffer.from(base64Image, "base64");
    } catch (err: any) {
      this.logger.error(`Failed to generate image via Gemini Imagen: ${err.message}`);
      throw new InternalServerErrorException(`Gemini image generation failed: ${err.message}`);
    }
  }
}
