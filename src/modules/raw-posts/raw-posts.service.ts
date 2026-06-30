import { Injectable } from "@nestjs/common";
import { CreateRawPostDto } from "./dto/create-raw-post.dto";
import { UpdateRawPostDto } from "./dto/update-raw-post.dto";

@Injectable()
export class RawPostsService {
  create(createRawPostDto: CreateRawPostDto) {
    return "This action adds a new rawPost";
  }

  findAll() {
    return `This action returns all rawPosts`;
  }

  findOne(id: number) {
    return `This action returns a #${id} rawPost`;
  }

  update(id: number, updateRawPostDto: UpdateRawPostDto) {
    return `This action updates a #${id} rawPost`;
  }

  remove(id: number) {
    return `This action removes a #${id} rawPost`;
  }
}
