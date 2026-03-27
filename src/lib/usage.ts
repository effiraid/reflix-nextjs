import type { AccessTier } from "./types";

const DAILY_LIMITS: Record<AccessTier, number> = {
  free: 20,
  pro: Infinity,
};

export function getDailyLimit(tier: AccessTier): number {
  return DAILY_LIMITS[tier];
}

export function isViewAllowed(tier: AccessTier, currentViews: number): boolean {
  return currentViews < DAILY_LIMITS[tier];
}

export function getRemainingViews(tier: AccessTier, currentViews: number): number {
  const limit = DAILY_LIMITS[tier];
  if (limit === Infinity) return Infinity;
  return Math.max(limit - currentViews, 0);
}
