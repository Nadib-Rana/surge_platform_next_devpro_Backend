import { PrismaService } from "../../../common/context/prisma.service";
import { DispatcherService } from "../../dispatcher/dispatcher.service";
import { findDraftWithWorkspace } from "./generated-drafts-access.helper";
import {
  dispatchDraftToChannels,
  recordAuditEvent,
} from "./generated-drafts-dispatcher.helper";
import { resolvePublishingChannels } from "./generated-drafts-channel-resolver.helper";
import { parseJsonRecord } from "./generated-drafts-editor.util";

export async function applyAutoPostPolicyAction(
  prisma: PrismaService,
  dispatcher: DispatcherService,
  draftId: string,
) {
  const draft = await findDraftWithWorkspace(prisma, draftId);
  const autoPost = Boolean(
    parseJsonRecord(draft.workspace.queueConfig).autoPost,
  );

  if (!autoPost) {
    const updated =
      draft.status === "review"
        ? draft
        : await prisma.generatedDraft.update({
            where: { id: draft.id },
            data: { status: "review" },
          });

    await recordAuditEvent(prisma, {
      workspaceId: draft.workspaceId,
      companyId: draft.workspace.companyId,
      draftId: draft.id,
      userId: draft.workspace.company.ownerId,
      action: "QueuedForReview",
      status: updated.status,
      details: { autoPost: false },
    });

    return updated;
  }

  const channels = await resolvePublishingChannels(
    prisma,
    draft.workspaceId,
  );
  const result = await dispatchDraftToChannels(
    prisma,
    dispatcher,
    draft,
    channels,
    draft.workspace.company.ownerId,
  );

  const finalStatus = result.successes.length > 0 ? "published" : "failed";
  const updated = await prisma.generatedDraft.update({
    where: { id: draft.id },
    data: { status: finalStatus },
  });

  await recordAuditEvent(prisma, {
    workspaceId: draft.workspaceId,
    companyId: draft.workspace.companyId,
    draftId: draft.id,
    userId: draft.workspace.company.ownerId,
    action: "AutoPost",
    status: updated.status,
    details: {
      autoPost: true,
      successes: result.successes,
      failures: result.failures,
    },
  });

  return updated;
}
