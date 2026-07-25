import { ForbiddenException } from "../../../common/exceptions/http.exceptions";
import { PrismaService } from "../../../common/context/prisma.service";

export async function checkRssSubscriptionLimit(
  prisma: PrismaService,
  companyOwnerId: string,
  workspaceId: string,
) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: companyOwnerId },
  });

  const tier = (subscription?.tier || "starter").toLowerCase();
  const limits: Record<string, number> = {
    starter: 5,
    pro: 20,
    business: 50,
  };
  const limit = limits[tier] ?? 5;

  const activeCount = await prisma.rssFeed.count({
    where: { workspaceId, status: "active" },
  });

  if (activeCount >= limit) {
    throw new ForbiddenException(
      `Your subscription tier (${tier}) allows maximum ${limit} active RSS feeds.`,
    );
  }
}
