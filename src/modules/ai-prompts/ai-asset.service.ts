import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/context/prisma.service";
import { StorageService } from "../storage/storage.service";
import https from "https";

@Injectable()
export class AiAssetService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
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

    const openai = (await import("openai")).default;
    const client = new openai({ apiKey });

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

    const buffer = await this.downloadToBuffer(imageUrl);
    const objectName = `workspaces/${dto.workspaceId}/assets/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

    const presignedUrl = await this.storageService.uploadBuffer(
      objectName,
      buffer,
      "image/png",
    );

    await this.prisma.generatedDraft.updateMany({
      where: {
        workspaceId: dto.workspaceId,
        promptVersionId: dto.promptVersionId,
        status: "pending",
      },
      data: { imageUrl: presignedUrl },
    });

    return {
      imageUrl: presignedUrl,
      objectName,
      bucketName:
        this.configService.get<string>("MINIO_BUCKET") ?? "surge-assets",
    };
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

          const chunks: Buffer[] = [];
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
