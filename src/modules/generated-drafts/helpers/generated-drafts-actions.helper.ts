import { BadRequestException } from "@nestjs/common";
import { Queue } from "bullmq";
import { PrismaService } from "../../../common/context/prisma.service";
import { DispatcherService } from "../../dispatcher/dispatcher.service";
import { PublishGeneratedDraftDto } from "../dto/publish-generated-draft.dto";
import { ScheduleGeneratedDraftDto } from "../dto/schedule-generated-draft.dto";
import {
  assertCanManageDraft,
  AuthenticatedUser,
  findAccessibleDraft,
} from "./generated-drafts-access.helper";
import {
  dispatchDraftToChannels,
  recordAuditEvent,
} from "./generated-drafts-dispatcher.helper";
import { resolvePublishingChannels } from "./generated-drafts-channel-resolver.helper";
import {
  getManualScheduleJobId,
  getManualScheduleJobName,
  removeExistingManualScheduleJobs,
} from "./generated-drafts-scheduler.helper";
import { EncryptionService } from "../../../common/security/encryption.service";

export async function publishDraftAction(
  prisma: PrismaService,
  dispatcher: DispatcherService,
  id: string,
  user: AuthenticatedUser,
  dto: PublishGeneratedDraftDto = {},
  encryptionService?: EncryptionService,
) {
  const draft = await findAccessibleDraft(prisma, id, user);
  assertCanManageDraft(draft.workspace.company.ownerId, user, draft.workspace.id);

  const channels = await resolvePublishingChannels(
    prisma,
    draft.workspaceId,
    dto.channels,
  );
  const result = await dispatchDraftToChannels(
    prisma,
    dispatcher,
    draft,
    channels,
    user.userId,
    encryptionService,
  );
  const nextStatus = result.successes.length > 0 ? "published" : "failed";

  const updatedDraft = await prisma.generatedDraft.update({
    where: { id: draft.id },
    data: { status: nextStatus },
  });

  await recordAuditEvent(prisma, {
    workspaceId: draft.workspaceId,
    companyId: draft.workspace.companyId,
    draftId: draft.id,
    userId: user.userId,
    action: "Published",
    status: updatedDraft.status,
    details: result,
  });

  return {
    draft: updatedDraft,
    published: result.successes.length > 0,
    successes: result.successes,
    failures: result.failures,
  };
}

export async function scheduleDraftAction(
  prisma: PrismaService,
  dispatchQueue: Queue,
  id: string,
  user: AuthenticatedUser,
  dto: ScheduleGeneratedDraftDto,
) {
  const draft = await findAccessibleDraft(prisma, id, user);
  assertCanManageDraft(draft.workspace.company.ownerId, user, draft.workspace.id);

  const scheduledAt = new Date(dto.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new BadRequestException("scheduledAt must be a valid ISO date");
  }
  if (scheduledAt.getTime() <= Date.now()) {
    throw new BadRequestException("scheduledAt must be in the future");
  }

  const channels = await resolvePublishingChannels(
    prisma,
    draft.workspaceId,
    dto.channels,
  );

  await removeExistingManualScheduleJobs(dispatchQueue, draft.id);

  await dispatchQueue.add(
    getManualScheduleJobName(draft.id),
    {
      workspaceId: draft.workspaceId,
      draftId: draft.id,
      triggerSource: "manual_schedule",
      channels: channels.map((channel) => channel.platform),
    },
    {
      jobId: getManualScheduleJobId(draft.id, scheduledAt),
      delay: scheduledAt.getTime() - Date.now(),
      removeOnComplete: true,
      removeOnFail: false,
    },
  );

  const updated = await prisma.generatedDraft.update({
    where: { id: draft.id },
    data: {
      status: "scheduled",
      scheduledAt,
    },
  });

  await recordAuditEvent(prisma, {
    workspaceId: draft.workspaceId,
    companyId: draft.workspace.companyId,
    draftId: draft.id,
    userId: user.userId,
    action: "Scheduled",
    status: updated.status,
    details: {
      scheduledAt: scheduledAt.toISOString(),
      channels: channels.map((channel) => channel.platform),
    },
  });

  return updated;
}
