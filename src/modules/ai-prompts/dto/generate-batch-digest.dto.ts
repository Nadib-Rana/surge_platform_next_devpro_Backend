import { IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

export class GenerateBatchDigestDto {
  @IsUUID()
  workspaceId: string;

  @IsOptional()
  @IsUUID()
  promptVersionId?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
