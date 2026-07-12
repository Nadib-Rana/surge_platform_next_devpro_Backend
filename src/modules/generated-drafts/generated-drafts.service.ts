import { InjectQueue } from "@nestjs/bullmq";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Queue } from "bullmq";
import { PrismaService } from "../../common/context/prisma.service";
import { DispatcherService } from "../dispatcher/dispatcher.service";
import { CreateGeneratedDraftDto } from "./dto/create-generated-draft.dto";
import { GeneratedDraftQueryDto } from "./dto/generated-draft-query.dto";
import { PublishGeneratedDraftDto } from "./dto/publish-generated-draft.dto";
import { ScheduleGeneratedDraftDto } from "./dto/schedule-generated-draft.dto";
import { UpdateGeneratedDraftDto } from "./dto/update-generated-draft.dto";

interface AuthenticatedUser {
  userId: string;
  role: string;
}

interface DraftEditorState {
  title?: string;
  excerpt?: string;
  slug?: string;
  hashtags?: string[];
  seoTitle?: string;
  metaDescription?: string;
}

interface DraftWorkspace {
  id: string;
  companyId: string;
  queueConfig: Prisma.JsonValue | null;
  company: { id: string; ownerId: string };
}

interface DraftRecord {
  id: string;
  workspaceId: string;
  wordpressHtmlContent: string | null;
  socialPlainText: string | null;
  imageUrl: string | null;
  imageProvider: string | null;
  editorState?: Prisma.JsonValue | null;
  generationType: string;
  status: string;
  scheduledAt?: Date | null;
  workspace: DraftWorkspace;
}

interface PublishingChannelRecord {
  id: string;
  workspaceId: string;
  platform: string;
  encryptedCredentials: string;
}

type DraftEditorPatch = {
  title?: string;
  excerpt?: string;
  slug?: string;
  hashtags?: string[];
  seoTitle?: string;
  metaDescription?: string;
};

const MANUAL_SCHEDULE_QUEUE_PREFIX = "manual-schedule";

