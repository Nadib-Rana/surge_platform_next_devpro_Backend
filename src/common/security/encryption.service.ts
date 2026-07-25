import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import {
  AUTH_TAG_LENGTH_BYTES,
  ENCRYPTION_ALGORITHM,
  ENCRYPTION_KEY_ENV_VAR,
  ENCRYPTION_PREFIX,
  IV_LENGTH_BYTES,
} from "./encryption.constants";

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private encryptionKey!: Buffer;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initAndValidateKey();
  }

  private initAndValidateKey(): void {
    const defaultDevKey = "surge_dev_32byte_secret_key_1234";
    const rawKey =
      this.configService.get<string>(ENCRYPTION_KEY_ENV_VAR) || defaultDevKey;

    if (rawKey === defaultDevKey) {
      this.logger.warn(
        `CREDENTIAL_ENCRYPTION_KEY is not set in environment. Using default 32-byte development key. Set ${ENCRYPTION_KEY_ENV_VAR} in .env for production.`,
      );
    }

    const trimmedKey = rawKey.trim();
    let keyBuffer: Buffer;

    if (trimmedKey.length === 64 && /^[0-9a-fA-F]+$/.test(trimmedKey)) {
      keyBuffer = Buffer.from(trimmedKey, "hex");
    } else {
      keyBuffer = Buffer.from(trimmedKey, "utf8");
    }

    if (keyBuffer.length !== 32) {
      throw new Error(
        `CRITICAL SECURITY ERROR: ${ENCRYPTION_KEY_ENV_VAR} must be exactly 32 bytes (or 64 hex characters). Received ${keyBuffer.length} bytes.`,
      );
    }

    this.encryptionKey = keyBuffer;
    this.logger.log("AES-256-GCM EncryptionService successfully initialized.");
  }

  encrypt(payload: Record<string, any> | string): string {
    const jsonString =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    const iv = crypto.randomBytes(IV_LENGTH_BYTES);
    const cipher = crypto.createCipheriv(
      ENCRYPTION_ALGORITHM,
      this.encryptionKey,
      iv,
    );

    const encrypted = Buffer.concat([
      cipher.update(jsonString, "utf8"),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return `${ENCRYPTION_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
  }

  decrypt<T = Record<string, any>>(encryptedData: string): T {
    if (!encryptedData || typeof encryptedData !== "string") {
      return {} as T;
    }

    const trimmed = encryptedData.trim();

    // Legacy plaintext JSON fallback
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed) as T;
      } catch {
        return {} as T;
      }
    }

    if (!trimmed.startsWith(ENCRYPTION_PREFIX)) {
      throw new Error("Invalid or unsupported encrypted data format.");
    }

    const payloadPart = trimmed.substring(ENCRYPTION_PREFIX.length);
    const parts = payloadPart.split(":");

    if (parts.length !== 3) {
      throw new Error("Corrupted encrypted credential format.");
    }

    const [ivBase64, tagBase64, cipherBase64] = parts;
    const iv = Buffer.from(ivBase64, "base64");
    const authTag = Buffer.from(tagBase64, "base64");
    const cipherText = Buffer.from(cipherBase64, "base64");

    if (iv.length !== IV_LENGTH_BYTES) {
      throw new Error("Invalid Initialization Vector length.");
    }
    if (authTag.length !== AUTH_TAG_LENGTH_BYTES) {
      throw new Error("Invalid Authentication Tag length.");
    }

    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      this.encryptionKey,
      iv,
    );
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(cipherText),
      decipher.final(),
    ]);

    const decryptedString = decrypted.toString("utf8");

    try {
      return JSON.parse(decryptedString) as T;
    } catch {
      return decryptedString as unknown as T;
    }
  }

  isEncrypted(value: string): boolean {
    return (
      typeof value === "string" && value.trim().startsWith(ENCRYPTION_PREFIX)
    );
  }
}
