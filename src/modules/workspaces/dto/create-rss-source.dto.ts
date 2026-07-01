import { IsUrl, IsNotEmpty, IsOptional } from "class-validator";

export class CreateRssSourceDto {
  @IsNotEmpty()
  @IsUrl({}, { message: "feedUrl must be a valid URL" })
  feedUrl: string;

  @IsOptional()
  description?: string;
}
