import { Controller, Post, Body } from "@nestjs/common";
import { StripeWebhookService } from "./stripe-webhook.service";

@Controller("companies/billing")
export class StripeWebhookController {
  constructor(private readonly webhookService: StripeWebhookService) {}

  @Post("webhook")
  handleWebhook(@Body() event: any) {
    return this.webhookService.handleStripeEvent(event);
  }
}
