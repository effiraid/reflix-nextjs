import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  routerReplaceMock,
  setSessionMock,
  getUserMock,
  broadcastPostMessageMock,
  broadcastCloseMock,
} = vi.hoisted(() => ({
  routerReplaceMock: vi.fn(),
  setSessionMock: vi.fn(),
  getUserMock: vi.fn(),
  broadcastPostMessageMock: vi.fn(),
  broadcastCloseMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
  }),
  useParams: () => ({
    lang: "ko",
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      setSession: setSessionMock,
      getUser: getUserMock,
    },
  }),
}));

import AuthCallbackPage from "./page";

describe("AuthCallbackPage", () => {
  beforeEach(() => {
    routerReplaceMock.mockReset();
    setSessionMock.mockReset();
    getUserMock.mockReset();
    broadcastPostMessageMock.mockReset();
    broadcastCloseMock.mockReset();

    window.history.replaceState(
      null,
      "",
      "http://localhost:3000/ko/auth/callback"
    );

    setSessionMock.mockResolvedValue({ error: null });
    getUserMock.mockResolvedValue({ data: { user: null } });

    vi.stubGlobal(
      "BroadcastChannel",
      class BroadcastChannel {
        postMessage(message: string) {
          broadcastPostMessageMock(message);
        }

        close() {
          broadcastCloseMock();
        }
      }
    );

    window.close = vi.fn();
  });

  it("redirects linked Google flows back to account without closing the tab", async () => {
    window.history.replaceState(
      null,
      "",
      "http://localhost:3000/ko/auth/callback?next=%2Fko%2Faccount%3Flinked%3Dgoogle#access_token=a&refresh_token=b"
    );

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith("/ko/account?linked=google");
    });

    expect(window.close).not.toHaveBeenCalled();
  });

  it("defaults successful sign-in callbacks to the locale browse page", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith("/ko/browse");
    });
  });

  it("routes failed link callbacks back to account with an inline error flag", async () => {
    window.history.replaceState(
      null,
      "",
      "http://localhost:3000/ko/auth/callback?next=%2Fko%2Faccount%3Flinked%3Dgoogle"
    );

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith("/ko/account?linkError=google");
    });
  });
});
