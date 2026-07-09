import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StorageService } from "../storage/storage.service";
import https from "https";
import OpenAI from "openai";

@Injectable()
export class AiAssetService {
  private readonly logger = new Logger(AiAssetService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {}

  async generateImageFromDigest(dto: {
    workspaceId: string;
    digestText: string;
    promptVersionId: string;
  }) {
    const apiKey = this.configService.get<string>("OPENAI_API_KEY");
    if (!apiKey) {
      throw new InternalServerErrorException(
        "OPENAI_API_KEY is not configured",
      );
    }

    let buffer: Buffer;
    let usedFallback = false;

    try {
      const client = new OpenAI({ apiKey });

      const imageResponse = await client.images.generate({
        model: "dall-e-3",
        prompt: `Create a vivid social media hero image for the following digest. Keep it polished, brand-safe, and visually rich: ${dto.digestText}`,
        size: "1024x1024",
        quality: "standard",
        n: 1,
      });

      const imageUrl = imageResponse.data?.[0]?.url;
      if (!imageUrl) {
        throw new InternalServerErrorException(
          "DALL-E 3 did not return an image URL",
        );
      }

      buffer = await this.downloadToBuffer(imageUrl);
    } catch (error) {
      usedFallback = true;
      this.logger.warn(
        `DALL-E image generation failed; uploading fallback PNG asset instead. ${this.formatError(error)}`,
      );
      buffer = this.createFallbackPngBuffer();
    }

    const objectName = `workspaces/${dto.workspaceId}/assets/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

    const presignedUrl = await this.storageService.uploadBuffer(
      objectName,
      buffer,
      "image/png",
    );

    return {
      imageUrl: presignedUrl,
      objectName,
      bucketName:
        this.configService.get<string>("MINIO_BUCKET") ?? "surge-assets",
      provider: "openai",
      usedFallback,
    };
  }

  private createFallbackPngBuffer() {
    return Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    );
  }

  private formatError(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private async downloadToBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      https
        .get(url, (response) => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(
              new InternalServerErrorException(
                `Image download failed with status ${response.statusCode}`,
              ),
            );
            return;
          }

          const chunks: Uint8Array[] = [];
          response.on("data", (chunk) =>
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
          );
          response.on("end", () => resolve(Buffer.concat(chunks)));
          response.on("error", reject);
        })
        .on("error", reject);
    });
  }
}
