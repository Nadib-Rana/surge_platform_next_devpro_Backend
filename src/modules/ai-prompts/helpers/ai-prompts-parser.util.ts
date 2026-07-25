export interface BatchDigestContent {
  socialPlainText: string;
  wordpressHtmlContent: string;
  imagePrompt?: string;
  hashtags?: string[];
}

export function parseBatchDigestContent(
  rawContent: string,
): BatchDigestContent {
  const cleanedContent = stripMarkdownFences(rawContent.trim());
  const parsedJson = tryParseDigestJson(cleanedContent);
  if (parsedJson) {
    return parsedJson;
  }

  const wordpressMatch = cleanedContent.match(
    /(?:wordpressHtmlContent|wordpress_html_content|wordpress html|blog html)\s*[:=-]\s*([\s\S]*?)(?=\n\s*(?:socialPlainText|social_plain_text|social text|social)\s*[:=-]|$)/i,
  );
  const socialMatch = cleanedContent.match(
    /(?:socialPlainText|social_plain_text|social text|social)\s*[:=-]\s*([\s\S]*?)(?=\n\s*(?:wordpressHtmlContent|wordpress_html_content|wordpress html|blog html)\s*[:=-]|$)/i,
  );

  const wordpressHtmlContent = wordpressMatch?.[1]?.trim();
  const socialPlainText = socialMatch?.[1]?.trim();

  if (wordpressHtmlContent || socialPlainText) {
    const fallbackText = stripHtml(
      wordpressHtmlContent ?? socialPlainText ?? cleanedContent,
    );

    return {
      wordpressHtmlContent:
        wordpressHtmlContent ?? wrapPlainTextForWordPress(fallbackText),
      socialPlainText: socialPlainText ?? fallbackText,
    };
  }

  return {
    wordpressHtmlContent: wrapPlainTextForWordPress(cleanedContent),
    socialPlainText: cleanedContent,
  };
}

export function stripMarkdownFences(content: string): string {
  if (!content) return "";
  return content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function tryParseDigestJson(
  rawContent: string,
): BatchDigestContent | null {
  try {
    const cleaned = stripMarkdownFences(rawContent);
    const parsed = JSON.parse(cleaned) as Partial<BatchDigestContent>;
    if (
      typeof parsed.socialPlainText === "string" ||
      typeof parsed.wordpressHtmlContent === "string"
    ) {
      const socialPlainText =
        parsed.socialPlainText?.trim() ??
        stripHtml(parsed.wordpressHtmlContent ?? "");
      const wordpressHtmlContent =
        parsed.wordpressHtmlContent?.trim() ??
        wrapPlainTextForWordPress(socialPlainText);

      return {
        socialPlainText,
        wordpressHtmlContent,
        imagePrompt: parsed.imagePrompt?.trim(),
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      };
    }
  } catch {
    return null;
  }

  return null;
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
