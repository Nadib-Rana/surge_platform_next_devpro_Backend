import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/context/prisma.service";

interface AuthenticatedUser {
  userId: string;
  role: string;
}

@Injectable()
export class RawPostsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureWorkspaceAccess(
    workspaceId: string,
    user?: AuthenticatedUser,
    message = "You can only view buffered posts from workspaces you own or belong to",
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { company: true },
    });
    if (!workspace) {
      throw new NotFoundException(`Workspace ${workspaceId} not found`);
    }

    if (user && user.role !== "admin") {
      const isOwner = workspace.company?.ownerId === user.userId;
      const isMember = await this.prisma.workspaceMember.findFirst({
        where: { workspaceId, userId: user.userId },
      });

      if (!isOwner && !isMember) {
        throw new ForbiddenException(message);
      }
    }

    return workspace;
  }

  async findBufferedPosts(
    workspaceId: string,
    daysInput?: string,
    user?: AuthenticatedUser,
  ) {
    await this.ensureWorkspaceAccess(workspaceId, user);

    const days = Number(daysInput ?? "3");
    const safeDays = Number.isFinite(days) && days > 0 ? days : 3;
    const since = new Date();
    since.setDate(since.getDate() - safeDays);

    return this.prisma.rawPostsBuffer.findMany({
      where: {
        workspaceId,
        status: "buffered",
        publishedAt: {
          gte: since,
        },
      },
      orderBy: { publishedAt: "desc" },
      take: 100,
    });
  }

  async findBufferedPostById(
    workspaceId: string,
    bufferPostId: string,
    user?: AuthenticatedUser,
  ) {
    await this.ensureWorkspaceAccess(workspaceId, user);

    const post = await this.prisma.rawPostsBuffer.findFirst({
      where: { id: bufferPostId, workspaceId },
    });

    if (!post) {
      throw new NotFoundException(`Buffered post ${bufferPostId} not found`);
    }

    return post;
  }

  async updateBufferedPost(
    workspaceId: string,
    bufferPostId: string,
    user?: AuthenticatedUser,
  ) {
    await this.ensureWorkspaceAccess(workspaceId, user);

    const post = await this.prisma.rawPostsBuffer.findFirst({
      where: { id: bufferPostId, workspaceId },
    });

    if (!post) {
      throw new NotFoundException(`Buffered post ${bufferPostId} not found`);
    }

    return this.prisma.rawPostsBuffer.update({
      where: { id: bufferPostId },
      data: { status: "buffered" },
    });
  }

  async deleteBufferedPost(
    workspaceId: string,
    bufferPostId: string,
    user?: AuthenticatedUser,
  ) {
    await this.ensureWorkspaceAccess(workspaceId, user);

    const post = await this.prisma.rawPostsBuffer.findFirst({
      where: { id: bufferPostId, workspaceId },
    });

    if (!post) {
      throw new NotFoundException(`Buffered post ${bufferPostId} not found`);
    }

    await this.prisma.rawPostsBuffer.delete({ where: { id: bufferPostId } });

    return { id: bufferPostId, deleted: true };
  }
}
