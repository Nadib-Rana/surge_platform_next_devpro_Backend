import { PartialType } from '@nestjs/swagger';
import { CreatePublishingChannelDto } from './create-publishing-channel.dto';

export class UpdatePublishingChannelDto extends PartialType(CreatePublishingChannelDto) {}
