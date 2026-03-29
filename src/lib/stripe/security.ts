import "server-only";

import type Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const CHECKOUT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_RETRY_AFTER_SECONDS = 600;
const MAX_CHECKOUT_ATTEMPTS_PER_WINDOW = 5;

export class CheckoutRateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds = DEFAULT_RETRY_AFTER_SECONDS) {
    super("Checkout rate limit exceeded");
    this.name = "CheckoutRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function getStripeObjectId(event: Stripe.Event): string | null {
  const object = event.data.object as { id?: unknown } | undefined;
  return typeof object?.id === "string" ? object.id : null;
}

export async function enforceCheckoutRateLimit(userId: string): Promise<void> {
  const windowStart = new Date(
    Date.now() - CHECKOUT_RATE_LIMIT_WINDOW_MS
  ).toISOString();

  const admin = getSupabaseAdmin();
  const { count, error: countError } = await admin
    .from("checkout_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", "checkout_session")
    .gte("created_at", windowStart);

  if (countError) {
    throw countError;
  }

  if ((count ?? 0) >= MAX_CHECKOUT_ATTEMPTS_PER_WINDOW) {
    throw new CheckoutRateLimitError();
  }

  const { error: insertError } = await admin.from("checkout_rate_limits").insert({
    user_id: userId,
    action: "checkout_session",
  });

  if (insertError) {
    throw insertError;
  }
}

export async function hasProcessedStripeEvent(eventId: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("stripe_webhook_events")
    .select("status")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.status === "processed";
}

export async function markStripeEventProcessed(
  event: Stripe.Event
): Promise<void> {
  const { error } = await getSupabaseAdmin().from("stripe_webhook_events").upsert(
    {
      event_id: event.id,
      event_type: event.type,
      object_id: getStripeObjectId(event),
      status: "processed",
      processed_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "event_id" }
  );

  if (error) {
    throw error;
  }
}

export async function markStripeEventFailed(
  event: Stripe.Event,
  reason: string
): Promise<void> {
  const { error } = await getSupabaseAdmin().from("stripe_webhook_events").upsert(
    {
      event_id: event.id,
      event_type: event.type,
      object_id: getStripeObjectId(event),
      status: "failed",
      processed_at: null,
      last_error: reason.slice(0, 500),
    },
    { onConflict: "event_id" }
  );

  if (error) {
    throw error;
  }
}
