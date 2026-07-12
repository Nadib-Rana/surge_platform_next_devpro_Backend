import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class CreateGeneratedDraftDto {
  @ApiPropertyOptional()
  @IsUUID()
  workspaceId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  rawPostId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  promptVersionId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  socialPlainText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageProvider?: string;

  @ApiPropertyOptional({
    enum: ["auto_cron", "manual_on_demand", "batch_digest"],
  })
  @IsOptional()
  @IsIn(["auto_cron", "manual_on_demand", "batch_digest"])
  generationType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wordpressHtmlContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoPost?: boolean;
}
