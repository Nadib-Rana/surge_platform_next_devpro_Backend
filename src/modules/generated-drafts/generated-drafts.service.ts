import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { PrismaService } from "../../common/context/prisma.service";
import { DispatcherService } from "../dispatcher/dispatcher.service";
import { EncryptionService } from "../../common/security/encryption.service";
import { CreateGeneratedDraftDto } from "./dto/create-generated-draft.dto";
import { GeneratedDraftQueryDto } from "./dto/generated-draft-query.dto";
import { PublishGeneratedDraftDto } from "./dto/publish-generated-draft.dto";
import { ScheduleGeneratedDraftDto } from "./dto/schedule-generated-draft.dto";
import { UpdateGeneratedDraftDto } from "./dto/update-generated-draft.dto";
import {
  AuthenticatedUser,
  findAccessibleDraft,
} from "./helpers/generated-drafts-access.helper";
import {
  createDraft,
  findAllDrafts,
  removeDraft,
  updateDraft,
} from "./helpers/generated-drafts-crud.helper";
import {
  publishDraftAction,
  scheduleDraftAction,
} from "./helpers/generated-drafts-actions.helper";
import { applyAutoPostPolicyAction } from "./helpers/generated-drafts-autopost.helper";
import { parseJsonRecord } from "./helpers/generated-drafts-editor.util";

@Injectable()
export class GeneratedDraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: DispatcherService,
    private readonly encryptionService: EncryptionService,
    @InjectQueue("autopilot-dispatch-queue")
    private readonly dispatchQueue: Queue,
  ) {}

  async create(
    createGeneratedDraftDto: CreateGeneratedDraftDto,
    user?: AuthenticatedUser,
  ): Promise<any> {
    return createDraft(this.prisma, createGeneratedDraftDto, user);
  }

  async findAll(
    query: GeneratedDraftQueryDto,
    user: AuthenticatedUser,
  ): Promise<any> {
    return findAllDrafts(this.prisma, query, user);
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<any> {
    return findAccessibleDraft(this.prisma, id, user);
  }

  async update(
    id: string,
    updateGeneratedDraftDto: UpdateGeneratedDraftDto,
    user: AuthenticatedUser,
  ): Promise<any> {
    return updateDraft(this.prisma, id, updateGeneratedDraftDto, user);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<any> {
    return removeDraft(this.prisma, id, user);
  }

  async publish(
    id: string,
    user: AuthenticatedUser,
    dto: PublishGeneratedDraftDto = {},
  ): Promise<any> {
    return publishDraftAction(
      this.prisma,
      this.dispatcher,
      id,
      user,
      dto,
      this.encryptionService,
    );
  }

  async schedule(
    id: string,
    user: AuthenticatedUser,
    dto: ScheduleGeneratedDraftDto,
  ): Promise<any> {
    return scheduleDraftAction(
      this.prisma,
      this.dispatchQueue,
      id,
      user,
      dto,
    );
  }

  async applyAutoPostPolicy(draftId: string): Promise<any> {
    return applyAutoPostPolicyAction(this.prisma, this.dispatcher, draftId);
  }

  async getWorkspaceAutoPostMode(workspaceId: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { queueConfig: true },
    });

    return Boolean(parseJsonRecord(workspace?.queueConfig).autoPost);
  }
}
