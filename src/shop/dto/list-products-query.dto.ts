import { IsBooleanString, IsOptional, IsString, IsUUID } from "class-validator";

export class ListProductsQueryDto {
  @IsOptional()
  @IsUUID("4")
  categoryId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBooleanString()
  onlyActive?: string;
}
