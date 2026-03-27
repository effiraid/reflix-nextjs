import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function validateStripeKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");

  if (process.env.NODE_ENV === "production" && key.startsWith("sk_test_")) {
    throw new Error(
      "STRIPE_SECRET_KEY is a test key but NODE_ENV is production"
    );
  }
  if (process.env.NODE_ENV !== "production" && key.startsWith("sk_live_")) {
    console.warn(
      "[stripe] WARNING: using a live key in non-production environment"
    );
  }
}

function getStripe() {
  validateStripeKey();
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { lang = "ko", interval = "monthly" } = await request.json();

  if (interval !== "monthly" && interval !== "yearly") {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }

  const priceId =
    interval === "yearly"
      ? process.env.STRIPE_PRICE_YEARLY
      : process.env.STRIPE_PRICE_MONTHLY;

  if (!priceId) {
    return NextResponse.json(
      { error: `Price not configured for ${interval} interval` },
      { status: 500 }
    );
  }

  // Check for existing active subscription — prevent duplicate checkouts
  const { data: existingSub } = await getSupabaseAdmin()
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (existingSub) {
    // User already has an active subscription — redirect to Customer Portal
    const { data: profile } = await getSupabaseAdmin()
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profile?.stripe_customer_id) {
      const origin = request.headers.get("origin") ?? request.nextUrl.origin;
      const portalSession =
        await getStripe().billingPortal.sessions.create({
          customer: profile.stripe_customer_id,
          return_url: `${origin}/${lang}/account`,
        });
      return NextResponse.json({
        url: portalSession.url,
        portal: true,
      });
    }

    return NextResponse.json(
      { error: "Already subscribed" },
      { status: 409 }
    );
  }

  // Get or create Stripe customer
  const { data: profile } = await getSupabaseAdmin()
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    await getSupabaseAdmin()
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const origin = request.headers.get("origin") ?? request.nextUrl.origin;

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${origin}/${lang}/account?checkout=success`,
    cancel_url: `${origin}/${lang}/pricing?checkout=cancel`,
    metadata: {
      supabase_user_id: user.id,
    },
  });

  return NextResponse.json({ url: session.url });
}
