import { createHash } from "crypto";

export function normalizeUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";

  try {
    const parsed = new URL(rawUrl.trim());
    parsed.hash = "";

    const params = new URLSearchParams(parsed.search);
    const trackingKeys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "ref",
      "rss",
    ];

    for (const key of trackingKeys) {
      params.delete(key);
    }

    parsed.search = params.toString() ? `?${params.toString()}` : "";
    let clean = parsed.toString();
    if (clean.endsWith("/") && parsed.pathname !== "/") {
      clean = clean.slice(0, -1);
    }
    return clean;
  } catch {
    return rawUrl.trim().split("#")[0].split("?")[0].replace(/\/+$/, "");
  }
}

export function createUrlHash(url: string): string {
  const normalized = normalizeUrl(url);
  return createHash("sha256").update(normalized).digest("hex");
}
