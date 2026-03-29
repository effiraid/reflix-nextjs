import type { ViewerTier } from "@/lib/accessPolicy";
import { loadEffectiveAccess } from "@/lib/supabase/access";
import { createServerSupabase } from "@/lib/supabase/server";

export async function getServerViewerTier(): Promise<ViewerTier> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return "guest";
  }

  try {
    const access = await loadEffectiveAccess(
      supabase as Parameters<typeof loadEffectiveAccess>[0],
      user.id,
    );
    return access.effectiveTier === "pro" ? "pro" : "free";
  } catch {
    return "free";
  }
}
