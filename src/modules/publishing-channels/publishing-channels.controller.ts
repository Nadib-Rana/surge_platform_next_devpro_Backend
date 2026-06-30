import { Controller,
  Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PublishingChannelsService } from './publishing-channels.service';
import { CreatePublishingChannelDto } from './dto/create-publishing-channel.dto';
import { UpdatePublishingChannelDto } from './dto/update-publishing-channel.dto';

@Controller('publishing-channels')
export class PublishingChannelsController {
  constructor(private readonly publishingChannelsService: PublishingChannelsService) {}

  @Post()
  create(@Body() createPublishingChannelDto: CreatePublishingChannelDto) {
    return this.publishingChannelsService.create(createPublishingChannelDto);
  }

  @Get()
  findAll() {
    return this.publishingChannelsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.publishingChannelsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePublishingChannelDto: UpdatePublishingChannelDto) {
    return this.publishingChannelsService.update(+id, updatePublishingChannelDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.publishingChannelsService.remove(+id);
  }
}
