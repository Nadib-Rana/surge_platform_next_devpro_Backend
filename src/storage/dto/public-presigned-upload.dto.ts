import {
  IsInt,
  IsMimeType,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class PublicPresignedUploadDto {
  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsMimeType()
  mimeType?: string;

  @IsOptional()
  @IsString()
  bucket?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(10 * 60)
  expirySeconds?: number;
}
