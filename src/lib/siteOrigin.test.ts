import { afterEach, describe, expect, it, vi } from "vitest";
import { getTrustedSiteOrigin } from "./siteOrigin";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
const ORIGINAL_VERCEL_PROJECT_PRODUCTION_URL =
  process.env.VERCEL_PROJECT_PRODUCTION_URL;
const ORIGINAL_VERCEL_URL = process.env.VERCEL_URL;

describe("getTrustedSiteOrigin", () => {
  afterEach(() => {
    if (ORIGINAL_NODE_ENV === undefined) {
      delete (process.env as Record<string, string | undefined>).NODE_ENV;
    } else {
      vi.stubEnv("NODE_ENV", ORIGINAL_NODE_ENV);
    }

    if (ORIGINAL_SITE_URL === undefined) {
      delete (process.env as Record<string, string | undefined>)
        .NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
    }

    if (ORIGINAL_VERCEL_PROJECT_PRODUCTION_URL === undefined) {
      delete (process.env as Record<string, string | undefined>)
        .VERCEL_PROJECT_PRODUCTION_URL;
    } else {
      process.env.VERCEL_PROJECT_PRODUCTION_URL =
        ORIGINAL_VERCEL_PROJECT_PRODUCTION_URL;
    }

    if (ORIGINAL_VERCEL_URL === undefined) {
      delete (process.env as Record<string, string | undefined>).VERCEL_URL;
    } else {
      process.env.VERCEL_URL = ORIGINAL_VERCEL_URL;
    }
  });

  it("prefers the configured site URL over the request origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_SITE_URL = "https://reflix.dev";
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;

    expect(getTrustedSiteOrigin("https://evil.example")).toBe(
      "https://reflix.dev"
    );
  });

  it("falls back to the runtime origin during local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;

    expect(getTrustedSiteOrigin("http://localhost:3000")).toBe(
      "http://localhost:3000"
    );
  });

  it("refuses to trust the runtime origin in production when no site URL is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;

    expect(getTrustedSiteOrigin("https://evil.example")).toBeNull();
  });
});
