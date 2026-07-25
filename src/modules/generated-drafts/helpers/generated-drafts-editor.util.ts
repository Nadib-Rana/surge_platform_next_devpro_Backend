import { Prisma } from "@prisma/client";

export interface DraftEditorState {
  title?: string;
  excerpt?: string;
  slug?: string;
  hashtags?: string[];
  seoTitle?: string;
  metaDescription?: string;
}

export type DraftEditorPatch = {
  title?: string;
  excerpt?: string;
  slug?: string;
  hashtags?: string[];
  seoTitle?: string;
  metaDescription?: string;
};

export function parseEditorState(
  value: Prisma.JsonValue | null | undefined,
): DraftEditorState {
  const record = parseJsonRecord(value);

  return {
    title: asString(record.title),
    excerpt: asString(record.excerpt),
    slug: asString(record.slug),
    hashtags: Array.isArray(record.hashtags)
      ? record.hashtags.filter(
          (item): item is string => typeof item === "string",
        )
      : undefined,
    seoTitle: asString(record.seoTitle),
    metaDescription: asString(record.metaDescription),
  };
}

export function mergeEditorState(
  existing: DraftEditorState,
  update: DraftEditorPatch,
) {
  return {
    title: update.title ?? existing.title,
    excerpt: update.excerpt ?? existing.excerpt,
    slug: update.slug ?? existing.slug,
    hashtags: update.hashtags ?? existing.hashtags,
    seoTitle: update.seoTitle ?? existing.seoTitle,
    metaDescription: update.metaDescription ?? existing.metaDescription,
  };
}

export function buildEditorState(value: DraftEditorState) {
  return {
    title: value.title,
    excerpt: value.excerpt,
    slug: value.slug,
    hashtags: value.hashtags,
    seoTitle: value.seoTitle,
    metaDescription: value.metaDescription,
  };
}

export function parseJsonRecord(
  value: Prisma.JsonValue | string | null | undefined,
) {
  if (!value) return {} as Record<string, any>;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, any>;
      }
    } catch {
      return {} as Record<string, any>;
    }

    return {} as Record<string, any>;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  return {} as Record<string, any>;
}

export function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function stripHtml(content: string) {
  return content
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
