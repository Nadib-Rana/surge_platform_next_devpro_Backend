import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/context/prisma.service";

@Injectable()
export class RawPostsService {
  constructor(private readonly prisma: PrismaService) {}

  async findBufferedPosts(workspaceId: string, daysInput?: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException(`Workspace ${workspaceId} not found`);
    }

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
}
