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

describe("AuthProvider", () => {
  beforeEach(() => {
    authHarness.callback = null;
    authHarness.queriedTables = [];
    routerReplaceMock.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem("reflix-auth-tab-id", "tab-self");
    useAuthStore.setState({
      user: null,
      tier: "free",
      isLoading: true,
    });
  });

  it("loads the profile tier without querying daily usage on sign-in", async () => {
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
    });

    expect(localStorage.getItem("reflix-active-auth-tab")).toContain("\"tabId\":\"tab-self\"");
    expect(authHarness.queriedTables).toEqual(["profiles"]);
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
    expect(authHarness.queriedTables).toEqual([]);
  });
});
