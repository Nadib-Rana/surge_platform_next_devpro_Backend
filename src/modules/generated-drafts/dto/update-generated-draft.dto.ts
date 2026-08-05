import { IsArray, IsIn, IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

const DRAFT_STATUSES = [
  "draft",
  "review",
  "approved",
  "scheduled",
  "published",
  "rejected",
  "failed",
  "deleted",
  "RAW_DRAFT",
  "POLISHED",
  "READY_FOR_REVIEW",
] as const;

export class UpdateGeneratedDraftDto {
  @ApiPropertyOptional({ enum: ["approve", "reject", "save"] })
  @IsOptional()
  @IsIn(["approve", "reject", "save"])
  action?: "approve" | "reject" | "save";

  @ApiPropertyOptional({ enum: DRAFT_STATUSES })
  @IsOptional()
  @IsIn(DRAFT_STATUSES)
  status?: (typeof DRAFT_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  blogPostContent?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rawContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  polishedContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companySocialPost?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  personalSocialPost?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageConcept?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  negativeConstraints?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageCaption?: string;
}
