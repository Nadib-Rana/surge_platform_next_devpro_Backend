import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/context/prisma.service";
import { EncryptionService } from "../../common/security/encryption.service";
import { CreatePublishingChannelDto } from "./dto/create-publishing-channel.dto";
import { UpdatePublishingChannelDto } from "./dto/update-publishing-channel.dto";

@Injectable()
export class PublishingChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async create(dto: CreatePublishingChannelDto) {
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

  async findAll(workspaceId?: string) {
    const channels = await this.prisma.publishingChannel.findMany({
      where: workspaceId ? { workspaceId } : {},
      orderBy: { createdAt: "desc" },
    });

    return channels.map((channel) => this.sanitizeChannel(channel));
  }

  async findOne(id: string) {
    const channel = await this.prisma.publishingChannel.findUnique({
      where: { id },
    });

    if (!channel) {
      throw new NotFoundException(`Publishing channel ${id} not found`);
    }

    return this.sanitizeChannel(channel);
  }

  async update(id: string, dto: UpdatePublishingChannelDto) {
    const existing = await this.prisma.publishingChannel.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Publishing channel ${id} not found`);
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

  async remove(id: string) {
    const channel = await this.prisma.publishingChannel.findUnique({
      where: { id },
    });

    if (!channel) {
      throw new NotFoundException(`Publishing channel ${id} not found`);
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
