import { Logger } from "@nestjs/common";

const logger = new Logger("HyperlinkValidator");

export interface ExtractedLink {
  href: string;
  text: string;
}

/**
 * Extracts links from HTML text using a robust regular expression.
 */
export function extractLinks(html: string): ExtractedLink[] {
  if (!html) return [];
  const links: ExtractedLink[] = [];
  // Match <a> tags and extract href + inner text
  const aTagRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = aTagRegex.exec(html)) !== null) {
    links.push({
      href: match[1]?.trim() || "",
      text: match[2]?.replace(/<[^>]*>/g, "")?.trim() || "", // strip inner tags if any
    });
  }
  return links;
}

/**
 * Compares raw vs polished draft links to ensure all are preserved exactly.
 * ABSOLUTE RULE: Every hyperlink must remain unchanged.
 */
export function validateHyperlinksPreservation(
  rawContent: string,
  polishedContent: string,
): { valid: boolean; missingLinks: string[]; alteredLinks: string[] } {
  const rawLinks = extractLinks(rawContent);
  const polishedLinks = extractLinks(polishedContent);

  const missingLinks: string[] = [];
  const alteredLinks: string[] = [];

  // Verify all raw links are present in polished links
  for (const rawLink of rawLinks) {
    const found = polishedLinks.some(pl => pl.href === rawLink.href);
    if (!found) {
      missingLinks.push(rawLink.href);
    }
  }

  // Verify exact match in order and count
  if (rawLinks.length === polishedLinks.length) {
    for (let i = 0; i < rawLinks.length; i++) {
      if (rawLinks[i].href !== polishedLinks[i].href) {
        alteredLinks.push(
          `Expected '${rawLinks[i].href}' at position ${i + 1}, found '${polishedLinks[i].href}'`,
        );
      }
    }
  } else {
    alteredLinks.push(
      `Link count mismatch. Raw links count: ${rawLinks.length}, Polished links count: ${polishedLinks.length}`,
    );
  }

  const valid = missingLinks.length === 0 && alteredLinks.length === 0;

  if (!valid) {
    logger.warn(
      `Hyperlink validation failed. Missing: ${missingLinks.join(", ")}; Altered: ${alteredLinks.join("; ")}`,
    );
  }

  return { valid, missingLinks, alteredLinks };
}
