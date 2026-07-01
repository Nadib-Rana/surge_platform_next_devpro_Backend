import { createHash } from "crypto";

export function createUrlHash(url: string): string {
  return createHash("sha256").update(url.trim()).digest("hex");
}
