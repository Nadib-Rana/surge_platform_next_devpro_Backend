import { IsObject, IsOptional, IsNumber, Min, IsArray, ArrayNotEmpty, IsString } from "class-validator";

export class QueueConfigDto {
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
