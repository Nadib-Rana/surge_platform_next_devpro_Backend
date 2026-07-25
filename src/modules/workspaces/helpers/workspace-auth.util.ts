import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/context/prisma.service";

export interface AuthenticatedUser {
  userId: string;
  role: string;
}

export async function assertCompanyOwnerOrAdmin(
  prisma: PrismaService,
  companyId: string,
  user: AuthenticatedUser,
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, ownerId: true },
  });

  if (!company) {
    throw new NotFoundException("Company not found");
  }

  if (user.role !== "admin" && company.ownerId !== user.userId) {
    throw new ForbiddenException(
      "You can only create workspaces for your own company",
    );
  }

  return company;
}

export async function assertWorkspaceAccess(
  prisma: PrismaService,
  id: string,
  user: AuthenticatedUser,
  action: "view" | "update" | "delete",
) {
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    include: { company: true },
  });

  if (!workspace) {
    throw new NotFoundException(`Workspace ${id} not found`);
  }

  if (user.role !== "admin" && workspace.company.ownerId !== user.userId) {
    if (action === "view") {
      const isMember = await prisma.workspaceMember.findFirst({
        where: { workspaceId: id, userId: user.userId },
      });
      if (!isMember) {
        throw new ForbiddenException(
          "You can only view workspaces you belong to",
        );
      }
    } else {
      throw new ForbiddenException(
        `You can only ${action} workspaces in your own company`,
      );
    }
  }

  return workspace;
}
