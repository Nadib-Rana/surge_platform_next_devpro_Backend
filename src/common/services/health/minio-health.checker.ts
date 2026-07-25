import { ConfigService } from "@nestjs/config";

export async function checkMinioConfig(configService: ConfigService) {
  const endpoint = configService.get<string>("MINIO_ENDPOINT");
  const accessKey = configService.get<string>("MINIO_ACCESS_KEY");
  const secretKey = configService.get<string>("MINIO_SECRET_KEY");
  const bucket =
    configService.get<string>("MINIO_BUCKET_NAME") || "surge-assets";

  if (!endpoint || !accessKey || !secretKey) {
    return {
      valid: false,
      error:
        "MinIO credentials (ENDPOINT, ACCESS_KEY, or SECRET_KEY) are missing in .env",
    };
  }

  return {
    valid: true,
    message: "MinIO environment variables detected.",
    targetBucket: bucket,
    endpoint,
    note: "Ensure MinIO server is running and accessible from backend network.",
  };
}
