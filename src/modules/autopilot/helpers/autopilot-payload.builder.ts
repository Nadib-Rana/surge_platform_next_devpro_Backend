import { Logger } from "@nestjs/common";
import { DispatchPayload } from "../../dispatcher/interfaces/base-dispatcher.interface";

export interface DraftForDispatch {
  id: string;
  workspaceId: string;
  wordpressHtmlContent: string | null;
  socialPlainText: string | null;
  imageUrl: string | null;
  imageProvider: string | null;
}

export interface ChannelForDispatch {
  id: string;
  workspaceId: string;
  platform: string;
  encryptedCredentials: string;
}

export function buildAutopilotDispatchPayload(
  channel: ChannelForDispatch,
  draft: DraftForDispatch,
  logger: Logger,
): DispatchPayload {
  const content = resolveContentForChannel(channel.platform, draft);
  if (!content) {
    throw new Error("Draft does not contain publishable content");
  }

  const imageUrl = draft.imageUrl?.trim();
  const images = imageUrl ? [imageUrl] : undefined;

  return {
    channel: channel.platform,
    title: "Surge Autopilot Digest",
    content,
    images,
    credentials: parseChannelCredentials(channel, logger),
    metadata: {
      draftId: draft.id,
      workspaceId: draft.workspaceId,
      imageProvider: draft.imageProvider ?? undefined,
      hasGeneratedAsset: Boolean(imageUrl),
    },
  };
}

function resolveContentForChannel(
  platform: string,
  draft: DraftForDispatch,
): string {
  const isWordPress = platform.toLowerCase() === "wordpress";
  const content = isWordPress
    ? draft.wordpressHtmlContent || draft.socialPlainText
    : draft.socialPlainText || stripHtml(draft.wordpressHtmlContent);

  return content?.trim() ?? "";
}

function parseChannelCredentials(
  channel: ChannelForDispatch,
  logger: Logger,
): Record<string, any> {
  try {
    const parsed = JSON.parse(channel.encryptedCredentials) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, any>;
    }
  } catch {
    logger.warn(
      `Publishing channel ${channel.id} credentials are not plain JSON; dispatcher will fail closed until credential decryption is wired.`,
    );
  }

  return {};
}

function stripHtml(content: string | null): string {
  return (
    content
      ?.replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim() ?? ""
  );
}
