import { Injectable } from "@nestjs/common";
import { CreateRssFeedDto } from "./dto/create-rss-feed.dto";
import { UpdateRssFeedDto } from "./dto/update-rss-feed.dto";

@Injectable()
export class RssFeedsService {
  create(createRssFeedDto: CreateRssFeedDto) {
    return "This action adds a new rssFeed";
  }

  findAll() {
    return `This action returns all rssFeeds`;
  }

  findOne(id: number) {
    return `This action returns a #${id} rssFeed`;
  }

  update(id: number, updateRssFeedDto: UpdateRssFeedDto) {
    return `This action updates a #${id} rssFeed`;
  }

  remove(id: number) {
    return `This action removes a #${id} rssFeed`;
  }
}
