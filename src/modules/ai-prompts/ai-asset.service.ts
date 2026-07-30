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
    toneProfileId?: string;
  }) {
    const apiKey = this.configService.get<string>("OPENAI_API_KEY");
    if (!apiKey) {
      this.logger.error(
        `Image generation cannot start: OPENAI_API_KEY is not configured (workspaceId=${dto.workspaceId})`,
      );
      throw new InternalServerErrorException(
        "OPENAI_API_KEY is not configured",
      );
    }

    let buffer: Buffer;
    let usedFallback = false;
    const model = "dall-e-3";

    this.logger.log(
      `Image generation started (workspaceId=${dto.workspaceId}, model=${model})`,
    );

    try {
      const client = new OpenAI({ apiKey });

      this.logger.log(
        `Sending image generation request to OpenAI (workspaceId=${dto.workspaceId}, model=${model})`,
      );
      const imageResponse = await client.images.generate({
        model,
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

      this.logger.log(
        `OpenAI image created; downloading generated asset (workspaceId=${dto.workspaceId}, model=${model})`,
      );
      buffer = await this.downloadToBuffer(imageUrl);
      this.logger.log(
        `Generated image downloaded (workspaceId=${dto.workspaceId}, bytes=${buffer.length})`,
      );
    } catch (error) {
      usedFallback = true;
      this.logger.warn(
        `OpenAI image generation failed; using fallback PNG (workspaceId=${dto.workspaceId}, model=${model}, issue=${this.formatError(error)})`,
      );
      buffer = this.createFallbackPngBuffer();
    }

    const objectName = `workspaces/${dto.workspaceId}/assets/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

    this.logger.log(
      `Uploading image asset to storage (workspaceId=${dto.workspaceId}, objectName=${objectName}, fallback=${usedFallback})`,
    );

    let presignedUrl: string;
    try {
      presignedUrl = await this.storageService.uploadBuffer(
        objectName,
        buffer,
        "image/png",
      );
    } catch (error) {
      this.logger.error(
        `Image asset upload failed (workspaceId=${dto.workspaceId}, objectName=${objectName}, issue=${this.formatError(error)})`,
      );
      throw error;
    }

    this.logger.log(
      `Image asset process completed (workspaceId=${dto.workspaceId}, objectName=${objectName}, provider=${usedFallback ? "local-fallback" : "openai"}, fallback=${usedFallback})`,
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
    if (error && typeof error === "object") {
      const details = error as {
        message?: unknown;
        status?: unknown;
        code?: unknown;
        type?: unknown;
        request_id?: unknown;
      };
      const parts = [
        ["message", details.message],
        ["status", details.status],
        ["code", details.code],
        ["type", details.type],
        ["requestId", details.request_id],
      ]
        .filter((entry) => entry[1] !== undefined && entry[1] !== null)
        .map(([key, value]) => `${key}=${String(value)}`);

      if (parts.length) {
        return parts.join(", ");
      }
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
