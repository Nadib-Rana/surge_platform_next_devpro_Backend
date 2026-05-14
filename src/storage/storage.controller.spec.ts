import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { StorageController } from "./storage.controller";
import { StorageService } from "./storage.service";

describe("StorageController", () => {
  let controller: StorageController;
  let service: jest.Mocked<StorageService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [
        {
          provide: StorageService,
          useValue: {
            isConfigured: jest.fn().mockReturnValue(true),
            getDefaultBucket: jest.fn().mockReturnValue("media"),
            getPresignedUploadUrl: jest.fn(),
            getPresignedObjectUrl: jest.fn(),
            getObjectUrl: jest.fn(),
            getObjectAccessInfo: jest.fn(),
            removeObject: jest.fn(),
            uploadObject: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<StorageController>(StorageController);
    service = module.get(StorageService);
  });

  describe("public/presign-upload", () => {
    it("should generate upload URL for valid temporary registration key", async () => {
      service.getPresignedUploadUrl.mockResolvedValue(
        "https://upload-url" as never,
      );

      const result = await controller.getPublicPresignedUploadUrl({
        key: "temp/registrations/avatar-123.jpg",
      });

      expect(service.getPresignedUploadUrl).toHaveBeenCalledWith(
        "temp/registrations/avatar-123.jpg",
        "profiles",
        600,
      );
      expect(result).toEqual({
        key: "temp/registrations/avatar-123.jpg",
        objectKey: "temp/registrations/avatar-123.jpg",
        bucket: "profiles",
        method: "PUT",
        expiresIn: 600,
        uploadUrl: "https://upload-url",
        temporary: true,
      });
    });

    it("should reject keys outside temporary prefix", async () => {
      await expect(
        controller.getPublicPresignedUploadUrl({
          key: "profiles/users/u1/avatar.jpg",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should reject unsafe key patterns", async () => {
      await expect(
        controller.getPublicPresignedUploadUrl({
          key: "temp/registrations/../avatar.jpg",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        controller.getPublicPresignedUploadUrl({
          key: "https://evil.com/file.jpg",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should generate key from filename and mimeType", async () => {
      service.getPresignedUploadUrl.mockResolvedValue(
        "https://upload-url" as never,
      );

      const result = await controller.getPublicPresignedUploadUrl({
        filename: "My Avatar Image.PNG",
        mimeType: "image/png",
      });

      expect(service.getPresignedUploadUrl).toHaveBeenCalledTimes(1);

      const [generatedKey, bucket, expiry] =
        service.getPresignedUploadUrl.mock.calls[0];

      expect(generatedKey).toMatch(
        /^temp\/registrations\/\d+-[a-z0-9]{6}-my-avatar-image\.png$/,
      );
      expect(bucket).toBe("profiles");
      expect(expiry).toBe(600);
      expect(result).toMatchObject({
        key: generatedKey,
        objectKey: generatedKey,
        bucket: "profiles",
        method: "PUT",
        temporary: true,
      });
    });

    it("should require key or filename+mimeType", async () => {
      await expect(
        controller.getPublicPresignedUploadUrl({
          bucket: "profiles",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        controller.getPublicPresignedUploadUrl({
          filename: "avatar.jpg",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("public/upload-file", () => {
    it("should upload a file and return generated object key", async () => {
      service.uploadObject.mockResolvedValue(undefined as never);
      service.getObjectAccessInfo.mockResolvedValue({
        url: "http://localhost:9030/profiles/temp/registrations/file.jpg",
        restricted: false,
        accessType: "public",
      } as never);

      const result = await controller.uploadPublicFile(
        [
          {
            buffer: Buffer.from("avatar-bytes"),
            originalname: "Avatar Image.jpg",
            mimetype: "image/jpeg",
            size: 12,
          } as Express.Multer.File,
        ],
        {
          filename: "Avatar Image.jpg",
          mimeType: "image/jpeg",
        },
      );

      expect(service.uploadObject).toHaveBeenCalledTimes(1);
      const [buffer, bucket, key, contentType] =
        service.uploadObject.mock.calls[0];

      expect(buffer).toEqual(Buffer.from("avatar-bytes"));
      expect(bucket).toBe("profiles");
      expect(key).toMatch(
        /^temp\/registrations\/\d+-[a-z0-9]{6}-avatar-image\.jpg$/,
      );
      expect(contentType).toBe("image/jpeg");
      expect(service.getObjectAccessInfo).toHaveBeenCalledWith(key, "profiles");
      expect(result).toMatchObject({
        key,
        objectKey: key,
        bucket: "profiles",
        filename: "Avatar Image.jpg",
        mimeType: "image/jpeg",
        size: 12,
        temporary: true,
        restricted: false,
        accessType: "public",
      });
    });

    it("should require a file", async () => {
      await expect(
        controller.uploadPublicFile([], {
          filename: "avatar.jpg",
          mimeType: "image/jpeg",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should return service unavailable when storage is not configured", async () => {
      service.isConfigured.mockReturnValue(false);

      await expect(
        controller.uploadPublicFile(
          [
            {
              buffer: Buffer.from("avatar-bytes"),
              originalname: "Avatar Image.jpg",
              mimetype: "image/jpeg",
              size: 12,
            } as Express.Multer.File,
          ],
          {
            filename: "Avatar Image.jpg",
            mimeType: "image/jpeg",
          },
        ),
      ).rejects.toMatchObject({
        status: 503,
      });
    });
  });

  it("should call protected upload presign using default bucket", async () => {
    service.getPresignedUploadUrl.mockResolvedValue(
      "https://upload-url" as never,
    );

    const result = await controller.getPresignedUploadUrl({
      key: "products/items/item-1.jpg",
    });

    expect(service.getPresignedUploadUrl).toHaveBeenCalledWith(
      "products/items/item-1.jpg",
      "media",
      undefined,
    );
    expect(result).toMatchObject({
      key: "products/items/item-1.jpg",
      bucket: "media",
      method: "PUT",
      uploadUrl: "https://upload-url",
    });
  });
});
