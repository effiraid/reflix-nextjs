import { render, waitFor, act } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const {
  routerReplaceMock,
  setSessionMock,
  getUserMock,
} = vi.hoisted(() => ({
  routerReplaceMock: vi.fn(),
  setSessionMock: vi.fn(),
  getUserMock: vi.fn(),
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
    vi.useFakeTimers();
    routerReplaceMock.mockReset();
    setSessionMock.mockReset();
    getUserMock.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem("reflix-auth-tab-id", "tab-fresh");

    window.history.replaceState(
      null,
      "",
      "http://localhost:3000/ko/auth/callback"
    );

    setSessionMock.mockResolvedValue({ error: null });
    getUserMock.mockResolvedValue({ data: { user: null } });

    window.close = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("redirects linked Google flows back to account without closing the tab", async () => {
    window.history.replaceState(
      null,
      "",
      "http://localhost:3000/ko/auth/callback?next=%2Fko%2Faccount%3Flinked%3Dgoogle#access_token=a&refresh_token=b"
    );

    render(<AuthCallbackPage />);

    // Wait for async auth to complete, then advance past minDelay
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(routerReplaceMock).toHaveBeenCalledWith("/ko/account?linked=google");

    expect(localStorage.getItem("reflix-active-auth-tab")).toContain(
      "\"tabId\":\"tab-fresh\""
    );
    expect(window.close).not.toHaveBeenCalled();
  });

  it("defaults successful sign-in callbacks to the locale browse page", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    render(<AuthCallbackPage />);

    // Wait for async auth to complete, then advance past minDelay
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(routerReplaceMock).toHaveBeenCalledWith("/ko/browse");
  });

  it("routes failed link callbacks back to account with an inline error flag", async () => {
    window.history.replaceState(
      null,
      "",
      "http://localhost:3000/ko/auth/callback?next=%2Fko%2Faccount%3Flinked%3Dgoogle"
    );

    render(<AuthCallbackPage />);

    // Wait for async auth to complete, then advance past minDelay
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(routerReplaceMock).toHaveBeenCalledWith("/ko/account?linkError=google");
  });
});
