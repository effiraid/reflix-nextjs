import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripeIfConfigured } from "@/lib/stripe/server";
import { getValidatedRequestOrigin } from "@/lib/requestOrigin";

const RECENT_SIGN_IN_WINDOW_MS = 10 * 60 * 1000;

function hasRecentSignIn(lastSignInAt: string | undefined) {
  if (!lastSignInAt) return false;

  const parsed = Date.parse(lastSignInAt);
  if (Number.isNaN(parsed)) return false;

  return Date.now() - parsed <= RECENT_SIGN_IN_WINDOW_MS;
}

export async function POST(request: Request) {
  const originCheck = getValidatedRequestOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json(
      { error: originCheck.error },
      { status: originCheck.status }
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRecentSignIn(user.last_sign_in_at)) {
    return NextResponse.json({ error: "reauth_required" }, { status: 403 });
  }

  // Cancel any remaining Stripe subscriptions for this customer before deletion.
  const stripe = getStripeIfConfigured();
  if (stripe) {
    try {
      const admin = getSupabaseAdmin();
      const { data: profile } = await admin
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.stripe_customer_id) {
        const subscriptions = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: "all",
          limit: 100,
        });

        for (const subscription of subscriptions.data) {
          if (
            subscription.status === "canceled" ||
            subscription.status === "incomplete_expired"
          ) {
            continue;
          }

          await stripe.subscriptions.cancel(subscription.id);
        }
      }
    } catch (err) {
      console.error("[account/delete] Stripe cancellation failed:", err);
      return NextResponse.json(
        { error: "Failed to cancel subscription. Please try again." },
        { status: 500 }
      );
    }
  }

  // Delete user via admin API (cascades to profiles and all related tables)
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error("[account/delete] Auth deletion failed:", error);
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[account/delete] Admin deletion failed:", err);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
