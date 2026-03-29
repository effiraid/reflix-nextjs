import accessPolicy from "@/data/access-policy.json";

export type SubscriptionTier = "free" | "pro";
export type ViewerTier = "guest" | SubscriptionTier;
export type FullVideoSurface = "detail" | "browse";

export type CapabilityAccess = "yes" | "no" | "limited" | string;

type AccessPolicyData = typeof accessPolicy;

export const ACCESS_POLICY: AccessPolicyData = accessPolicy;

export const GUEST_BROWSE_VISIBLE_RESULTS_LIMIT =
  ACCESS_POLICY.rules.guestBrowseVisibleResults;

export const FREE_BROWSE_VISIBLE_RESULTS_LIMIT =
  ACCESS_POLICY.rules.freeBrowseVisibleResults;

export const FREE_BOARD_LIMIT = ACCESS_POLICY.rules.freeBoardLimit;

export const FREE_MAX_FILTER_AXES = ACCESS_POLICY.rules.freeMaxFilterAxes;

export function getBrowseVisibleResultsLimit(viewerTier: ViewerTier): number {
  if (viewerTier === "guest") {
    return GUEST_BROWSE_VISIBLE_RESULTS_LIMIT;
  }

  if (viewerTier === "free") {
    return FREE_BROWSE_VISIBLE_RESULTS_LIMIT;
  }

  return Number.POSITIVE_INFINITY;
}

export function getViewerTier(
  user: { id: string } | null | undefined,
  tier: SubscriptionTier
): ViewerTier {
  if (!user) {
    return "guest";
  }

  return tier === "pro" ? "pro" : "free";
}

export function hasProAccess(
  user: { id: string } | null | undefined,
  tier: SubscriptionTier
): boolean {
  return getViewerTier(user, tier) === "pro";
}

export function canAccessFullVideo(
  user: { id: string } | null | undefined,
  tier: SubscriptionTier,
  surface: FullVideoSurface = "detail"
): boolean {
  const viewerTier = getViewerTier(user, tier);
  if (surface === "detail") {
    return true;
  }

  return viewerTier === "free" || viewerTier === "pro";
}

export function getCapabilityMatrix() {
  return ACCESS_POLICY.capabilities;
}
