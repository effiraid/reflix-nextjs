import { describe, expect, it } from "vitest";
import { loadEffectiveAccess } from "./access";

function createMockClient({
  planTier = "free",
  grant = null,
}: {
  planTier?: "free" | "pro";
  grant?: Record<string, unknown> | null;
}) {
  return {
    from(table: string) {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { tier: planTier }, error: null }),
            }),
          }),
        };
      }

      if (table === "beta_access_grants") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                lte: () => ({
                  gt: () => ({
                    order: () => ({
                      limit: async () => ({
                        data: grant ? [grant] : [],
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("loadEffectiveAccess", () => {
  it("returns beta access for a free user with an active grant", async () => {
    const access = await loadEffectiveAccess(
      createMockClient({
        planTier: "free",
        grant: {
          id: "grant-1",
          user_id: "user-1",
          source: "manual",
          campaign_key: "cohort-1",
          starts_at: "2026-03-28T00:00:00.000Z",
          ends_at: "2026-04-30T00:00:00.000Z",
          revoked_at: null,
          note: null,
        },
      }) as never,
      "user-1",
      "2026-04-01T00:00:00.000Z"
    );

    expect(access).toMatchObject({
      planTier: "free",
      effectiveTier: "pro",
      accessSource: "beta",
      betaEndsAt: "2026-04-30T00:00:00.000Z",
    });
  });
});
