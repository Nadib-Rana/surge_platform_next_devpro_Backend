import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsNotEmpty,
} from "class-validator";

export class DispatchCredentials {
  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  apiUrl?: string; // base api url (WordPress site url, Graph API base, etc.)

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  target?: string; // e.g. page id, urn:li:organization:xxx, urn:li:person:xxx
}

export class DispatchPayloadDto {
  @IsNotEmpty()
  @IsString()
  channel: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsNotEmpty()
  @IsObject()
  credentials: DispatchCredentials;
}
