import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/context/prisma.service";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";

interface AuthenticatedUser {
  userId: string;
  role: string;
}

interface QueueConfig {
  autoPost?: boolean;
  fetchFrequencyHours?: number;
  postingTimes?: string[];
}

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

    const company = await this.prisma.company.findUnique({
      where: { id: createWorkspaceDto.companyId },
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
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: { company: true },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace ${id} not found`);
    }

    if (user.role !== "admin" && workspace.company.ownerId !== user.userId) {
      const isMember = await this.prisma.workspaceMember.findFirst({
        where: { workspaceId: id, userId: user.userId },
      });
      if (!isMember) {
        throw new ForbiddenException(
          "You can only view workspaces you belong to",
        );
      }
    }

    return workspace;
  }

  async update(
    id: string,
    updateWorkspaceDto: Partial<CreateWorkspaceDto>,
    user: AuthenticatedUser,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: { company: true },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace ${id} not found`);
    }

    if (user.role !== "admin" && workspace.company.ownerId !== user.userId) {
      throw new ForbiddenException(
        "You can only update workspaces in your own company",
      );
    }

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
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: { company: true },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace ${id} not found`);
    }

    if (user.role !== "admin" && workspace.company.ownerId !== user.userId) {
      throw new ForbiddenException(
        "You can only delete workspaces in your own company",
      );
    }

    return this.prisma.workspace.delete({ where: { id } });
  }

  async updateQueueConfig(workspaceId: string, config: QueueConfig) {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!ws) throw new Error("Workspace not found");

    const currentConfig = (ws.queueConfig as QueueConfig | null) ?? {};
    const mergedConfig: QueueConfig = {
      ...currentConfig,
      ...config,
      autoPost: config.autoPost ?? currentConfig.autoPost ?? false,
    };

    const updated = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { queueConfig: mergedConfig as any },
    });
    return updated;
  }
}
