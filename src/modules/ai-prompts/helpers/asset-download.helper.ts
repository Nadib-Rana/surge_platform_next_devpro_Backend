import { InternalServerErrorException } from "@nestjs/common";
import https from "https";

export function createFallbackPngBuffer(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  );
}

export function formatError(error: unknown): string {
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

export async function downloadToBuffer(url: string): Promise<Buffer> {
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
