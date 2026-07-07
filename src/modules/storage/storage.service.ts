import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client as MinioClient } from "minio";
import { randomUUID } from "crypto";

@Injectable()
export class StorageService {
  private readonly minio: MinioClient;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.minio = new MinioClient({
      endPoint: this.configService.get<string>("MINIO_ENDPOINT") ?? "127.0.0.1",
      port: Number(this.configService.get<string>("MINIO_PORT") ?? 9000),
      useSSL: this.configService.get<string>("MINIO_USE_SSL") === "true",
      accessKey:
        this.configService.get<string>("MINIO_ACCESS_KEY") ?? "minioadmin",
      secretKey:
        this.configService.get<string>("MINIO_SECRET_KEY") ?? "minioadmin",
    });
    this.bucketName =
      this.configService.get<string>("MINIO_BUCKET") ?? "surge-assets";
  }

  async generatePresignedUploadUrl(dto: {
    contentType: string;
    folder: string;
    fileName: string;
  }) {
    const objectName = `${dto.folder.replace(/^\/+|\/+$/g, "")}/${Date.now()}-${randomUUID()}-${dto.fileName}`;

    await this.ensureBucketExists();

    const uploadUrl = await this.minio.presignedPutObject(
      this.bucketName,
      objectName,
      24 * 60 * 60,
    );

    return {
      uploadUrl,
      objectName,
      bucketName: this.bucketName,
      expiresInSeconds: 24 * 60 * 60,
    };
  }

  async getPresignedDownloadUrl(objectName: string) {
    await this.ensureBucketExists();
    return this.minio.presignedGetObject(
      this.bucketName,
      objectName,
      24 * 60 * 60,
    );
  }

  async uploadBuffer(objectName: string, buffer: Buffer, contentType: string) {
    await this.ensureBucketExists();
    await this.minio.putObject(
      this.bucketName,
      objectName,
      buffer,
      buffer.length,
      {
        "Content-Type": contentType,
      },
    );
    return this.getPresignedDownloadUrl(objectName);
  }

  async ensureBucketExists() {
    const exists = await this.minio.bucketExists(this.bucketName);
    if (!exists) {
      await this.minio.makeBucket(this.bucketName, "us-east-1");
    }
  }

  async verifyConnection() {
    try {
      await this.ensureBucketExists();
      return { ok: true, bucketName: this.bucketName };
    } catch (error) {
      throw new InternalServerErrorException("Object storage is not reachable");
    }
  }
}
