import { IsOptional, IsString } from "class-validator";

export class ConfirmCodOrderDto {
  @IsOptional()
  @IsString()
  note?: string;
}
