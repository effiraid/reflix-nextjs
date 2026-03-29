import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const {
  state,
  constructEventMock,
  hasProcessedStripeEventMock,
  markStripeEventFailedMock,
  markStripeEventProcessedMock,
  profileUpdateMock,
  subscriptionUpdateMock,
} = vi.hoisted(() => ({
  state: {
    event: null as Record<string, unknown> | null,
  },
  constructEventMock: vi.fn(),
  hasProcessedStripeEventMock: vi.fn(async () => false),
  markStripeEventFailedMock: vi.fn(async () => undefined),
  markStripeEventProcessedMock: vi.fn(async () => undefined),
  profileUpdateMock: vi.fn(),
  subscriptionUpdateMock: vi.fn(),
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripe: vi.fn(() => ({
    webhooks: {
      constructEvent: constructEventMock,
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
    charges: {
      retrieve: vi.fn(),
    },
  })),
  getStripeWebhookSecret: vi.fn(() => "whsec_test"),
}));

vi.mock("@/lib/stripe/security", () => ({
  hasProcessedStripeEvent: hasProcessedStripeEventMock,
  markStripeEventFailed: markStripeEventFailedMock,
  markStripeEventProcessed: markStripeEventProcessedMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { id: "user_123" },
                error: null,
              })),
            })),
          })),
          update: profileUpdateMock,
        };
      }

      if (table === "subscriptions") {
        return {
          update: subscriptionUpdateMock,
          upsert: vi.fn(async () => ({ error: null })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: null,
                  error: null,
                })),
              })),
              single: vi.fn(async () => ({
                data: null,
                error: null,
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  })),
}));

describe("stripe webhook subscription status handling", () => {
  beforeEach(() => {
    state.event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "unpaid",
          cancel_at_period_end: false,
          items: {
            data: [
              {
                current_period_start: 1,
                current_period_end: 2,
              },
            ],
          },
        },
      },
    };

    constructEventMock.mockReset();
    constructEventMock.mockImplementation(() => state.event);

    subscriptionUpdateMock.mockReset();
    subscriptionUpdateMock.mockReturnValue({
      eq: vi.fn(async () => ({ error: null })),
    });

    hasProcessedStripeEventMock.mockReset();
    hasProcessedStripeEventMock.mockResolvedValue(false);

    markStripeEventProcessedMock.mockReset();
    markStripeEventProcessedMock.mockResolvedValue(undefined);

    markStripeEventFailedMock.mockReset();
    markStripeEventFailedMock.mockResolvedValue(undefined);

    profileUpdateMock.mockReset();
    profileUpdateMock.mockReturnValue({
      eq: vi.fn(async () => ({ error: null })),
    });
  });

  it("does not upgrade unpaid subscriptions to active pro access", async () => {
    const response = await POST(
      new NextRequest("https://reflix.dev/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
        },
        body: "{}",
      })
    );

    expect(response.status).toBe(200);
    expect(subscriptionUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "unpaid",
      })
    );
    expect(profileUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: "free",
      })
    );
    expect(markStripeEventProcessedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "customer.subscription.updated",
      })
    );
  });

  it("skips webhook side effects when the event was already processed", async () => {
    hasProcessedStripeEventMock.mockResolvedValueOnce(true);

    const response = await POST(
      new NextRequest("https://reflix.dev/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
        },
        body: "{}",
      })
    );

    expect(response.status).toBe(200);
    expect(profileUpdateMock).not.toHaveBeenCalled();
    expect(subscriptionUpdateMock).not.toHaveBeenCalled();
    expect(markStripeEventProcessedMock).not.toHaveBeenCalled();
  });

  it("records failed webhook processing attempts for retries", async () => {
    profileUpdateMock.mockReturnValueOnce({
      eq: vi.fn(async () => ({ error: { message: "db failed" } })),
    });

    const response = await POST(
      new NextRequest("https://reflix.dev/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
        },
        body: "{}",
      })
    );

    expect(response.status).toBe(500);
    expect(markStripeEventFailedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "customer.subscription.updated",
      }),
      expect.stringContaining("DB update failed")
    );
  });
});
