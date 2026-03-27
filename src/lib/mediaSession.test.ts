import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMediaSessionConfig,
  getPayloadTier,
  isProtectedMediaPath,
  signMediaSessionToken,
  verifyMediaSessionToken,
} from "./mediaSession";

describe("isProtectedMediaPath", () => {
  it("marks videos and previews as protected paths", () => {
    expect(isProtectedMediaPath("/videos/clip-1.mp4")).toBe(true);
    expect(isProtectedMediaPath("/previews/clip-1.mp4")).toBe(true);
    expect(isProtectedMediaPath("/thumbnails/clip-1.webp")).toBe(false);
    expect(isProtectedMediaPath("/data/clips/clip-1.json")).toBe(false);
  });
});

describe("media session tokens", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips a valid signed session token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T09:00:00Z"));

    const now = Date.now();
    const token = await signMediaSessionToken(
      { v: 1, host: "reflix.dev", exp: now + 60_000 },
      "test-secret"
    );

    await expect(verifyMediaSessionToken(token, "test-secret", now)).resolves.toEqual({
      v: 1,
      host: "reflix.dev",
      exp: now + 60_000,
    });
  });

  it("round-trips a v2 token with tier and userId", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T09:00:00Z"));

    const now = Date.now();
    const token = await signMediaSessionToken(
      { v: 2, host: "reflix.dev", exp: now + 60_000, userId: "user-123", tier: "pro" },
      "test-secret"
    );

    const payload = await verifyMediaSessionToken(token, "test-secret", now);
    expect(payload).toEqual({
      v: 2,
      host: "reflix.dev",
      exp: now + 60_000,
      userId: "user-123",
      tier: "pro",
    });
    expect(getPayloadTier(payload!)).toBe("pro");
  });

  it("v1 token defaults to free tier via getPayloadTier", async () => {
    const now = Date.now();
    const token = await signMediaSessionToken(
      { v: 1, host: "reflix.dev", exp: now + 60_000 },
      "test-secret"
    );

    const payload = await verifyMediaSessionToken(token, "test-secret", now);
    expect(getPayloadTier(payload!)).toBe("free");
  });

  it("rejects expired and tampered tokens", async () => {
    const now = Date.now();
    const expired = await signMediaSessionToken(
      { v: 1, host: "reflix.dev", exp: now - 1 },
      "test-secret"
    );

    await expect(verifyMediaSessionToken(expired, "test-secret", now)).resolves.toBeNull();
    await expect(
      verifyMediaSessionToken(`${expired}x`, "test-secret", now)
    ).resolves.toBeNull();
  });
});

describe("getMediaSessionConfig", () => {
  it("enables protection only when base, secret, and domain are all configured", () => {
    expect(
      getMediaSessionConfig({
        NEXT_PUBLIC_MEDIA_URL: "https://media.reflix.dev",
        MEDIA_SESSION_SECRET: "secret",
        MEDIA_SESSION_COOKIE_DOMAIN: ".reflix.dev",
        MEDIA_SESSION_TTL_SECONDS: "21600",
      })
    ).toEqual({
      enabled: true,
      mediaBase: "https://media.reflix.dev",
      secret: "secret",
      domain: ".reflix.dev",
      ttlSeconds: 21600,
    });

    expect(
      getMediaSessionConfig({
        NEXT_PUBLIC_MEDIA_URL: "https://media.reflix.dev",
        MEDIA_SESSION_SECRET: "",
        MEDIA_SESSION_COOKIE_DOMAIN: ".reflix.dev",
      }).enabled
    ).toBe(false);
  });

  it("falls back to the default ttl when the env value is invalid", () => {
    expect(
      getMediaSessionConfig({
        NEXT_PUBLIC_MEDIA_URL: "https://media.reflix.dev",
        MEDIA_SESSION_SECRET: "secret",
        MEDIA_SESSION_COOKIE_DOMAIN: ".reflix.dev",
        MEDIA_SESSION_TTL_SECONDS: "invalid",
      }).ttlSeconds
    ).toBe(21600);
  });
});