@Injectable()
export class GeneratedDraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: DispatcherService,
    @InjectQueue("autopilot-dispatch-queue")
    private readonly dispatchQueue: Queue,
  ) {}

  async create(
    createGeneratedDraftDto: CreateGeneratedDraftDto,
    user?: AuthenticatedUser,
  ): Promise<any> {
    const input = createGeneratedDraftDto as {
      workspaceId: string;
      rawPostId?: string;
      promptVersionId: string;
      wordpressHtmlContent?: string;
      socialPlainText?: string;
      imageUrl?: string;
      imageProvider?: string;
      generationType?: string;
      status?: string;
      scheduledAt?: string;
      title?: string;
      hashtags?: string[];
    };
    const workspace = await this.assertWorkspaceReadable(
      input.workspaceId,
      user,
    );

    const draft = await this.prisma.generatedDraft.create({
      data: {
        workspaceId: input.workspaceId,
        rawPostId: input.rawPostId ?? null,
        promptVersionId: input.promptVersionId,
        wordpressHtmlContent: input.wordpressHtmlContent ?? null,
        socialPlainText: input.socialPlainText ?? null,
        imageUrl: input.imageUrl ?? null,
        imageProvider: input.imageProvider ?? null,
        generationType: input.generationType ?? "manual_on_demand",
        status: input.status ?? "draft",
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        editorState: this.buildEditorState({
          title: input.title,
          hashtags: input.hashtags,
        }) as Prisma.InputJsonValue,
      },
    });

    await this.recordAuditEvent({
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

  async findAll(
    query: GeneratedDraftQueryDto,
    user: AuthenticatedUser,
  ): Promise<any> {
    const where = this.buildDraftFilter(query, user);
    return this.prisma.generatedDraft.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<any> {
    return this.findAccessibleDraft(id, user);
  }

  async update(
    id: string,
    updateGeneratedDraftDto: UpdateGeneratedDraftDto,
    user: AuthenticatedUser,
  ): Promise<any> {
    const input = updateGeneratedDraftDto as {
      action?: "approve" | "reject" | "save";
      status?: UpdateGeneratedDraftDto["status"];
      title?: string;
      excerpt?: string;
      slug?: string;
      hashtags?: string[];
      seoTitle?: string;
      metaDescription?: string;
      wordpressHtmlContent?: string;
      socialPlainText?: string;
      imageUrl?: string;
      imageProvider?: string;
    };
    const draft = await this.findAccessibleDraft(id, user);
    this.assertCanManageDraft(
      draft.workspace.company.ownerId,
      user,
      draft.workspace.id,
    );

    const currentEditorState = this.parseEditorState(draft.editorState);
    const nextEditorState = this.mergeEditorState(currentEditorState, input);
    const hasContentChanges =
      input.wordpressHtmlContent !== undefined ||
      input.socialPlainText !== undefined ||
      input.imageUrl !== undefined ||
      input.imageProvider !== undefined ||
      input.title !== undefined ||
      input.excerpt !== undefined ||
      input.slug !== undefined ||
      input.hashtags !== undefined ||
      input.seoTitle !== undefined ||
      input.metaDescription !== undefined;

    const nextStatus = this.resolveUpdatedStatus(
      draft.status,
      updateGeneratedDraftDto,
      hasContentChanges,
    );

    const updated = await this.prisma.generatedDraft.update({
      where: { id },
      data: {
        wordpressHtmlContent:
          input.wordpressHtmlContent ?? draft.wordpressHtmlContent,
        socialPlainText: input.socialPlainText ?? draft.socialPlainText,
        imageUrl: input.imageUrl ?? draft.imageUrl,
        imageProvider: input.imageProvider ?? draft.imageProvider,
        editorState: nextEditorState as Prisma.InputJsonValue,
        status: nextStatus,
      },
    });

    await this.recordAuditEvent({
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

  async remove(id: string, user: AuthenticatedUser): Promise<any> {
    const draft = await this.findAccessibleDraft(id, user);
    this.assertCanManageDraft(
      draft.workspace.company.ownerId,
      user,
      draft.workspace.id,
    );

    const updated = await this.prisma.generatedDraft.update({
      where: { id },
      data: { status: "deleted" },
    });

    await this.recordAuditEvent({
      workspaceId: draft.workspaceId,
      companyId: draft.workspace.companyId,
      draftId: draft.id,
      userId: user.userId,
      action: "Deleted",
      status: updated.status,
    });

    return updated;
  }

  async publish(
    id: string,
    user: AuthenticatedUser,
    dto: PublishGeneratedDraftDto = {},
  ): Promise<any> {
    const draft = await this.findAccessibleDraft(id, user);
    this.assertCanManageDraft(
      draft.workspace.company.ownerId,
      user,
      draft.workspace.id,
    );

    const channels = await this.resolvePublishingChannels(
      draft.workspaceId,
      dto.channels,
    );
    const result = await this.dispatchDraftToChannels(draft, channels);
    const nextStatus = result.successes.length > 0 ? "published" : "failed";

    const updatedDraft = await this.prisma.generatedDraft.update({
      where: { id: draft.id },
      data: { status: nextStatus },
    });

    await this.recordAuditEvent({
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

  async schedule(
    id: string,
    user: AuthenticatedUser,
    dto: ScheduleGeneratedDraftDto,
  ): Promise<any> {
    const draft = await this.findAccessibleDraft(id, user);
    this.assertCanManageDraft(
      draft.workspace.company.ownerId,
      user,
      draft.workspace.id,
    );

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException("scheduledAt must be a valid ISO date");
    }
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException("scheduledAt must be in the future");
    }

    const channels = await this.resolvePublishingChannels(
      draft.workspaceId,
      dto.channels,
    );

    await this.removeExistingManualScheduleJobs(draft.id);

    await this.dispatchQueue.add(
      `${MANUAL_SCHEDULE_QUEUE_PREFIX}:${draft.id}`,
      {
        workspaceId: draft.workspaceId,
        draftId: draft.id,
        triggerSource: "manual_schedule",
        channels: channels.map((channel) => channel.platform),
      },
      {
        jobId: `${MANUAL_SCHEDULE_QUEUE_PREFIX}:${draft.id}:${scheduledAt.toISOString()}`,
        delay: scheduledAt.getTime() - Date.now(),
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    const updated = await this.prisma.generatedDraft.update({
      where: { id: draft.id },
      data: {
        status: "scheduled",
        scheduledAt,
      },
    });

    await this.recordAuditEvent({
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

  async applyAutoPostPolicy(draftId: string): Promise<any> {
    const draft = await this.findDraftWithWorkspace(draftId);
    const autoPost = Boolean(
      this.parseJsonRecord(draft.workspace.queueConfig).autoPost,
    );

    if (!autoPost) {
      const updated =
        draft.status === "review"
          ? draft
          : await this.prisma.generatedDraft.update({
              where: { id: draft.id },
              data: { status: "review" },
            });

      await this.recordAuditEvent({
        workspaceId: draft.workspaceId,
        companyId: draft.workspace.companyId,
        draftId: draft.id,
        userId: draft.workspace.company.ownerId,
        action: "QueuedForReview",
        status: updated.status,
        details: { autoPost: false },
      });

      return updated;
    }

    const channels = await this.resolvePublishingChannels(draft.workspaceId);
    const result = await this.dispatchDraftToChannels(
      draft,
      channels,
      draft.workspace.company.ownerId,
    );

    const finalStatus = result.successes.length > 0 ? "published" : "failed";
    const updated = await this.prisma.generatedDraft.update({
      where: { id: draft.id },
      data: { status: finalStatus },
    });

    await this.recordAuditEvent({
      workspaceId: draft.workspaceId,
      companyId: draft.workspace.companyId,
      draftId: draft.id,
      userId: draft.workspace.company.ownerId,
      action: "AutoPost",
      status: updated.status,
      details: {
        autoPost: true,
        successes: result.successes,
        failures: result.failures,
      },
    });

    return updated;
  }

  async getWorkspaceAutoPostMode(workspaceId: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { queueConfig: true },
    });

    return Boolean(this.parseJsonRecord(workspace?.queueConfig).autoPost);
  }

  private async findAccessibleDraft(
    id: string,
    user: AuthenticatedUser,
  ): Promise<DraftRecord> {
    const draft = (await this.prisma.generatedDraft.findFirst({
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

  private async findDraftWithWorkspace(id: string): Promise<DraftRecord> {
    const draft = (await this.prisma.generatedDraft.findUnique({
      where: { id },
      include: { workspace: { include: { company: true } } },
    })) as DraftRecord | null;

    if (!draft) {
      throw new NotFoundException(`Generated draft ${id} not found`);
    }

    return draft;
  }

  private async assertWorkspaceReadable(
    workspaceId: string,
    user?: AuthenticatedUser,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
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

    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: user.userId },
    });

    if (!membership) {
      throw new ForbiddenException("You do not have access to this workspace");
    }

    return workspace;
  }

  private buildDraftFilter(
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

  private async resolvePublishingChannels(
    workspaceId: string,
    requestedChannels?: string[],
  ): Promise<PublishingChannelRecord[]> {
    const where: Prisma.PublishingChannelWhereInput = {
      workspaceId,
      isActive: true,
    };

    if (requestedChannels?.length) {
      where.platform = { in: requestedChannels };
    }

    const channels = (await this.prisma.publishingChannel.findMany({
      where,
    })) as PublishingChannelRecord[];

    if (!channels.length) {
      throw new BadRequestException(
        "No active publishing channels found for this workspace",
      );
    }

    if (requestedChannels?.length) {
      const foundPlatforms = new Set(
        channels.map((channel) => channel.platform),
      );
      const missing = requestedChannels.filter(
        (channel) => !foundPlatforms.has(channel),
      );

      if (missing.length) {
        throw new BadRequestException(
          `Selected channels are not active or not configured: ${missing.join(", ")}`,
        );
      }
    }

    return channels;
  }

  private async dispatchDraftToChannels(
    draft: DraftRecord,
    channels: PublishingChannelRecord[],
    actorUserId = "system",
  ): Promise<{
    successes: Array<{ channel: string; url?: string; id?: string }>;
    failures: Array<{ channel: string; error: string }>;
    actorUserId: string;
  }> {
    const successes: Array<{ channel: string; url?: string; id?: string }> = [];
    const failures: Array<{ channel: string; error: string }> = [];

    for (const channel of channels) {
      const idempotencyKey = `${draft.id}:${channel.id}`;
      let publishLog = await this.prisma.publishedPostsLog.findUnique({
        where: { idempotencyKey },
      });

      if (!publishLog) {
        publishLog = await this.prisma.publishedPostsLog.create({
          data: {
            draftId: draft.id,
            channelId: channel.id,
            idempotencyKey,
            status: "retrying",
            retryCount: 0,
          },
        });
      } else {
        await this.prisma.publishedPostsLog.update({
          where: { id: publishLog.id },
          data: {
            status: "retrying",
            retryCount: publishLog.retryCount + 1,
          },
        });
      }

      const dispatchResult = await this.dispatcher.dispatch(
        this.buildDispatchPayload(draft, channel),
      );

      if (dispatchResult.success) {
        await this.prisma.publishedPostsLog.update({
          where: { id: publishLog.id },
          data: {
            status: "sent",
            livePostUrl: dispatchResult.url ?? null,
          },
        });

        successes.push({
          channel: channel.platform,
          url: dispatchResult.url,
          id: dispatchResult.id,
        });
      } else {
        await this.prisma.publishedPostsLog.update({
          where: { id: publishLog.id },
          data: { status: "failed" },
        });

        failures.push({
          channel: channel.platform,
          error:
            dispatchResult.error ?? `Failed to dispatch ${channel.platform}`,
        });
      }
    }

    return { successes, failures, actorUserId };
  }

  private buildDispatchPayload(
    draft: DraftRecord,
    channel: PublishingChannelRecord,
  ) {
    const editorState = this.parseEditorState(draft.editorState);
    const title =
      editorState.title ?? editorState.seoTitle ?? "Surge Platform Draft";
    const content = this.resolveChannelContent(
      channel.platform,
      draft,
      editorState,
    );

    return {
      channel: channel.platform,
      title,
      content,
      images: draft.imageUrl ? [draft.imageUrl] : undefined,
      credentials: this.parseJsonRecord(channel.encryptedCredentials),
      metadata: {
        draftId: draft.id,
        workspaceId: draft.workspaceId,
        imageProvider: draft.imageProvider ?? undefined,
        editorState,
      },
    };
  }

  private resolveChannelContent(
    platform: string,
    draft: DraftRecord,
    editorState: DraftEditorState,
  ) {
    if (platform.toLowerCase() === "wordpress") {
      return draft.wordpressHtmlContent || draft.socialPlainText || "";
    }

    if (draft.socialPlainText?.trim()) {
      return draft.socialPlainText.trim();
    }

    return this.stripHtml(
      draft.wordpressHtmlContent ?? editorState.excerpt ?? "",
    );
  }

  private resolveUpdatedStatus(
    currentStatus: string,
    dto: UpdateGeneratedDraftDto,
    hasContentChanges: boolean,
  ) {
    if (dto.action === "approve") return "approved";
    if (dto.action === "reject") return "rejected";
    if (dto.status) return dto.status;
    if (
      hasContentChanges &&
      ["published", "failed", "rejected"].includes(currentStatus)
    ) {
      return "review";
    }
    return currentStatus;
  }

  private async removeExistingManualScheduleJobs(draftId: string) {
    const jobs = await this.dispatchQueue.getJobs([
      "delayed",
      "waiting",
      "active",
      "paused",
    ]);

    await Promise.all(
      jobs
        .filter(
          (job) => job.name === `${MANUAL_SCHEDULE_QUEUE_PREFIX}:${draftId}`,
        )
        .map((job) => job.remove()),
    );
  }

  private parseEditorState(
    value: Prisma.JsonValue | null | undefined,
  ): DraftEditorState {
    const record = this.parseJsonRecord(value);

    return {
      title: this.asString(record.title),
      excerpt: this.asString(record.excerpt),
      slug: this.asString(record.slug),
      hashtags: Array.isArray(record.hashtags)
        ? record.hashtags.filter(
            (item): item is string => typeof item === "string",
          )
        : undefined,
      seoTitle: this.asString(record.seoTitle),
      metaDescription: this.asString(record.metaDescription),
    };
  }

  private mergeEditorState(
    existing: DraftEditorState,
    update: DraftEditorPatch,
  ) {
    return {
      title: update.title ?? existing.title,
      excerpt: update.excerpt ?? existing.excerpt,
      slug: update.slug ?? existing.slug,
      hashtags: update.hashtags ?? existing.hashtags,
      seoTitle: update.seoTitle ?? existing.seoTitle,
      metaDescription: update.metaDescription ?? existing.metaDescription,
    };
  }

  private buildEditorState(value: DraftEditorState) {
    return {
      title: value.title,
      excerpt: value.excerpt,
      slug: value.slug,
      hashtags: value.hashtags,
      seoTitle: value.seoTitle,
      metaDescription: value.metaDescription,
    };
  }

  private parseJsonRecord(value: Prisma.JsonValue | string | null | undefined) {
    if (!value) return {} as Record<string, any>;

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, any>;
        }
      } catch {
        return {} as Record<string, any>;
      }

      return {} as Record<string, any>;
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, any>;
    }

    return {} as Record<string, any>;
  }

  private asString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private stripHtml(content: string) {
    return content
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private assertCanManageDraft(
    companyOwnerId: string,
    user: AuthenticatedUser,
    workspaceId: string,
  ) {
    if (user.role === "admin") return;
    if (companyOwnerId === user.userId) return;

    throw new ForbiddenException(
      `You do not have permission to manage generated drafts in workspace ${workspaceId}`,
    );
  }

  private async recordAuditEvent(input: {
    workspaceId: string;
    companyId: string;
    draftId: string;
    userId: string;
    action: string;
    status: string;
    details?: Record<string, unknown>;
  }) {
    await this.prisma.systemLog.create({
      data: {
        traceId: `draft:${input.draftId}:${input.action}:${Date.now()}`,
        companyId: input.companyId,
        serviceName: "GeneratedDraftsService",
        message: JSON.stringify({
          workspaceId: input.workspaceId,
          draftId: input.draftId,
          userId: input.userId,
          action: input.action,
          status: input.status,
          time: new Date().toISOString(),
          ...(input.details ? { details: input.details } : {}),
        }),
        level: "INFO",
      },
    });
  }
}
