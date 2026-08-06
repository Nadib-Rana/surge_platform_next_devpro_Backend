import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/context/prisma.service";
import { EncryptionService } from "../../common/security/encryption.service";
import { CreatePublishingChannelDto } from "./dto/create-publishing-channel.dto";
import { UpdatePublishingChannelDto } from "./dto/update-publishing-channel.dto";
import { assertWorkspaceAccess, AuthenticatedUser } from "../workspaces/helpers/workspace-auth.util";

@Injectable()
export class PublishingChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async create(dto: CreatePublishingChannelDto, user: AuthenticatedUser) {
    if (dto.workspaceId) {
      await assertWorkspaceAccess(this.prisma, dto.workspaceId, user, "update");
    }

    const encryptedCredentials = this.encryptionService.encrypt(
      dto.credentials,
    );

    const channel = await this.prisma.publishingChannel.create({
      data: {
        workspaceId: dto.workspaceId,
        platform: dto.platform,
        encryptedCredentials,
        isActive: dto.isActive ?? true,
      },
    });

    return this.sanitizeChannel(channel);
  }

  async findAll(workspaceId: string | undefined, user: AuthenticatedUser) {
    if (workspaceId) {
      await assertWorkspaceAccess(this.prisma, workspaceId, user, "view");
    }

    const channels = await this.prisma.publishingChannel.findMany({
      where: workspaceId ? { workspaceId } : {},
      orderBy: { createdAt: "desc" },
    });

    return channels.map((channel) => this.sanitizeChannel(channel));
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const channel = await this.prisma.publishingChannel.findUnique({
      where: { id },
    });

    if (!channel) {
      throw new NotFoundException(`Publishing channel ${id} not found`);
    }

    if (channel.workspaceId) {
      await assertWorkspaceAccess(this.prisma, channel.workspaceId, user, "view");
    }

    return this.sanitizeChannel(channel);
  }

  async update(id: string, dto: UpdatePublishingChannelDto, user: AuthenticatedUser) {
    const existing = await this.prisma.publishingChannel.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Publishing channel ${id} not found`);
    }

    if (existing.workspaceId) {
      await assertWorkspaceAccess(this.prisma, existing.workspaceId, user, "update");
    }

    const data: Record<string, any> = {};
    if (dto.platform) data.platform = dto.platform;
    if (typeof dto.isActive === "boolean") data.isActive = dto.isActive;
    if ((dto as any).credentials) {
      data.encryptedCredentials = this.encryptionService.encrypt(
        (dto as any).credentials,
      );
    }

    const updated = await this.prisma.publishingChannel.update({
      where: { id },
      data,
    });

    return this.sanitizeChannel(updated);
  }

  async remove(id: string, user: AuthenticatedUser) {
    const channel = await this.prisma.publishingChannel.findUnique({
      where: { id },
    });

    if (!channel) {
      throw new NotFoundException(`Publishing channel ${id} not found`);
    }

    if (channel.workspaceId) {
      await assertWorkspaceAccess(this.prisma, channel.workspaceId, user, "delete");
    }

    return this.prisma.publishingChannel.delete({ where: { id } });
  }

  private sanitizeChannel(channel: any) {
    const credentials = this.encryptionService.decrypt(
      channel.encryptedCredentials,
    );

    return {
      ...channel,
      credentials,
      encryptedCredentials: "[PROTECTED]",
    };
  }
}
