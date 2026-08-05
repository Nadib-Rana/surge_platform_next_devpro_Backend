export function stripMarkdownFences(content: string): string {
  if (!content) return "";
  return content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function extractJsonString(content: string): string {
  if (!content) return "";
  const cleaned = stripMarkdownFences(content);
  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return cleaned.substring(startIdx, endIdx + 1);
  }
  return cleaned;
}

export function wrapPlainTextForWordPress(content: string): string {
  return `<article><p>${escapeHtml(content)}</p></article>`;
}

export function stripHtml(content: string): string {
  return content
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeHtml(content: string): string {
  return content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sleep(delayMs: number) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
