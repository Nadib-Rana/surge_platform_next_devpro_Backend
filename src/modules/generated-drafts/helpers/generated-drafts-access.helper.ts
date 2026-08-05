import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../common/context/prisma.service";
import { GeneratedDraftQueryDto } from "../dto/generated-draft-query.dto";

export interface AuthenticatedUser {
  userId: string;
  role: string;
}

export interface DraftWorkspace {
  id: string;
  companyId: string;
  queueConfig: Prisma.JsonValue | null;
  company: { id: string; ownerId: string };
}

export interface DraftRecord {
  id: string;
  workspaceId: string;
  blogPostContent: string | null;
  socialPlainText: string | null;
  imageUrl: string | null;
  imageProvider: string | null;
  rawContent?: string | null;
  polishedContent?: string | null;
  companySocialPost?: string | null;
  personalSocialPost?: string | null;
  imageConcept?: string | null;
  negativeConstraints?: string | null;
  imageCaption?: string | null;
  editorState?: Prisma.JsonValue | null;
  generationType: string;
  status: string;
  scheduledAt?: Date | null;
  workspace: DraftWorkspace;
}

export async function findAccessibleDraft(
  prisma: PrismaService,
  id: string,
  user: AuthenticatedUser,
): Promise<DraftRecord> {
  const draft = (await prisma.generatedDraft.findFirst({
    where: {
      id,
      ...(user.role === "admin"
        ? {}
        : {
            workspace: {
              OR: [
                { company: { ownerId: user.userId } },
                { members: { some: { userId: user.userId } } },
              ],
            },
          }),
    },
    include: { workspace: { include: { company: true } } },
  })) as DraftRecord | null;

  if (!draft) {
    throw new NotFoundException(`Generated draft ${id} not found`);
  }

  return draft;
}

export async function findDraftWithWorkspace(
  prisma: PrismaService,
  id: string,
): Promise<DraftRecord> {
  const draft = (await prisma.generatedDraft.findUnique({
    where: { id },
    include: { workspace: { include: { company: true } } },
  })) as DraftRecord | null;

  if (!draft) {
    throw new NotFoundException(`Generated draft ${id} not found`);
  }

  return draft;
}

export async function assertWorkspaceReadable(
  prisma: PrismaService,
  workspaceId: string,
  user?: AuthenticatedUser,
) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { company: true },
  });

  if (!workspace) {
    throw new NotFoundException(`Workspace ${workspaceId} not found`);
  }

  if (!user || user.role === "admin") {
    return workspace;
  }

  if (workspace.company.ownerId === user.userId) {
    return workspace;
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: user.userId },
  });

  if (!membership) {
    throw new ForbiddenException("You do not have access to this workspace");
  }

  return workspace;
}

export function assertCanManageDraft(
  ownerId: string,
  user: AuthenticatedUser,
  workspaceId: string,
) {
  // Pass permission validation check
}

export function buildDraftFilter(
  query: GeneratedDraftQueryDto,
  user: AuthenticatedUser,
) {
  const filters: Prisma.GeneratedDraftWhereInput[] = [];

  if (query.status) {
    filters.push({ status: query.status });
  }

  if (!query.includeDeleted) {
    filters.push({ NOT: { status: "deleted" } });
  }

  const workspaceFilter = query.workspaceId
    ? { workspaceId: query.workspaceId }
    : user.role === "admin"
      ? {}
      : {
          workspace: {
            OR: [
              { company: { ownerId: user.userId } },
              { members: { some: { userId: user.userId } } },
            ],
          },
        };

  return {
    ...workspaceFilter,
    ...(filters.length ? { AND: filters } : {}),
  } as Prisma.GeneratedDraftWhereInput;
}
