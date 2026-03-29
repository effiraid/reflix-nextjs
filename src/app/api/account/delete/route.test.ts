import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const {
  state,
  deleteUserMock,
  listSubscriptionsMock,
  cancelSubscriptionMock,
} = vi.hoisted(() => ({
  state: {
    user: {
      id: "user_123",
      last_sign_in_at: new Date().toISOString(),
    } as { id: string; last_sign_in_at?: string } | null,
    profile: {
      stripe_customer_id: "cus_123",
    } as { stripe_customer_id: string | null } | null,
    subscriptions: [
      { id: "sub_active", status: "active" },
      { id: "sub_past_due", status: "past_due" },
      { id: "sub_canceled", status: "canceled" },
    ] as Array<{ id: string; status: string }>,
  },
  deleteUserMock: vi.fn(),
  listSubscriptionsMock: vi.fn(),
  cancelSubscriptionMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: state.user },
      })),
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: state.profile,
                error: null,
              })),
              single: vi.fn(async () => ({
                data: state.profile,
                error: null,
              })),
            })),
          })),
        };
      }

      if (table === "subscriptions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: null,
                error: null,
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    auth: {
      admin: {
        deleteUser: deleteUserMock,
      },
    },
  })),
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripeIfConfigured: vi.fn(() => ({
    subscriptions: {
      list: listSubscriptionsMock,
      cancel: cancelSubscriptionMock,
    },
  })),
}));

describe("account delete security hardening", () => {
  beforeEach(() => {
    state.user = {
      id: "user_123",
      last_sign_in_at: new Date().toISOString(),
    };
    state.profile = {
      stripe_customer_id: "cus_123",
    };
    state.subscriptions = [
      { id: "sub_active", status: "active" },
      { id: "sub_past_due", status: "past_due" },
      { id: "sub_canceled", status: "canceled" },
    ];

    deleteUserMock.mockReset();
    deleteUserMock.mockResolvedValue({ error: null });

    listSubscriptionsMock.mockReset();
    listSubscriptionsMock.mockResolvedValue({
      data: state.subscriptions,
    });

    cancelSubscriptionMock.mockReset();
    cancelSubscriptionMock.mockResolvedValue({});
  });

  it("requires a recent sign-in before deleting the account", async () => {
    state.user = {
      id: "user_123",
      last_sign_in_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    };

    const response = await POST(
      new NextRequest("https://reflix.dev/api/account/delete", {
        method: "POST",
        headers: {
          origin: "https://reflix.dev",
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual(
      expect.objectContaining({
        error: "reauth_required",
      })
    );
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("cancels all remaining Stripe subscriptions before deleting the user", async () => {
    const response = await POST(
      new NextRequest("https://reflix.dev/api/account/delete", {
        method: "POST",
        headers: {
          origin: "https://reflix.dev",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(listSubscriptionsMock).toHaveBeenCalledWith({
      customer: "cus_123",
      status: "all",
      limit: 100,
    });
    expect(cancelSubscriptionMock).toHaveBeenCalledTimes(2);
    expect(cancelSubscriptionMock).toHaveBeenCalledWith("sub_active");
    expect(cancelSubscriptionMock).toHaveBeenCalledWith("sub_past_due");
    expect(deleteUserMock).toHaveBeenCalledWith("user_123");
  });

  it("rejects account deletion from an untrusted origin", async () => {
    const response = await POST(
      new NextRequest("https://reflix.dev/api/account/delete", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
        },
      })
    );

    expect(response.status).toBe(403);
    expect(listSubscriptionsMock).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
  });
});
