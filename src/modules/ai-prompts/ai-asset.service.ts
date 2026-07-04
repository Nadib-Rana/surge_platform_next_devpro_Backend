import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/context/prisma.service";
import { Client as MinioClient } from "minio";
import { Readable } from "stream";
import https from "https";

@Injectable()
export class AiAssetService {
  private readonly minio: MinioClient;
  private readonly bucketName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.minio = new MinioClient({
      endPoint: this.configService.get<string>("MINIO_ENDPOINT") ?? "127.0.0.1",
      port: Number(this.configService.get<string>("MINIO_PORT") ?? 9000),
      useSSL: this.configService.get<string>("MINIO_USE_SSL") === "true",
      accessKey: this.configService.get<string>("MINIO_ACCESS_KEY") ?? "minioadmin",
      secretKey: this.configService.get<string>("MINIO_SECRET_KEY") ?? "minioadmin",
    });
    this.bucketName = this.configService.get<string>("MINIO_BUCKET") ?? "surge-assets";
  }

  async generateImageFromDigest(dto: {
    workspaceId: string;
    digestText: string;
    promptVersionId: string;
  }) {
    const apiKey = this.configService.get<string>("OPENAI_API_KEY");
    if (!apiKey) {
      throw new InternalServerErrorException("OPENAI_API_KEY is not configured");
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
      throw new InternalServerErrorException("DALL-E 3 did not return an image URL");
    }

    const buffer = await this.downloadToBuffer(imageUrl);
    const objectName = `workspaces/${dto.workspaceId}/assets/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

    await this.ensureBucketExists();
    await this.minio.putObject(this.bucketName, objectName, buffer, buffer.length, {
      "Content-Type": "image/png",
    });

    const presignedUrl = await this.minio.presignedGetObject(this.bucketName, objectName, 24 * 60 * 60);

    await this.prisma.generatedDraft.updateMany({
      where: { workspaceId: dto.workspaceId, promptVersionId: dto.promptVersionId, status: "pending" },
      data: { imageUrl: presignedUrl },
    });

    return {
      imageUrl: presignedUrl,
      objectName,
      bucketName: this.bucketName,
    };
  }

  private async ensureBucketExists() {
    const exists = await this.minio.bucketExists(this.bucketName);
    if (!exists) {
      await this.minio.makeBucket(this.bucketName, "us-east-1");
    }
  }

  private async downloadToBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      https
        .get(url, (response) => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new InternalServerErrorException(`Image download failed with status ${response.statusCode}`));
            return;
          }

          const chunks: Buffer[] = [];
          response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          response.on("end", () => resolve(Buffer.concat(chunks)));
          response.on("error", reject);
        })
        .on("error", reject);
    });
  }
}
