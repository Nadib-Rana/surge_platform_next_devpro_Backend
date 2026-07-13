import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/context/prisma.service";
import { CreateRssSourceDto } from "./dto/create-rss-source.dto";
import { RssSchedulerService } from "./rss-scheduler.service";

interface UpdateRssSourceDto {
  feedUrl?: string;
  status?: string;
}
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "../../common/exceptions/http.exceptions";

@Injectable()
export class RssSourcesService {
  constructor(
    private prisma: PrismaService,
    private scheduler: RssSchedulerService,
  ) {}

  private async getWorkspaceAndCompanyOwner(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { company: true },
    });
    if (!workspace) throw new NotFoundException("Workspace not found");
    if (!workspace.company)
      throw new BadRequestException("Workspace has no company");
    return { workspace, company: workspace.company };
  }

  private async checkSubscriptionLimit(
    companyOwnerId: string,
    workspaceId: string,
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId: companyOwnerId },
    });

    const tier = (subscription?.tier || "starter").toLowerCase();
    const limits: Record<string, number> = {
      starter: 5,
      pro: 20,
      business: 50,
    };
    const limit = limits[tier] ?? 5;

    const activeCount = await this.prisma.rssFeed.count({
      where: { workspaceId, status: "active" },
    });

    if (activeCount >= limit) {
      throw new ForbiddenException(
        `Your subscription tier (${tier}) allows maximum ${limit} active RSS feeds.`,
      );
    }
  }

  async create(workspaceId: string, dto: CreateRssSourceDto) {
    const { workspace, company } =
      await this.getWorkspaceAndCompanyOwner(workspaceId);

    // Check subscription limits
    await this.checkSubscriptionLimit(company.ownerId, workspaceId);

    const created = await this.prisma.rssFeed.create({
      data: {
        workspaceId,
        feedUrl: dto.feedUrl,
        status: "active",
      },
    });

    // Ensure scheduler registers job
    await this.scheduler.scheduleFeedJob(
      workspaceId,
      created.id,
      created.feedUrl,
    );

    return created;
  }

  async list(workspaceId: string) {
    await this.getWorkspaceAndCompanyOwner(workspaceId); // validate existence
    return this.prisma.rssFeed.findMany({
      where: { workspaceId, status: "active" },
    });
  }

  async getOne(workspaceId: string, sourceId: string) {
    await this.getWorkspaceAndCompanyOwner(workspaceId);

    const feed = await this.prisma.rssFeed.findFirst({
      where: { id: sourceId, workspaceId },
    });

    if (!feed) {
      throw new NotFoundException("RSS feed not found");
    }

    return feed;
  }

  async update(workspaceId: string, sourceId: string, dto: UpdateRssSourceDto) {
    await this.getWorkspaceAndCompanyOwner(workspaceId);

    const feed = await this.prisma.rssFeed.findFirst({
      where: { id: sourceId, workspaceId },
    });

    if (!feed) {
      throw new NotFoundException("RSS feed not found");
    }

    const data: Record<string, unknown> = {};
    if (dto.feedUrl) data.feedUrl = dto.feedUrl;
    if (dto.status) data.status = dto.status;

    if (Object.keys(data).length === 0) {
      return feed;
    }

    return this.prisma.rssFeed.update({
      where: { id: sourceId },
      data,
    });
  }

  async remove(workspaceId: string, sourceId: string, force = false) {
    const feed = await this.prisma.rssFeed.findUnique({
      where: { id: sourceId },
    });
    if (!feed || feed.workspaceId !== workspaceId)
      throw new NotFoundException("RSS feed not found");

    if (force) {
      // hard delete
      await this.prisma.rssFeed.delete({ where: { id: sourceId } });
    } else {
      // soft delete: set status to 'inactive'
      await this.prisma.rssFeed.update({
        where: { id: sourceId },
        data: { status: "inactive" },
      });
    }

    // remove scheduler job
    await this.scheduler.removeFeedJob(workspaceId, sourceId);

    return { id: sourceId, deleted: true };
  }
}
