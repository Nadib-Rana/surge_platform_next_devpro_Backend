import { IsOptional, IsString } from "class-validator";

export class ObjectUrlQueryDto {
  @IsString()
  key!: string;

  @IsOptional()
  @IsString()
  bucket?: string;
}
