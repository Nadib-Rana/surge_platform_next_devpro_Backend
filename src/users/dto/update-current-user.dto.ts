import { IsOptional, IsString } from "class-validator";

export class UpdateCurrentUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  avatarKey?: string;
}
