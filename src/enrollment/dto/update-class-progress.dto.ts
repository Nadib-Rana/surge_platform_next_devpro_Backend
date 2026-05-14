import { IsInt, IsOptional, Max, Min } from "class-validator";

export class UpdateClassProgressDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  lastWatchedSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent?: number;
}
