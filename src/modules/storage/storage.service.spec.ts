import { ConfigService } from "@nestjs/config";
import { StorageService } from "./storage.service";

const presignedPutObject = jest.fn();
const presignedGetObject = jest.fn();
const bucketExists = jest.fn();
const makeBucket = jest.fn();
const putObject = jest.fn();

jest.mock("minio", () => ({
  Client: jest.fn().mockImplementation(() => ({
    presignedPutObject,
    presignedGetObject,
    bucketExists,
    makeBucket,
    putObject,
  })),
}));

describe("StorageService", () => {
  let service: StorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    const configService = {
      get: jest.fn(
        (key: string) =>
          ({
            MINIO_ENDPOINT: "127.0.0.1",
            MINIO_PORT: "9000",
            MINIO_USE_SSL: "false",
            MINIO_ACCESS_KEY: "minioadmin",
            MINIO_SECRET_KEY: "minioadmin",
            MINIO_BUCKET: "surge-assets",
          })[key],
      ),
    } as unknown as ConfigService;

    service = new StorageService(configService);
  });

  it("returns a presigned upload URL for a new object", async () => {
    presignedPutObject.mockResolvedValue("https://example.com/upload");

    const result = await service.generatePresignedUploadUrl({
      contentType: "image/png",
      folder: "workspaces/ws-1/assets",
      fileName: "hero.png",
    });

    expect(result.uploadUrl).toBe("https://example.com/upload");
    expect(result.objectName).toContain("workspaces/ws-1/assets/");
    expect(result.bucketName).toBe("surge-assets");
  });
});
