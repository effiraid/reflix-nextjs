export type Tier = "free" | "pro";
export type AccessSource = "free" | "paid" | "beta";
export type BetaGrantSource = "manual" | "invite" | "campaign";

export interface BetaAccessGrant {
  id: string;
  userId: string;
  source: BetaGrantSource;
  campaignKey: string | null;
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
  note: string | null;
}

export interface EffectiveAccess {
  planTier: Tier;
  effectiveTier: Tier;
  accessSource: AccessSource;
  betaEndsAt: string | null;
}

function isGrantActive(grant: BetaAccessGrant | null, nowIso: string) {
  if (!grant) return false;
  if (grant.revokedAt) return false;
  return grant.startsAt <= nowIso && grant.endsAt > nowIso;
}

export function resolveEffectiveAccess({
  planTier,
  betaGrant,
  nowIso = new Date().toISOString(),
}: {
  planTier: Tier;
  betaGrant: BetaAccessGrant | null;
  nowIso?: string;
}): EffectiveAccess {
  if (planTier === "pro") {
    return {
      planTier,
      effectiveTier: "pro",
      accessSource: "paid",
      betaEndsAt: betaGrant?.endsAt ?? null,
    };
  }

  if (isGrantActive(betaGrant, nowIso)) {
    return {
      planTier,
      effectiveTier: "pro",
      accessSource: "beta",
      betaEndsAt: betaGrant.endsAt,
    };
  }

  return {
    planTier,
    effectiveTier: "free",
    accessSource: "free",
    betaEndsAt: null,
  };
}
