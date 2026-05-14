import { IsUUID } from "class-validator";

export class ListClassesQueryDto {
  @IsUUID("4")
  categoryId: string;
}
