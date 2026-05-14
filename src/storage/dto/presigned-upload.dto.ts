import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class PresignedUploadDto {
  @IsString()
  key!: string;

  @IsOptional()
  @IsString()
  bucket?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(60 * 60 * 24)
  expirySeconds?: number;
}
