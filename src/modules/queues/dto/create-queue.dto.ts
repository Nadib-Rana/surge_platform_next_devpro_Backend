import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateQueueDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
