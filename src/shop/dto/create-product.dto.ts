import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class CreateProductDto {
  @IsUUID("4")
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  regularPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPrice?: number;

  @IsInt()
  @Min(0)
  stockQuantity: number;

  @IsOptional()
  @IsString()
  imageKey?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
