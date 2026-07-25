import { ConfigService } from "@nestjs/config";
import { EncryptionService } from "./encryption.service";

describe("EncryptionService", () => {
  let service: EncryptionService;
  let configService: ConfigService;
  const valid32ByteKey = "12345678901234567890123456789012";

  beforeEach(() => {
    configService = new ConfigService();
    jest.spyOn(configService, "get").mockReturnValue(valid32ByteKey);
    service = new EncryptionService(configService);
    service.onModuleInit();
  });

  it("should encrypt and decrypt payload successfully", () => {
    const payload = { accessToken: "test-token-123", target: "page-id" };
    const encrypted = service.encrypt(payload);

    expect(encrypted).toContain("enc:v1:");
    expect(service.isEncrypted(encrypted)).toBe(true);

    const decrypted = service.decrypt<typeof payload>(encrypted);
    expect(decrypted).toEqual(payload);
  });

  it("should generate a unique IV for each encryption call", () => {
    const payload = { token: "abc" };
    const enc1 = service.encrypt(payload);
    const enc2 = service.encrypt(payload);

    expect(enc1).not.toEqual(enc2);
  });

  it("should fail module init if encryption key is missing or not 32 bytes", () => {
    const invalidConfig = new ConfigService();
    jest.spyOn(invalidConfig, "get").mockReturnValue("too-short");
    const badService = new EncryptionService(invalidConfig);

    expect(() => badService.onModuleInit()).toThrow(
      "CREDENTIAL_ENCRYPTION_KEY must be exactly 32 bytes",
    );
  });

  it("should transparently fallback for legacy plaintext JSON strings", () => {
    const legacyJson = JSON.stringify({ accessToken: "legacy-token" });
    expect(service.isEncrypted(legacyJson)).toBe(false);

    const result = service.decrypt<Record<string, any>>(legacyJson);
    expect(result).toEqual({ accessToken: "legacy-token" });
  });

  it("should throw error if auth tag verification fails on tampered data", () => {
    const payload = { secret: "top-secret" };
    const encrypted = service.encrypt(payload);

    const parts = encrypted.split(":");
    parts[parts.length - 1] = Buffer.from("tampered-data").toString("base64");
    const tampered = parts.join(":");

    expect(() => service.decrypt(tampered)).toThrow();
  });
});
