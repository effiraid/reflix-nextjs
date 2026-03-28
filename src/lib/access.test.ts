import { describe, expect, it } from "vitest";
import { resolveEffectiveAccess, type BetaAccessGrant } from "./access";

const activeGrant: BetaAccessGrant = {
  id: "grant-1",
  userId: "user-1",
  source: "manual",
  campaignKey: "cohort-1",
  startsAt: "2026-03-28T00:00:00.000Z",
  endsAt: "2026-04-30T00:00:00.000Z",
  revokedAt: null,
  note: null,
};

describe("resolveEffectiveAccess", () => {
  it("keeps a paid user on paid pro even when a beta grant also exists", () => {
    expect(
      resolveEffectiveAccess({
        planTier: "pro",
        betaGrant: activeGrant,
        nowIso: "2026-04-01T00:00:00.000Z",
      })
    ).toMatchObject({
      planTier: "pro",
      effectiveTier: "pro",
      accessSource: "paid",
      betaEndsAt: "2026-04-30T00:00:00.000Z",
    });
  });

  it("upgrades a free user to beta pro while the grant is active", () => {
    expect(
      resolveEffectiveAccess({
        planTier: "free",
        betaGrant: activeGrant,
        nowIso: "2026-04-01T00:00:00.000Z",
      })
    ).toMatchObject({
      planTier: "free",
      effectiveTier: "pro",
      accessSource: "beta",
      betaEndsAt: "2026-04-30T00:00:00.000Z",
    });
  });

  it("falls back to free when the beta grant is expired", () => {
    expect(
      resolveEffectiveAccess({
        planTier: "free",
        betaGrant: activeGrant,
        nowIso: "2026-05-01T00:00:00.000Z",
      })
    ).toMatchObject({
      planTier: "free",
      effectiveTier: "free",
      accessSource: "free",
      betaEndsAt: null,
    });
  });
});
