import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PromptConfigDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  systemPrompt: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  template: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateToneProfileDto {
  @ApiProperty({ description: "Unique name of the tone profile, e.g. confident" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ type: PromptConfigDto })
  @ValidateNested()
  @Type(() => PromptConfigDto)
  stepGroupingPrompt: PromptConfigDto;

  @ApiProperty({ type: PromptConfigDto })
  @ValidateNested()
  @Type(() => PromptConfigDto)
  stepOneRawDraftPrompt: PromptConfigDto;

  @ApiProperty({ type: PromptConfigDto })
  @ValidateNested()
  @Type(() => PromptConfigDto)
  stepTwoPolishingPrompt: PromptConfigDto;

  @ApiProperty({ type: PromptConfigDto })
  @ValidateNested()
  @Type(() => PromptConfigDto)
  stepThreeImagePrompt: PromptConfigDto;

  @ApiProperty({ type: PromptConfigDto })
  @ValidateNested()
  @Type(() => PromptConfigDto)
  stepCompanySocialPrompt: PromptConfigDto;

  @ApiProperty({ type: PromptConfigDto })
  @ValidateNested()
  @Type(() => PromptConfigDto)
  stepPersonalSocialPrompt: PromptConfigDto;
}

export class UpdatePromptConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  template?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateToneProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: UpdatePromptConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePromptConfigDto)
  stepGroupingPrompt?: UpdatePromptConfigDto;

  @ApiPropertyOptional({ type: UpdatePromptConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePromptConfigDto)
  stepOneRawDraftPrompt?: UpdatePromptConfigDto;

  @ApiPropertyOptional({ type: UpdatePromptConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePromptConfigDto)
  stepTwoPolishingPrompt?: UpdatePromptConfigDto;

  @ApiPropertyOptional({ type: UpdatePromptConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePromptConfigDto)
  stepThreeImagePrompt?: UpdatePromptConfigDto;

  @ApiPropertyOptional({ type: UpdatePromptConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePromptConfigDto)
  stepCompanySocialPrompt?: UpdatePromptConfigDto;

  @ApiPropertyOptional({ type: UpdatePromptConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePromptConfigDto)
  stepPersonalSocialPrompt?: UpdatePromptConfigDto;
}
