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
        const company = await this.prisma.company.findUnique({
          where: { id: companyId },
          select: { ownerId: true },
        });

        if (company) {
          await this.prisma.subscription.upsert({
            where: { userId: company.ownerId },
            update: { tier, status: "ACTIVE" },
            create: {
              userId: company.ownerId,
              tier,
              monthlyPostLimit: tier === "business" ? 1000 : 200,
              status: "ACTIVE",
            },
          });
          this.logger.log(
            `Upgraded user ${company.ownerId} subscription to ${tier}`,
          );
        }
      }
    } else if (type === "customer.subscription.deleted") {
      const companyId = obj.metadata?.companyId;
      if (companyId) {
        const company = await this.prisma.company.findUnique({
          where: { id: companyId },
          select: { ownerId: true },
        });

        if (company) {
          await this.prisma.subscription.update({
            where: { userId: company.ownerId },
            data: { tier: "starter", status: "CANCELED" },
          });
          this.logger.log(
            `Downgraded user ${company.ownerId} subscription to starter`,
          );
        }
      }
    }

    return { received: true };
  }
}
