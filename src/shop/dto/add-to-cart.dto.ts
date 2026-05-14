import { IsInt, IsUUID, Max, Min } from "class-validator";

export class AddToCartDto {
  @IsUUID("4")
  productId: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;
}
