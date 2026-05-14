import { Injectable } from "@nestjs/common";
import { Client as MinioClient } from "minio";

type ObjectAccessInfo = {
  url: string;
  restricted: boolean;
  accessType: "public" | "private-presigned";
};

@Injectable()
export class StorageService {
  private readonly defaultBucket =
    process.env.STORAGE_DEFAULT_BUCKET ??
    process.env.MINIO_BUCKET_NAME ??
    "media";
  private readonly publicEndpoint =
    process.env.STORAGE_PUBLIC_URL ?? process.env.MINIO_PUBLIC_URL ?? "";
  private readonly defaultExpirySeconds = Number(
    process.env.STORAGE_PRESIGNED_EXPIRY_SECONDS ?? 900,
  );
  private readonly profilesBucketName =
    process.env.STORAGE_PUBLIC_UPLOAD_BUCKET ?? "profiles";
  private readonly minioClient: MinioClient | null;

  constructor() {
    const endPoint = process.env.STORAGE_ENDPOINT ?? process.env.MINIO_ENDPOINT;
    const accessKey =
      process.env.STORAGE_ACCESS_KEY ?? process.env.MINIO_ACCESS_KEY;
    const secretKey =
      process.env.STORAGE_SECRET_KEY ?? process.env.MINIO_SECRET_KEY;
    const port = Number(
      process.env.STORAGE_PORT ?? process.env.MINIO_PORT ?? 9000,
    );
    const useSSL =
      (process.env.STORAGE_USE_SSL ?? process.env.MINIO_USE_SSL ?? "false") ===
      "true";

    if (!endPoint || !accessKey || !secretKey) {
      this.minioClient = null;
      return;
    }

    this.minioClient = new MinioClient({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });
  }

  isConfigured(): boolean {
    return this.minioClient !== null;
  }

  getObjectUrl(key: string, bucket: string): string {
    const endpoint = this.publicEndpoint;

    if (!endpoint) {
      return key;
    }

    const normalizedBase = endpoint.replace(/\/+$/, "");
    const encodedKey = key
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    return `${normalizedBase}/${bucket}/${encodedKey}`;
  }

  getDefaultBucket(): string {
    return this.defaultBucket;
  }

  isPublicReadBucket(bucket: string): boolean {
    return bucket === this.profilesBucketName;
  }

  async getObjectAccessInfo(
    key: string,
    bucket: string,
  ): Promise<ObjectAccessInfo> {
    if (this.isPublicReadBucket(bucket)) {
      return {
        url: this.getObjectUrl(key, bucket),
        restricted: false,
        accessType: "public",
      };
    }

    return {
      url: await this.getPresignedObjectUrl(key, bucket),
      restricted: true,
      accessType: "private-presigned",
    };
  }

  async getPresignedObjectUrl(
    key: string,
    bucket: string,
    expirySeconds = this.defaultExpirySeconds,
  ): Promise<string> {
    if (!this.minioClient) {
      return this.getObjectUrl(key, bucket);
    }

    const safeExpiry = Number.isFinite(expirySeconds)
      ? Math.max(60, Math.floor(expirySeconds))
      : this.defaultExpirySeconds;

    try {
      await this.ensureBucketExists(bucket);
      return await this.minioClient.presignedGetObject(bucket, key, safeExpiry);
    } catch {
      return this.getObjectUrl(key, bucket);
    }
  }

  async getPresignedUploadUrl(
    key: string,
    bucket: string,
    expirySeconds = this.defaultExpirySeconds,
  ): Promise<string> {
    if (!this.minioClient) {
      return this.getObjectUrl(key, bucket);
    }

    const safeExpiry = Number.isFinite(expirySeconds)
      ? Math.max(60, Math.floor(expirySeconds))
      : this.defaultExpirySeconds;

    try {
      await this.ensureBucketExists(bucket);
      return await this.minioClient.presignedPutObject(bucket, key, safeExpiry);
    } catch {
      return this.getObjectUrl(key, bucket);
    }
  }

  async uploadObject(
    buffer: Buffer,
    bucket: string,
    key: string,
    contentType?: string,
  ): Promise<void> {
    if (!this.minioClient) {
      throw new Error("Storage service is not configured");
    }

    await this.ensureBucketExists(bucket);

    const metaData = contentType ? { "Content-Type": contentType } : undefined;

    await this.minioClient.putObject(
      bucket,
      key,
      buffer,
      buffer.length,
      metaData,
    );
  }

  async removeObject(key: string, bucket: string): Promise<boolean> {
    if (!this.minioClient) {
      return false;
    }

    try {
      await this.minioClient.removeObject(bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureBucketExists(bucket: string): Promise<void> {
    if (!this.minioClient) {
      return;
    }

    const exists = await this.minioClient.bucketExists(bucket);

    if (!exists) {
      await this.minioClient.makeBucket(bucket);
    }

    await this.applyPublicReadPolicyIfNeeded(bucket);
  }

  private async applyPublicReadPolicyIfNeeded(bucket: string): Promise<void> {
    if (!this.minioClient || !this.isPublicReadBucket(bucket)) {
      return;
    }

    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            AWS: ["*"],
          },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    };

    await this.minioClient.setBucketPolicy(bucket, JSON.stringify(policy));
  }
}
