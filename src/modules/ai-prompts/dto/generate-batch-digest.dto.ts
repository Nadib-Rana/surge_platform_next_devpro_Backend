import { IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

export class GenerateBatchDigestDto {
  @IsUUID()
  workspaceId: string;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
