import { PartialType } from '@nestjs/swagger';
import { CreateRssFeedDto } from './create-rss-feed.dto';

export class UpdateRssFeedDto extends PartialType(CreateRssFeedDto) {}
