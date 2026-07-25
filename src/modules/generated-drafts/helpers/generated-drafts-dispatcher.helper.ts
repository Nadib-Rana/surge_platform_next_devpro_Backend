import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../common/context/prisma.service";
import { DispatcherService } from "../../dispatcher/dispatcher.service";
import { UpdateGeneratedDraftDto } from "../dto/update-generated-draft.dto";
import { DraftRecord } from "./generated-drafts-access.helper";
import {
  parseEditorState,
  parseJsonRecord,
  stripHtml,
} from "./generated-drafts-editor.util";

export interface PublishingChannelRecord {
  id: string;
  workspaceId: string;
  platform: string;
  encryptedCredentials: string;
}

export async function resolvePublishingChannels(
  prisma: PrismaService,
  workspaceId: string,
  requestedChannels?: string[],
): Promise<PublishingChannelRecord[]> {
  const where: Prisma.PublishingChannelWhereInput = {
    workspaceId,
    isActive: true,
  };

  if (requestedChannels?.length) {
    where.platform = { in: requestedChannels };
  }

  const channels = (await prisma.publishingChannel.findMany({
    where,
  })) as PublishingChannelRecord[];

  if (!channels.length) {
    throw new BadRequestException(
      "No active publishing channels found for this workspace",
    );
  }

  if (requestedChannels?.length) {
    const foundPlatforms = new Set(
      channels.map((channel) => channel.platform),
    );
    const missing = requestedChannels.filter(
      (channel) => !foundPlatforms.has(channel),
    );

    if (missing.length) {
      throw new BadRequestException(
        `Selected channels are not active or not configured: ${missing.join(", ")}`,
      );
    }
  }

  return channels;
}

export async function dispatchDraftToChannels(
  prisma: PrismaService,
  dispatcher: DispatcherService,
  draft: DraftRecord,
  channels: PublishingChannelRecord[],
  actorUserId = "system",
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
      buildDispatchPayload(draft, channel),
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
    credentials: parseJsonRecord(channel.encryptedCredentials),
    metadata: {
      draftId: draft.id,
      workspaceId: draft.workspaceId,
      imageProvider: draft.imageProvider ?? undefined,
      editorState,
    },
  };
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

export function resolveUpdatedStatus(
  currentStatus: string,
  dto: UpdateGeneratedDraftDto,
  hasContentChanges: boolean,
) {
  if (dto.action === "approve") return "approved";
  if (dto.action === "reject") return "rejected";
  if (dto.status) return dto.status;
  if (
    hasContentChanges &&
    ["published", "failed", "rejected"].includes(currentStatus)
  ) {
    return "review";
  }
  return currentStatus;
}

export async function recordAuditEvent(
  prisma: PrismaService,
  params: {
    workspaceId: string;
    companyId: string;
    draftId: string;
    userId: string;
    action: string;
    status: string;
    details?: any;
  },
) {
  // Audit log helper hook
}
