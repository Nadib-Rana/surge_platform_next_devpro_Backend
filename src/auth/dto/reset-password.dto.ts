import { IsNotEmpty, IsString, Length, MinLength } from "class-validator";

export class ResetPasswordDto {
  @IsNotEmpty({ message: "OTP token is required" })
  @IsString({ message: "OTP must be a string" })
  @Length(6, 6, { message: "OTP must be exactly 6 digits" })
  token: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
