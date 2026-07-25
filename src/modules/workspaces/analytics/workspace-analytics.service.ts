import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/context/prisma.service";

@Injectable()
export class WorkspaceAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkspaceAnalytics(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { company: true },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace ${workspaceId} not found`);
    }

    const [drafts, rssCount, channelsCount, auditLogs] = await Promise.all([
      this.prisma.generatedDraft.findMany({
        where: { workspaceId },
        select: { status: true, createdAt: true },
      }),
      this.prisma.rssFeed.count({
        where: { workspaceId, status: "active" },
      }),
      this.prisma.publishingChannel.count({
        where: { workspaceId, isActive: true },
      }),
      this.prisma.auditEvent.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    const totalDrafts = drafts.length;
    const published = drafts.filter((d) => d.status === "published").length;
    const failed = drafts.filter((d) => d.status === "failed").length;
    const review = drafts.filter((d) => d.status === "review").length;
    const pending = drafts.filter((d) => d.status === "draft").length;

    const attempted = published + failed;
    const successRatePercent =
      attempted > 0 ? Math.round((published / attempted) * 100) : 100;

    return {
      workspaceId,
      companyTier: workspace.company.subscriptionTier,
      overview: {
        totalDrafts,
        published,
        failed,
        review,
        pending,
        successRatePercent,
        activeRssFeeds: rssCount,
        activeChannels: channelsCount,
      },
      auditLogs,
    };
  }
}
