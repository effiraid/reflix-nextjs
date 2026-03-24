import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { MEDIA_SESSION_COOKIE_NAME } from "@/lib/mediaSession";
import { proxy } from "./proxy";

describe("proxy media session cookie", () => {
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
});
