import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getTrustedSiteOrigin } from "@/lib/siteOrigin";
import { getStripe } from "@/lib/stripe/server";
import { getValidatedRequestOrigin } from "@/lib/requestOrigin";
import {
  CheckoutRateLimitError,
  enforceCheckoutRateLimit,
} from "@/lib/stripe/security";

function isSupportedLang(value: unknown): value is "ko" | "en" {
  return value === "ko" || value === "en";
}

export async function POST(request: NextRequest) {
  const originCheck = getValidatedRequestOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json(
      { error: originCheck.error },
      { status: originCheck.status }
    );
  }

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

  if (!isSupportedLang(lang)) {
    return NextResponse.json({ error: "Invalid language" }, { status: 400 });
  }

  if (interval !== "monthly" && interval !== "yearly") {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }

  const siteOrigin = getTrustedSiteOrigin(request.nextUrl.origin);
  if (!siteOrigin) {
    return NextResponse.json(
      { error: "Billing origin is not configured" },
      { status: 500 }
    );
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
      const portalSession =
        await getStripe().billingPortal.sessions.create({
          customer: profile.stripe_customer_id,
          return_url: `${siteOrigin}/${lang}/account`,
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

  try {
    await enforceCheckoutRateLimit(user.id);
  } catch (error) {
    if (error instanceof CheckoutRateLimitError) {
      return NextResponse.json(
        { error: "Too many checkout attempts. Please wait and try again." },
        {
          status: 429,
          headers: {
            "Retry-After": String(error.retryAfterSeconds),
          },
        }
      );
    }

    console.error("[checkout] rate limit enforcement failed:", error);
    return NextResponse.json(
      { error: "Unable to start checkout right now" },
      { status: 500 }
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

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${siteOrigin}/${lang}/account?checkout=success`,
    cancel_url: `${siteOrigin}/${lang}/browse`,
    metadata: {
      supabase_user_id: user.id,
    },
  });

  return NextResponse.json({ url: session.url });
}
