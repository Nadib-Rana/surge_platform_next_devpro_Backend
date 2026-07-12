import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateCompanyDto {
  @ApiProperty({ example: "Acme Media Labs", description: "Company display name" })
  @IsString()
  @IsNotEmpty()
  name: string;
}
