import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/context/prisma.service";

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleStripeEvent(event: { type: string; data: { object: any } }) {
    const { type, data } = event;
    const obj = data?.object ?? {};

    this.logger.log(`Processing Stripe webhook event: ${type}`);

    if (type === "checkout.session.completed") {
      const companyId = obj.client_reference_id || obj.metadata?.companyId;
      const tier = obj.metadata?.tier || "pro";

      if (companyId) {
        await this.prisma.company.update({
          where: { id: companyId },
          data: {
            subscriptionTier: tier,
          },
        });
        this.logger.log(`Upgraded company ${companyId} to tier ${tier}`);
      }
    } else if (type === "customer.subscription.deleted") {
      const companyId = obj.metadata?.companyId;
      if (companyId) {
        await this.prisma.company.update({
          where: { id: companyId },
          data: { subscriptionTier: "starter" },
        });
        this.logger.log(`Downgraded company ${companyId} to starter tier`);
      }
    }

    return { received: true };
  }
}
