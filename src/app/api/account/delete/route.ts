import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cancel active Stripe subscription if exists
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey) {
    try {
      const stripe = new Stripe(stripeKey);
      const admin = getSupabaseAdmin();
      const { data: sub } = await admin
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (sub?.stripe_subscription_id) {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
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
