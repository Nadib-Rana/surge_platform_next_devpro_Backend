import { IsNotEmpty, IsString, Length } from "class-validator";

export class VerifyTokenDto {
  @IsNotEmpty({ message: "OTP token is required" })
  @IsString({ message: "OTP must be a string" })
  @Length(6, 6, { message: "OTP must be exactly 6 digits" })
  token: string;
}
