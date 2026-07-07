import { PartialType } from "@nestjs/swagger";
import { CreateRawPostDto } from "./create-raw-post.dto";

export class UpdateRawPostDto extends PartialType(CreateRawPostDto) {}
