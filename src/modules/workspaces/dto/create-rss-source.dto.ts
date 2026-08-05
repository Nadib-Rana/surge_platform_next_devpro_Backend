import { IsOptional, IsString } from "class-validator";

export class CreateRssSourceDto {
  @IsOptional()
  @IsString()
  feedUrl?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
