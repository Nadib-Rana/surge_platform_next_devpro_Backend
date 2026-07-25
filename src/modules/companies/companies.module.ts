import { Module } from "@nestjs/common";
import { CompaniesService } from "./companies.service";
import { CompaniesController } from "./companies.controller";
import { AuthModule } from "../auth/auth.module";
import { StripeWebhookController } from "./billing/stripe-webhook.controller";
import { StripeWebhookService } from "./billing/stripe-webhook.service";

@Module({
  imports: [AuthModule],
  controllers: [CompaniesController, StripeWebhookController],
  providers: [CompaniesService, StripeWebhookService],
  exports: [CompaniesService, StripeWebhookService],
})
export class CompaniesModule {}
