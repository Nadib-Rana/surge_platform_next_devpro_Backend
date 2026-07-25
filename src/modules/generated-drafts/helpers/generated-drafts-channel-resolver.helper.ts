import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../common/context/prisma.service";
import { UpdateGeneratedDraftDto } from "../dto/update-generated-draft.dto";

export interface PublishingChannelRecord {
  id: string;
  workspaceId: string;
  platform: string;
  encryptedCredentials: string;
}

export async function resolvePublishingChannels(
  prisma: PrismaService,
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

  const channels = (await prisma.publishingChannel.findMany({
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

export function resolveUpdatedStatus(
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
