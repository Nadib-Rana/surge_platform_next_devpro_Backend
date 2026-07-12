import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsBoolean } from "class-validator";

const DRAFT_STATUSES = [
  "draft",
  "review",
  "approved",
  "scheduled",
  "published",
  "rejected",
  "failed",
  "deleted",
] as const;

export class GeneratedDraftQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @ApiPropertyOptional({ enum: DRAFT_STATUSES })
  @IsOptional()
  @IsIn(DRAFT_STATUSES)
  status?: (typeof DRAFT_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean;
}
