import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
const ORIGINAL_VERCEL_PROJECT_PRODUCTION_URL =
  process.env.VERCEL_PROJECT_PRODUCTION_URL;
const ORIGINAL_VERCEL_URL = process.env.VERCEL_URL;
const ORIGINAL_STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY;
const ORIGINAL_STRIPE_PRICE_YEARLY = process.env.STRIPE_PRICE_YEARLY;

const { state, checkoutSessionCreateMock, portalSessionCreateMock } =
  vi.hoisted(() => ({
    state: {
      user: {
        id: "user_123",
        email: "user@example.com",
      } as { id: string; email: string } | null,
      existingSubscription: null as
        | {
            stripe_subscription_id: string;
            status: string;
          }
        | null,
      profile: {
        stripe_customer_id: "cus_123",
      } as { stripe_customer_id: string | null } | null,
    },
    checkoutSessionCreateMock: vi.fn(),
    portalSessionCreateMock: vi.fn(),
  }));

const { CheckoutRateLimitErrorMock, enforceCheckoutRateLimitMock } = vi.hoisted(() => ({
  CheckoutRateLimitErrorMock: class CheckoutRateLimitError extends Error {
    retryAfterSeconds: number;

    constructor(retryAfterSeconds = 600) {
      super("Checkout rate limit exceeded");
      this.name = "CheckoutRateLimitError";
      this.retryAfterSeconds = retryAfterSeconds;
    }
  },
  enforceCheckoutRateLimitMock: vi.fn(async () => undefined),
}));

const { getValidatedRequestOriginMock } = vi.hoisted(() => ({
  getValidatedRequestOriginMock: vi.fn(),
}));

function createSelectQuery(data: unknown) {
  const query = {
    eq: vi.fn(() => query),
    single: vi.fn(async () => ({ data, error: null })),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };

  return query;
}

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: state.user },
      })),
    },
  })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "subscriptions") {
        return {
          select: vi.fn(() => createSelectQuery(state.existingSubscription)),
        };
      }

      if (table === "profiles") {
        return {
          select: vi.fn(() => createSelectQuery(state.profile)),
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  })),
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripe: vi.fn(() => ({
    checkout: {
      sessions: {
        create: checkoutSessionCreateMock,
      },
    },
    billingPortal: {
      sessions: {
        create: portalSessionCreateMock,
      },
    },
  })),
}));

vi.mock("@/lib/stripe/security", () => {
  return {
    CheckoutRateLimitError: CheckoutRateLimitErrorMock,
    enforceCheckoutRateLimit: enforceCheckoutRateLimitMock,
  };
});

vi.mock("@/lib/requestOrigin", () => ({
  getValidatedRequestOrigin: getValidatedRequestOriginMock,
}));

describe("checkout route security hardening", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://reflix.dev";
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    process.env.STRIPE_PRICE_MONTHLY = "price_monthly_123";
    process.env.STRIPE_PRICE_YEARLY = "price_yearly_123";

    state.user = {
      id: "user_123",
      email: "user@example.com",
    };
    state.existingSubscription = null;
    state.profile = {
      stripe_customer_id: "cus_123",
    };

    checkoutSessionCreateMock.mockReset();
    checkoutSessionCreateMock.mockResolvedValue({
      url: "https://checkout.stripe.com/pay/cs_test_123",
    });

    enforceCheckoutRateLimitMock.mockReset();
    enforceCheckoutRateLimitMock.mockResolvedValue(undefined);

    portalSessionCreateMock.mockReset();
    portalSessionCreateMock.mockResolvedValue({
      url: "https://billing.stripe.com/p/session_123",
    });

    getValidatedRequestOriginMock.mockReset();
    getValidatedRequestOriginMock.mockImplementation((request: Request) => {
      const origin = request.headers.get("origin");
      if (origin !== "https://reflix.dev") {
        return {
          ok: false,
          error: "invalid_origin" as const,
          status: 403 as const,
        };
      }

      return {
        ok: true,
        siteOrigin: "https://reflix.dev",
        requestOrigin: "https://reflix.dev",
      };
    });
  });

  afterEach(() => {
    if (ORIGINAL_SITE_URL === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
    }

    if (ORIGINAL_VERCEL_PROJECT_PRODUCTION_URL === undefined) {
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    } else {
      process.env.VERCEL_PROJECT_PRODUCTION_URL =
        ORIGINAL_VERCEL_PROJECT_PRODUCTION_URL;
    }

    if (ORIGINAL_VERCEL_URL === undefined) {
      delete process.env.VERCEL_URL;
    } else {
      process.env.VERCEL_URL = ORIGINAL_VERCEL_URL;
    }

    if (ORIGINAL_STRIPE_PRICE_MONTHLY === undefined) {
      delete process.env.STRIPE_PRICE_MONTHLY;
    } else {
      process.env.STRIPE_PRICE_MONTHLY = ORIGINAL_STRIPE_PRICE_MONTHLY;
    }

    if (ORIGINAL_STRIPE_PRICE_YEARLY === undefined) {
      delete process.env.STRIPE_PRICE_YEARLY;
    } else {
      process.env.STRIPE_PRICE_YEARLY = ORIGINAL_STRIPE_PRICE_YEARLY;
    }
  });

  it("uses the configured site origin for checkout redirects", async () => {
    const response = await POST(
      new NextRequest("https://evil.example/api/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://reflix.dev",
        },
        body: JSON.stringify({
          lang: "ko",
          interval: "monthly",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(checkoutSessionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: "https://reflix.dev/ko/account?checkout=success",
        cancel_url: "https://reflix.dev/ko/browse",
      })
    );
  });

  it("uses the configured site origin for billing portal returns", async () => {
    state.existingSubscription = {
      stripe_subscription_id: "sub_123",
      status: "active",
    };

    const response = await POST(
      new NextRequest("https://evil.example/api/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://reflix.dev",
        },
        body: JSON.stringify({
          lang: "en",
          interval: "monthly",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(portalSessionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url: "https://reflix.dev/en/account",
      })
    );
  });

  it("rejects unsupported locale values before creating Stripe sessions", async () => {
    const response = await POST(
      new NextRequest("https://reflix.dev/api/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://reflix.dev",
        },
        body: JSON.stringify({
          lang: "ja",
          interval: "monthly",
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(checkoutSessionCreateMock).not.toHaveBeenCalled();
    expect(portalSessionCreateMock).not.toHaveBeenCalled();
  });

  it("rejects requests from an untrusted origin", async () => {
    const response = await POST(
      new NextRequest("https://reflix.dev/api/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({
          lang: "ko",
          interval: "monthly",
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(checkoutSessionCreateMock).not.toHaveBeenCalled();
    expect(portalSessionCreateMock).not.toHaveBeenCalled();
  });

  it("returns 429 when checkout attempts exceed the rate limit", async () => {
    const { CheckoutRateLimitError } = await import("@/lib/stripe/security");
    enforceCheckoutRateLimitMock.mockRejectedValueOnce(
      new CheckoutRateLimitError()
    );

    const response = await POST(
      new NextRequest("https://reflix.dev/api/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://reflix.dev",
        },
        body: JSON.stringify({
          lang: "ko",
          interval: "monthly",
        }),
      })
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("600");
    expect(checkoutSessionCreateMock).not.toHaveBeenCalled();
  });
});
