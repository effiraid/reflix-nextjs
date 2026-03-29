import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./AuthProvider";
import { useAuthStore } from "@/stores/authStore";

const { authHarness, routerReplaceMock } = vi.hoisted(() => ({
  authHarness: {
    callback: null as ((event: string, session: { user?: { id: string } } | null) => void) | null,
    queriedTables: [] as string[],
  },
  routerReplaceMock: vi.fn(),
}));

const { loadEffectiveAccessMock } = vi.hoisted(() => ({
  loadEffectiveAccessMock: vi.fn(),
}));

const { clearBlobVideoCacheMock } = vi.hoisted(() => ({
  clearBlobVideoCacheMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
  }),
  usePathname: () => "/ko/account",
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (callback: (event: string, session: { user?: { id: string } } | null) => void) => {
        authHarness.callback = callback;
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      },
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    },
    from: (table: string) => {
      authHarness.queriedTables.push(table);

      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { tier: "pro" },
              }),
            }),
          }),
        };
      }

      if (table === "daily_usage") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: { clip_views: 12 },
                }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

vi.mock("@/lib/supabase/access", () => ({
  loadEffectiveAccess: loadEffectiveAccessMock,
}));

vi.mock("@/lib/blobVideo", () => ({
  clearBlobVideoCache: clearBlobVideoCacheMock,
}));

describe("AuthProvider", () => {
  beforeEach(() => {
    authHarness.callback = null;
    authHarness.queriedTables = [];
    routerReplaceMock.mockReset();
    loadEffectiveAccessMock.mockReset();
    clearBlobVideoCacheMock.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem("reflix-auth-tab-id", "tab-self");
    loadEffectiveAccessMock.mockResolvedValue({
      planTier: "pro",
      effectiveTier: "pro",
      accessSource: "paid",
      betaEndsAt: null,
    });
    useAuthStore.setState({
      user: null,
      tier: "free",
      planTier: "free",
      accessSource: "free",
      betaEndsAt: null,
      isLoading: true,
    });
  });

  it("loads the effective access on sign-in", async () => {
    render(
      <AuthProvider>
        <div>child</div>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authHarness.callback).not.toBeNull();
    });

    await act(async () => {
      authHarness.callback?.("SIGNED_IN", {
        user: { id: "user-1" },
      });
    });

    await waitFor(() => {
      expect(useAuthStore.getState().user?.id).toBe("user-1");
      expect(useAuthStore.getState().tier).toBe("pro");
      expect(useAuthStore.getState().accessSource).toBe("paid");
    });

    expect(localStorage.getItem("reflix-active-auth-tab")).toContain("\"tabId\":\"tab-self\"");
    expect(loadEffectiveAccessMock).toHaveBeenCalledWith(expect.anything(), "user-1");
  });

  it("redirects a superseded tab back to login instead of accepting a shared session", async () => {
    localStorage.setItem(
      "reflix-active-auth-tab",
      JSON.stringify({
        tabId: "tab-owner",
        updatedAt: Date.now(),
      })
    );

    render(
      <AuthProvider>
        <div>child</div>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authHarness.callback).not.toBeNull();
    });

    await act(async () => {
      authHarness.callback?.("SIGNED_IN", {
        user: { id: "user-2" },
      });
    });

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith("/ko/login?error=replaced");
    });

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().tier).toBe("free");
    expect(useAuthStore.getState().accessSource).toBe("free");
    expect(loadEffectiveAccessMock).not.toHaveBeenCalled();
  });

  it("stores beta access metadata while keeping tier as effective pro", async () => {
    loadEffectiveAccessMock.mockResolvedValue({
      planTier: "free",
      effectiveTier: "pro",
      accessSource: "beta",
      betaEndsAt: "2026-04-30T00:00:00.000Z",
    });

    render(
      <AuthProvider>
        <div>child</div>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authHarness.callback).not.toBeNull();
    });

    await act(async () => {
      authHarness.callback?.("SIGNED_IN", {
        user: { id: "user-1" },
      });
    });

    await waitFor(() => {
      expect(useAuthStore.getState()).toMatchObject({
        tier: "pro",
        planTier: "free",
        accessSource: "beta",
        betaEndsAt: "2026-04-30T00:00:00.000Z",
      });
    });
  });

  it("clears cached protected media on sign-out", async () => {
    render(
      <AuthProvider>
        <div>child</div>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authHarness.callback).not.toBeNull();
    });

    await act(async () => {
      authHarness.callback?.("SIGNED_IN", {
        user: { id: "user-1" },
      });
    });

    await act(async () => {
      authHarness.callback?.("SIGNED_OUT", null);
    });

    expect(clearBlobVideoCacheMock).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
