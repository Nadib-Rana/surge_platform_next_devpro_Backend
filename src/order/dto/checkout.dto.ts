import { IsEnum, IsOptional, IsString } from "class-validator";

export enum CheckoutPaymentMethod {
  COD = "COD",
  SQUARE = "SQUARE",
}

export class CheckoutDto {
  @IsEnum(CheckoutPaymentMethod)
  paymentMethod: CheckoutPaymentMethod;

  @IsOptional()
  @IsString()
  squareTransactionId?: string;
}
