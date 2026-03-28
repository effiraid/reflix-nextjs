import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveEffectiveAccess,
  type BetaAccessGrant,
  type EffectiveAccess,
  type Tier,
} from "@/lib/access";

type AccessClient = Pick<SupabaseClient, "from">;

type BetaGrantRow = {
  id: string;
  user_id: string;
  source: "manual" | "invite" | "campaign";
  campaign_key: string | null;
  starts_at: string;
  ends_at: string;
  revoked_at: string | null;
  note: string | null;
};

function mapGrant(row: BetaGrantRow | null): BetaAccessGrant | null {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    source: row.source,
    campaignKey: row.campaign_key,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    revokedAt: row.revoked_at,
    note: row.note,
  };
}

export async function loadEffectiveAccess(
  client: AccessClient,
  userId: string,
  nowIso = new Date().toISOString()
): Promise<EffectiveAccess> {
  const [{ data: profile }, { data: grants }] = await Promise.all([
    client.from("profiles").select("tier").eq("id", userId).single(),
    client
      .from("beta_access_grants")
      .select("id,user_id,source,campaign_key,starts_at,ends_at,revoked_at,note")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso)
      .order("ends_at", { ascending: false })
      .limit(1),
  ]);

  const planTier = profile?.tier === "pro" ? "pro" : ("free" as Tier);

  return resolveEffectiveAccess({
    planTier,
    betaGrant: mapGrant((grants?.[0] as BetaGrantRow | undefined) ?? null),
    nowIso,
  });
}
