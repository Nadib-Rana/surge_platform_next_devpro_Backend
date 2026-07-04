import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateGeneratedDraftDto {
  @IsUUID()
  workspaceId: string;

  @IsOptional()
  @IsUUID()
  rawPostId?: string;

  @IsUUID()
  promptVersionId: string;

  @IsOptional()
  @IsString()
  socialPlainText?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  imageProvider?: string;

  @IsOptional()
  @IsEnum(["auto_cron", "manual_on_demand", "batch_digest"])
  generationType?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
