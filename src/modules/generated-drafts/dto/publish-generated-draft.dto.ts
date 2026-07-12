import { ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsOptional, IsString } from "class-validator";

export class PublishGeneratedDraftDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  channels?: string[];
}
