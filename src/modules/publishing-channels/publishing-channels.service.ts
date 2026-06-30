import { Injectable } from "@nestjs/common";
import { CreatePublishingChannelDto } from "./dto/create-publishing-channel.dto";
import { UpdatePublishingChannelDto } from "./dto/update-publishing-channel.dto";

@Injectable()
export class PublishingChannelsService {
  create(createPublishingChannelDto: CreatePublishingChannelDto) {
    return "This action adds a new publishingChannel";
  }

  findAll() {
    return `This action returns all publishingChannels`;
  }

  findOne(id: number) {
    return `This action returns a #${id} publishingChannel`;
  }

  update(id: number, updatePublishingChannelDto: UpdatePublishingChannelDto) {
    return `This action updates a #${id} publishingChannel`;
  }

  remove(id: number) {
    return `This action removes a #${id} publishingChannel`;
  }
}
