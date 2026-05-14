import { IsOptional, IsString } from "class-validator";

export class UpdateClassCategoryDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  thumbnailKey?: string;
}
