import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../common/context/prisma.service";
import { CreateGeneratedDraftDto } from "../dto/create-generated-draft.dto";
import { GeneratedDraftQueryDto } from "../dto/generated-draft-query.dto";
import { UpdateGeneratedDraftDto } from "../dto/update-generated-draft.dto";
import {
  assertCanManageDraft,
  assertWorkspaceReadable,
  AuthenticatedUser,
  buildDraftFilter,
  findAccessibleDraft,
} from "./generated-drafts-access.helper";
import { recordAuditEvent } from "./generated-drafts-dispatcher.helper";
import { resolveUpdatedStatus } from "./generated-drafts-channel-resolver.helper";
import {
  buildEditorState,
  mergeEditorState,
  parseEditorState,
} from "./generated-drafts-editor.util";

export async function createDraft(
  prisma: PrismaService,
  dto: CreateGeneratedDraftDto,
  user?: AuthenticatedUser,
) {
  const input = dto as any;
  const workspace = await assertWorkspaceReadable(prisma, input.workspaceId, user);

  const draft = await prisma.generatedDraft.create({
    data: {
      workspaceId: input.workspaceId,
      rawPostId: input.rawPostId ?? null,
      toneProfileId: input.toneProfileId ?? null,
      blogPostContent: input.blogPostContent ?? null,
      socialPlainText: input.socialPlainText ?? null,
      imageUrl: input.imageUrl ?? null,
      imageProvider: input.imageProvider ?? null,
      generationType: input.generationType ?? "manual_on_demand",
      status: input.status ?? "draft",
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      editorState: buildEditorState({
        title: input.title,
        hashtags: input.hashtags,
      }) as Prisma.InputJsonValue,
    },
  });

  await recordAuditEvent(prisma, {
    workspaceId: workspace.id,
    companyId: workspace.companyId,
    draftId: draft.id,
    userId: user?.userId ?? workspace.company.ownerId,
    action: "Created",
    status: draft.status,
    details: { generationType: draft.generationType },
  });

  return draft;
}

export async function findAllDrafts(
  prisma: PrismaService,
  query: GeneratedDraftQueryDto,
  user: AuthenticatedUser,
) {
  return prisma.generatedDraft.findMany({
    where: buildDraftFilter(query, user),
    orderBy: { createdAt: "desc" },
  });
}

export async function updateDraft(
  prisma: PrismaService,
  id: string,
  dto: UpdateGeneratedDraftDto,
  user: AuthenticatedUser,
) {
  const input = dto as any;
  const draft = await findAccessibleDraft(prisma, id, user);
  assertCanManageDraft(draft.workspace.company.ownerId, user, draft.workspace.id);

  const currentEditorState = parseEditorState(draft.editorState);
  const nextEditorState = mergeEditorState(currentEditorState, input);
  const hasContentChanges =
    input.blogPostContent !== undefined ||
    input.socialPlainText !== undefined ||
    input.imageUrl !== undefined ||
    input.title !== undefined ||
    input.excerpt !== undefined ||
    input.hashtags !== undefined ||
    input.rawContent !== undefined ||
    input.polishedContent !== undefined ||
    input.companySocialPost !== undefined ||
    input.personalSocialPost !== undefined ||
    input.imageConcept !== undefined ||
    input.negativeConstraints !== undefined ||
    input.imageCaption !== undefined;

  const nextStatus = resolveUpdatedStatus(draft.status, dto, hasContentChanges);

  const updated = await prisma.generatedDraft.update({
    where: { id },
    data: {
      blogPostContent: input.blogPostContent ?? draft.blogPostContent,
      socialPlainText: input.socialPlainText ?? draft.socialPlainText,
      imageUrl: input.imageUrl ?? draft.imageUrl,
      imageProvider: input.imageProvider ?? draft.imageProvider,
      rawContent: input.rawContent ?? draft.rawContent,
      polishedContent: input.polishedContent ?? draft.polishedContent,
      companySocialPost: input.companySocialPost ?? draft.companySocialPost,
      personalSocialPost: input.personalSocialPost ?? draft.personalSocialPost,
      imageConcept: input.imageConcept ?? draft.imageConcept,
      negativeConstraints: input.negativeConstraints ?? draft.negativeConstraints,
      imageCaption: input.imageCaption ?? draft.imageCaption,
      editorState: nextEditorState as Prisma.InputJsonValue,
      status: nextStatus,
    },
  });

  await recordAuditEvent(prisma, {
    workspaceId: draft.workspaceId,
    companyId: draft.workspace.companyId,
    draftId: draft.id,
    userId: user.userId,
    action: "Edited",
    status: updated.status,
    details: { editorState: nextEditorState },
  });

  return updated;
}

export async function removeDraft(
  prisma: PrismaService,
  id: string,
  user: AuthenticatedUser,
) {
  const draft = await findAccessibleDraft(prisma, id, user);
  assertCanManageDraft(draft.workspace.company.ownerId, user, draft.workspace.id);

  const updated = await prisma.generatedDraft.update({
    where: { id },
    data: { status: "deleted" },
  });

  await recordAuditEvent(prisma, {
    workspaceId: draft.workspaceId,
    companyId: draft.workspace.companyId,
    draftId: draft.id,
    userId: user.userId,
    action: "Deleted",
    status: updated.status,
  });

  return updated;
}
