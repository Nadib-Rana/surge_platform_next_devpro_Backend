import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MinLength,
  Min,
} from "class-validator";

export enum UserRole {
  CUSTOMER = "customer",
  VENDOR = "vendor",
}

export enum Gender {
  MALE = "male",
  FEMALE = "female",
  OTHER = "other",
}

export class RegisterDto {
  @IsString()
  fullName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  avatarKey?: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsInt()
  @Min(1)
  @Max(120)
  age: number;

  @IsEnum(Gender)
  gender: Gender;
}
