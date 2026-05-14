import { IsOptional, IsString } from "class-validator";

export class DeleteObjectDto {
  @IsString()
  key!: string;

  @IsOptional()
  @IsString()
  bucket?: string;
}
