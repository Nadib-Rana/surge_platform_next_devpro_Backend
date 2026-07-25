import { ForbiddenException } from "@nestjs/common";

export interface TierLimits {
  maxRssSources: number;
  maxChannels: number;
}

export const TIER_LIMITS: Record<string, TierLimits> = {
  starter: { maxRssSources: 5, maxChannels: 3 },
  pro: { maxRssSources: 20, maxChannels: 10 },
  business: { maxRssSources: 50, maxChannels: 25 },
};

export function assertWithinTierLimits(
  tier: string,
  currentCount: number,
  type: "rss" | "channel",
): void {
  const normalizedTier = (tier || "starter").toLowerCase();
  const limits = TIER_LIMITS[normalizedTier] || TIER_LIMITS.starter;
  const maxAllowed = type === "rss" ? limits.maxRssSources : limits.maxChannels;

  if (currentCount >= maxAllowed) {
    throw new ForbiddenException(
      `Subscription tier '${normalizedTier}' limit reached for ${type} (Maximum: ${maxAllowed}). Upgrade tier to add more.`,
    );
  }
}
