import { IsOptional, IsString } from "class-validator";

export class CreateClassCategoryDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  thumbnailKey?: string;
}
