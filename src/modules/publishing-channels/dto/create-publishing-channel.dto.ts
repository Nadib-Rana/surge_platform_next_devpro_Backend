export class CreatePublishingChannelDto {
  workspaceId!: string;
  platform!: string;
  credentials!: Record<string, any>;
  isActive?: boolean;
}
