import {
  IsObject,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
  ArrayNotEmpty,
  IsString,
  IsBoolean,
} from "class-validator";

export class QueueConfigDto {
  @IsOptional()
  @IsBoolean()
  autoPost?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  fetchFrequencyHours?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  postingTimes?: string[];

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  targetAudience?: string;

  @IsOptional()
  @IsString()
  brandVoice?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  editorialRules?: string[];
}
