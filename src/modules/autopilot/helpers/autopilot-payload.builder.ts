import { Logger } from "@nestjs/common";
import { DispatchPayload } from "../../dispatcher/interfaces/base-dispatcher.interface";
import { EncryptionService } from "../../../common/security/encryption.service";

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
  encryptionService?: EncryptionService,
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
    credentials: parseChannelCredentials(channel, logger, encryptionService),
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

export function parseChannelCredentials(
  channel: ChannelForDispatch,
  logger: Logger,
  encryptionService?: EncryptionService,
): Record<string, any> {
  if (!channel.encryptedCredentials) return {};
  try {
    if (encryptionService) {
      return encryptionService.decrypt(channel.encryptedCredentials);
    }
    const trimmed = channel.encryptedCredentials.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return JSON.parse(trimmed) as Record<string, any>;
    }
  } catch {
    logger.warn(
      `Failed to parse or decrypt credentials for publishing channel ${channel.id}`,
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
