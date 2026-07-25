import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/context/prisma.service";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import {
  mergeQueueConfig,
  QueueConfig,
} from "./helpers/workspace-config.util";
import {
  assertCompanyOwnerOrAdmin,
  assertWorkspaceAccess,
  AuthenticatedUser,
} from "./helpers/workspace-auth.util";

@Injectable()
export class WorkspacesService {
  constructor(private prisma: PrismaService) {}

  async create(
    createWorkspaceDto: CreateWorkspaceDto,
    user: AuthenticatedUser,
  ) {
    if (!createWorkspaceDto.name?.trim()) {
      throw new BadRequestException("Workspace name is required");
    }

    await assertCompanyOwnerOrAdmin(
      this.prisma,
      createWorkspaceDto.companyId,
      user,
    );

    const workspace = await this.prisma.workspace.create({
      data: {
        companyId: createWorkspaceDto.companyId,
        name: createWorkspaceDto.name.trim(),
        timezone: createWorkspaceDto.timezone ?? "UTC",
        queueConfig: {
          fetchFrequencyHours: 24,
          postingTimes: ["09:00"],
          autoPost: false,
        },
      },
    });

    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.userId,
        role: user.role === "admin" ? "admin" : "owner",
      },
    });

    return workspace;
  }

  async findAll(user: AuthenticatedUser) {
    if (user.role === "admin") {
      return this.prisma.workspace.findMany({
        orderBy: { createdAt: "desc" },
        include: { company: true },
      });
    }

    return this.prisma.workspace.findMany({
      where: {
        OR: [
          { company: { ownerId: user.userId } },
          { members: { some: { userId: user.userId } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: { company: true },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    return assertWorkspaceAccess(this.prisma, id, user, "view");
  }

  async update(
    id: string,
    updateWorkspaceDto: Partial<CreateWorkspaceDto>,
    user: AuthenticatedUser,
  ) {
    await assertWorkspaceAccess(this.prisma, id, user, "update");

    const data: Record<string, unknown> = {};
    if (updateWorkspaceDto.name) {
      data.name = updateWorkspaceDto.name.trim();
    }
    if (updateWorkspaceDto.timezone) {
      data.timezone = updateWorkspaceDto.timezone;
    }

    return this.prisma.workspace.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    await assertWorkspaceAccess(this.prisma, id, user, "delete");
    return this.prisma.workspace.delete({ where: { id } });
  }

  async updateQueueConfig(workspaceId: string, config: QueueConfig) {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!ws) throw new Error("Workspace not found");

    const mergedConfig = mergeQueueConfig(
      ws.queueConfig as QueueConfig | null,
      config,
    );

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { queueConfig: mergedConfig as any },
    });
  }
}
