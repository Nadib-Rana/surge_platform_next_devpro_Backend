import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsISO8601, IsString } from "class-validator";

export class ScheduleGeneratedDraftDto {
  @ApiProperty()
  @IsISO8601()
  scheduledAt: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  channels: string[];
}
