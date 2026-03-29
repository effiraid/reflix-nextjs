import "server-only";

import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-03-25.dahlia";

function validateStripeKey(key: string) {
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

function createStripeClient(key: string) {
  validateStripeKey(key);
  return new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
  });
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");

  return createStripeClient(key);
}

export function getStripeIfConfigured() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  return createStripeClient(key);
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

  return secret;
}
