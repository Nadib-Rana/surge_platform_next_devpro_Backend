import { IsOptional, IsString, IsUUID } from "class-validator";

export class CreateAiPromptDto {
  @IsOptional()
  @IsUUID()
  workspaceId?: string;

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
