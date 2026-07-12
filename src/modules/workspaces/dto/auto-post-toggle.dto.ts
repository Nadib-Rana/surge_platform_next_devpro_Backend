import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class AutoPostToggleDto {
  @ApiProperty({
    description: "Enable or disable auto-posting for the workspace",
    example: true,
  })
  @IsBoolean()
  autoPost?: boolean;
}
