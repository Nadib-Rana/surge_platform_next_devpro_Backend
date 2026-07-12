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
  @ArrayNotEmpty()
  @IsString({ each: true })
  postingTimes?: string[];
}
