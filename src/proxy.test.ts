import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  MEDIA_SESSION_COOKIE_NAME,
  verifyMediaSessionToken,
} from "@/lib/mediaSession";
import { proxy } from "./proxy";

const { authState } = vi.hoisted(() => ({
  authState: {
    user: null as { id: string } | null,
    profileTier: "free" as "free" | "pro",
    betaGrant: null as Record<string, unknown> | null,
  },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: authState.user },
      })),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: authState.user ? { tier: authState.profileTier } : null,
              })),
            })),
          })),
        };
      }

      if (table === "beta_access_grants") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                lte: vi.fn(() => ({
                  gt: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(async () => ({
                        data: authState.betaGrant ? [authState.betaGrant] : [],
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  })),
}));

describe("proxy media session cookie", () => {
  beforeEach(() => {
    authState.user = null;
    authState.profileTier = "free";
    authState.betaGrant = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sets the media session cookie on locale page responses in protected mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_URL", "https://media.reflix.dev");
    vi.stubEnv("MEDIA_SESSION_SECRET", "test-secret");
    vi.stubEnv("MEDIA_SESSION_COOKIE_DOMAIN", ".reflix.dev");

    const response = await proxy(new NextRequest("https://reflix.dev/ko/browse"));

    expect(response.cookies.get(MEDIA_SESSION_COOKIE_NAME)).toBeDefined();
  });

  it("does not set the cookie when hosted media protection is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_URL", undefined);
    vi.stubEnv("MEDIA_SESSION_SECRET", undefined);
    vi.stubEnv("MEDIA_SESSION_COOKIE_DOMAIN", undefined);

    const response = await proxy(new NextRequest("https://reflix.dev/ko/browse"));

    expect(response.cookies.get(MEDIA_SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("sets the cookie on locale redirect responses too", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_URL", "https://media.reflix.dev");
    vi.stubEnv("MEDIA_SESSION_SECRET", "test-secret");
    vi.stubEnv("MEDIA_SESSION_COOKIE_DOMAIN", ".reflix.dev");

    const response = await proxy(new NextRequest("https://reflix.dev/browse"));

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.cookies.get(MEDIA_SESSION_COOKIE_NAME)).toBeDefined();
  });

  it("redirects unauthenticated /account requests to login on the server", async () => {
    const response = await proxy(new NextRequest("https://reflix.dev/ko/account"));

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.headers.get("location")).toBe("https://reflix.dev/ko/login");
  });

  it("treats a free user with an active beta grant as pro in the media session token", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_URL", "https://media.reflix.dev");
    vi.stubEnv("MEDIA_SESSION_SECRET", "test-secret");
    vi.stubEnv("MEDIA_SESSION_COOKIE_DOMAIN", ".reflix.dev");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    authState.user = { id: "user-123" };
    authState.profileTier = "free";
    authState.betaGrant = {
      id: "grant-1",
      user_id: "user-123",
      source: "manual",
      campaign_key: "cohort-1",
      starts_at: "2026-03-28T00:00:00.000Z",
      ends_at: "2026-04-30T00:00:00.000Z",
      revoked_at: null,
      note: null,
    };

    const response = await proxy(new NextRequest("https://reflix.dev/ko/browse"));
    const token = response.cookies.get(MEDIA_SESSION_COOKIE_NAME)?.value;
    const payload = await verifyMediaSessionToken(token!, "test-secret", Date.now());

    expect(payload).toMatchObject({
      v: 2,
      userId: "user-123",
      tier: "pro",
      accessSource: "beta",
    });
  });
});
