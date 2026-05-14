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
  STAFF = "staff",
}

export enum Gender {
  MALE = "male",
  FEMALE = "female",
  OTHER = "other",
}

export class RegisterDto {
  @IsOptional()
  @IsString()
  fullName?: string;

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

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsInt()
  @Min(1)
  @Max(120)
  age: number;

  @IsEnum(Gender)
  gender: Gender;
}
