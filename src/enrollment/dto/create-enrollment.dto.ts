import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsUUID,
} from "class-validator";

export class CreateEnrollmentDto {
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsUUID("4", { each: true })
  categoryIds: string[];

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
