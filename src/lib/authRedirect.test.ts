import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthCallbackUrl,
  sanitizePostAuthRedirect,
} from "./authRedirect";

describe("auth redirect helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps safe internal post-auth paths", () => {
    expect(
      sanitizePostAuthRedirect("/en/account?tab=billing", "/ko/browse")
    ).toBe("/en/account?tab=billing");
  });

  it("rejects absolute external redirect targets", () => {
    expect(
      sanitizePostAuthRedirect("https://evil.example/phish", "/ko/browse")
    ).toBe("/ko/browse");
  });

  it("rejects protocol-relative redirect targets", () => {
    expect(sanitizePostAuthRedirect("//evil.example", "/ko/browse")).toBe(
      "/ko/browse"
    );
  });

  it("uses the configured public site URL for auth callbacks when available", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://reflix.dev");

    expect(buildAuthCallbackUrl("ko", "http://localhost:3000")).toBe(
      "https://reflix.dev/ko/auth/callback"
    );
  });

  it("falls back to the current origin for local auth callbacks", () => {
    expect(buildAuthCallbackUrl("ko", "http://localhost:3000")).toBe(
      "http://localhost:3000/ko/auth/callback"
    );
  });

  it("adds a safe next param to auth callback URLs", () => {
    expect(
      buildAuthCallbackUrl(
        "ko",
        "http://localhost:3000",
        "/ko/account?linked=google"
      )
    ).toBe(
      "http://localhost:3000/ko/auth/callback?next=%2Fko%2Faccount%3Flinked%3Dgoogle"
    );
  });

  it("falls back to the locale browse path when next is unsafe", () => {
    expect(
      buildAuthCallbackUrl("en", "http://localhost:3000", "https://evil.example")
    ).toBe(
      "http://localhost:3000/en/auth/callback?next=%2Fen%2Fbrowse"
    );
  });
});
