import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./AuthProvider";
import { useAuthStore } from "@/stores/authStore";

const { authHarness } = vi.hoisted(() => ({
  authHarness: {
    callback: null as ((event: string, session: { user?: { id: string } } | null) => void) | null,
    queriedTables: [] as string[],
  },
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

    expect(authHarness.queriedTables).toEqual(["profiles"]);
  });
});
