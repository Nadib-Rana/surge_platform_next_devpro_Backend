import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateWorkspaceDto {
  @ApiProperty({ example: "Operations", description: "Workspace display name" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: "11111111-1111-1111-1111-111111111111",
    description: "Parent company id",
  })
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @ApiPropertyOptional({ example: "UTC", description: "Workspace timezone" })
  @IsString()
  @IsOptional()
  timezone?: string;
}
