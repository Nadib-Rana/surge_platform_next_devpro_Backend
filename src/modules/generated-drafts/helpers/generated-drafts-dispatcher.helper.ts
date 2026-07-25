import { PrismaService } from "../../../common/context/prisma.service";
import { DispatcherService } from "../../dispatcher/dispatcher.service";
import { DraftRecord } from "./generated-drafts-access.helper";
import { parseEditorState, stripHtml } from "./generated-drafts-editor.util";
import { EncryptionService } from "../../../common/security/encryption.service";
import { PublishingChannelRecord } from "./generated-drafts-channel-resolver.helper";

export async function dispatchDraftToChannels(
  prisma: PrismaService,
  dispatcher: DispatcherService,
  draft: DraftRecord,
  channels: PublishingChannelRecord[],
  actorUserId = "system",
  encryptionService?: EncryptionService,
) {
  const successes: Array<{ channel: string; url?: string; id?: string }> = [];
  const failures: Array<{ channel: string; error: string }> = [];

  for (const channel of channels) {
    const idempotencyKey = `${draft.id}:${channel.id}`;
    let publishLog = await prisma.publishedPostsLog.findUnique({
      where: { idempotencyKey },
    });

    if (!publishLog) {
      publishLog = await prisma.publishedPostsLog.create({
        data: {
          draftId: draft.id,
          channelId: channel.id,
          idempotencyKey,
          status: "retrying",
          retryCount: 0,
        },
      });
    } else {
      await prisma.publishedPostsLog.update({
        where: { id: publishLog.id },
        data: {
          status: "retrying",
          retryCount: publishLog.retryCount + 1,
        },
      });
    }

    const dispatchResult = await dispatcher.dispatch(
      buildDispatchPayload(draft, channel, encryptionService),
    );

    if (dispatchResult.success) {
      await prisma.publishedPostsLog.update({
        where: { id: publishLog.id },
        data: {
          status: "sent",
          livePostUrl: dispatchResult.url ?? null,
        },
      });

      successes.push({
        channel: channel.platform,
        url: dispatchResult.url,
        id: dispatchResult.id,
      });
    } else {
      await prisma.publishedPostsLog.update({
        where: { id: publishLog.id },
        data: { status: "failed" },
      });

      failures.push({
        channel: channel.platform,
        error:
          dispatchResult.error ?? `Failed to dispatch ${channel.platform}`,
      });
    }
  }

  return { successes, failures, actorUserId };
}

export function buildDispatchPayload(
  draft: DraftRecord,
  channel: PublishingChannelRecord,
  encryptionService?: EncryptionService,
) {
  const editorState = parseEditorState(draft.editorState);
  const title =
    editorState.title ?? editorState.seoTitle ?? "Surge Platform Draft";
  const content = resolveChannelContent(channel.platform, draft, editorState);

  return {
    channel: channel.platform,
    title,
    content,
    images: draft.imageUrl ? [draft.imageUrl] : undefined,
    credentials: parseCredentials(channel.encryptedCredentials, encryptionService),
    metadata: {
      draftId: draft.id,
      workspaceId: draft.workspaceId,
      imageProvider: draft.imageProvider ?? undefined,
      editorState,
    },
  };
}

export function parseCredentials(
  rawCredentials: string,
  encryptionService?: EncryptionService,
): Record<string, any> {
  if (!rawCredentials) return {};
  if (encryptionService) {
    return encryptionService.decrypt(rawCredentials);
  }
  const trimmed = rawCredentials.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed) as Record<string, any>;
    } catch {
      return {};
    }
  }
  return {};
}

export function resolveChannelContent(
  platform: string,
  draft: DraftRecord,
  editorState: any,
) {
  if (platform.toLowerCase() === "wordpress") {
    return draft.wordpressHtmlContent || draft.socialPlainText || "";
  }

  if (draft.socialPlainText?.trim()) {
    return draft.socialPlainText.trim();
  }

  return stripHtml(
    draft.wordpressHtmlContent ?? editorState.excerpt ?? "",
  );
}

export async function recordAuditEvent(
  prisma: PrismaService,
  params: any,
) {
  // Audit log helper hook
}
