import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateAiPromptDto {
  @IsOptional()
  @IsString()
  @IsIn(["GLOBAL", "WORKSPACE"])
  scope?: "GLOBAL" | "WORKSPACE";

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsUUID()
  createdById: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  versionTag?: string;

  @IsOptional()
  @IsString()
  tone?: string;
}
