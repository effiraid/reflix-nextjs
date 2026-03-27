import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const { exchangeState } = vi.hoisted(() => ({
  exchangeState: {
    error: null as { message: string } | null,
  },
}));

type ServerClientOptions = {
  cookies: {
    setAll?: (
      cookiesToSet: Array<{
        name: string;
        value: string;
        options: Record<string, unknown>;
      }>
    ) => void;
  };
};

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(
    (_url: string, _key: string, options: ServerClientOptions) => ({
    auth: {
      exchangeCodeForSession: vi.fn(async () => {
        options.cookies.setAll?.([
          {
            name: "sb-access-token",
            value: "test-token",
            options: { path: "/" },
          },
        ]);

        return { error: exchangeState.error };
      }),
    },
    })
  ),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

describe("auth callback redirect hardening", () => {
  beforeEach(() => {
    exchangeState.error = null;
  });

  it("falls back to browse when next points to another origin", async () => {
    const response = await GET(
      new NextRequest(
        "https://reflix.dev/api/auth/callback?code=test-code&next=https://evil.com"
      )
    );

    expect(response.headers.get("location")).toBe("https://reflix.dev/ko/browse");
  });

  it("allows locale-prefixed internal next paths", async () => {
    const response = await GET(
      new NextRequest(
        "https://reflix.dev/api/auth/callback?code=test-code&next=/en/pricing"
      )
    );

    expect(response.headers.get("location")).toBe("https://reflix.dev/en/pricing");
  });
});
