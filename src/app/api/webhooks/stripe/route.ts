import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
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

function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET!;
}

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  return {
    start: new Date(item.current_period_start * 1000).toISOString(),
    end: new Date(item.current_period_end * 1000).toISOString(),
  };
}

/** Look up the user profile by stripe_customer_id. Returns null if not found. */
async function findProfileByCustomer(customerId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (error) {
    console.error("[stripe-webhook] profile lookup failed:", error.message);
    return null;
  }
  return data;
}

/** Downgrade a user to free tier and cancel their subscription record. */
async function downgradeUser(
  profileId: string,
  stripeSubscriptionId?: string
) {
  const { error: profileError } = await getSupabaseAdmin()
    .from("profiles")
    .update({ tier: "free" })
    .eq("id", profileId);

  if (profileError) {
    console.error(
      "[stripe-webhook] failed to downgrade profile:",
      profileError.message
    );
    return profileError;
  }

  if (stripeSubscriptionId) {
    const { error: subError } = await getSupabaseAdmin()
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("stripe_subscription_id", stripeSubscriptionId);

    if (subError) {
      console.error(
        "[stripe-webhook] failed to cancel subscription:",
        subError.message
      );
      return subError;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, getWebhookSecret());
  } catch (err) {
    console.error(
      "[stripe-webhook] signature verification failed:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      if (!userId || !session.subscription) break;

      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      );
      const period = getSubscriptionPeriod(subscription);

      const { error: profileError } = await getSupabaseAdmin()
        .from("profiles")
        .update({
          tier: "pro",
          stripe_customer_id: session.customer as string,
        })
        .eq("id", userId);

      if (profileError) {
        console.error(
          "[stripe-webhook] checkout profile update failed:",
          profileError.message
        );
        return NextResponse.json(
          { error: "DB update failed" },
          { status: 500 }
        );
      }

      const { error: subError } = await getSupabaseAdmin()
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            stripe_subscription_id: subscription.id,
            status: "active",
            current_period_start: period.start,
            current_period_end: period.end,
            cancel_at_period_end: subscription.cancel_at_period_end,
          },
          { onConflict: "stripe_subscription_id" }
        );

      if (subError) {
        console.error(
          "[stripe-webhook] checkout subscription upsert failed:",
          subError.message
        );
        return NextResponse.json(
          { error: "DB update failed" },
          { status: 500 }
        );
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const profile = await findProfileByCustomer(customerId);
      if (!profile) break;

      const status =
        subscription.status === "active"
          ? "active"
          : subscription.status === "past_due"
            ? "past_due"
            : subscription.status === "canceled"
              ? "canceled"
              : "active";

      const period = getSubscriptionPeriod(subscription);

      const { error: subError } = await getSupabaseAdmin()
        .from("subscriptions")
        .update({
          status,
          current_period_start: period.start,
          current_period_end: period.end,
          cancel_at_period_end: subscription.cancel_at_period_end,
        })
        .eq("stripe_subscription_id", subscription.id);

      if (subError) {
        console.error(
          "[stripe-webhook] subscription update failed:",
          subError.message
        );
        return NextResponse.json(
          { error: "DB update failed" },
          { status: 500 }
        );
      }

      const tier = status === "active" ? "pro" : "free";
      const { error: profileError } = await getSupabaseAdmin()
        .from("profiles")
        .update({ tier })
        .eq("id", profile.id);

      if (profileError) {
        console.error(
          "[stripe-webhook] profile tier update failed:",
          profileError.message
        );
        return NextResponse.json(
          { error: "DB update failed" },
          { status: 500 }
        );
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const profile = await findProfileByCustomer(customerId);
      if (!profile) break;

      const err = await downgradeUser(profile.id, subscription.id);
      if (err) {
        return NextResponse.json(
          { error: "DB update failed" },
          { status: 500 }
        );
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const customerId = charge.customer as string | null;
      if (!customerId) break;

      console.warn(
        `[stripe-webhook] charge.refunded: charge=${charge.id} customer=${customerId}`
      );

      const profile = await findProfileByCustomer(customerId);
      if (!profile) break;

      // Find active subscription to cancel
      const { data: sub } = await getSupabaseAdmin()
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", profile.id)
        .eq("status", "active")
        .single();

      const err = await downgradeUser(
        profile.id,
        sub?.stripe_subscription_id ?? undefined
      );
      if (err) {
        return NextResponse.json(
          { error: "DB update failed" },
          { status: 500 }
        );
      }
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const chargeObj =
        typeof dispute.charge === "string"
          ? await stripe.charges.retrieve(dispute.charge)
          : dispute.charge;
      const customerId =
        typeof chargeObj.customer === "string"
          ? chargeObj.customer
          : chargeObj.customer?.id ?? null;

      console.error(
        `[stripe-webhook] DISPUTE CREATED: dispute=${dispute.id} charge=${chargeObj.id} customer=${customerId} reason=${dispute.reason}`
      );

      if (!customerId) break;

      const profile = await findProfileByCustomer(customerId);
      if (!profile) break;

      const { data: sub } = await getSupabaseAdmin()
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", profile.id)
        .eq("status", "active")
        .single();

      const err = await downgradeUser(
        profile.id,
        sub?.stripe_subscription_id ?? undefined
      );
      if (err) {
        return NextResponse.json(
          { error: "DB update failed" },
          { status: 500 }
        );
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        invoice.parent?.subscription_details?.subscription;
      if (!subscriptionId || typeof subscriptionId !== "string") break;

      const { error } = await getSupabaseAdmin()
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("stripe_subscription_id", subscriptionId);

      if (error) {
        console.error(
          "[stripe-webhook] invoice.payment_failed update failed:",
          error.message
        );
        return NextResponse.json(
          { error: "DB update failed" },
          { status: 500 }
        );
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
