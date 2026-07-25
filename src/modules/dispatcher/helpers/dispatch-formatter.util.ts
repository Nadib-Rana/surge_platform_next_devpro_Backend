import { DispatchPayload } from "../interfaces/base-dispatcher.interface";

export function formatPayloadForPlatform(
  payload: DispatchPayload,
): DispatchPayload {
  const platform = payload.channel.toLowerCase();
  let content = payload.content || "";

  if (platform === "linkedin") {
    content = truncateText(stripHtmlTags(content), 3000);
  } else if (platform === "facebook") {
    content = truncateText(stripHtmlTags(content), 63000);
  } else if (platform === "twitter" || platform === "x") {
    content = truncateText(stripHtmlTags(content), 280);
  }

  return {
    ...payload,
    content,
    title: payload.title?.trim() || "Surge Post",
  };
}

export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3).trim() + "...";
}

export function stripHtmlTags(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
