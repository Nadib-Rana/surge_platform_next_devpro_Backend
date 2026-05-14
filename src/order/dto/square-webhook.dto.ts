import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";

export enum SquareWebhookEventType {
  PAYMENT_SUCCEEDED = "PAYMENT_SUCCEEDED",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  PAYMENT_CANCELED = "PAYMENT_CANCELED",
}

export class SquareWebhookDto {
  @IsEnum(SquareWebhookEventType)
  eventType: SquareWebhookEventType;

  @IsOptional()
  @IsString()
  squareTransactionId?: string;

  @IsOptional()
  @IsUUID("4")
  orderId?: string;
}
