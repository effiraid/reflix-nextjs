import { afterEach, describe, expect, it, vi } from "vitest";
import { getValidatedRequestOrigin } from "./requestOrigin";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
const ORIGINAL_VERCEL_PROJECT_PRODUCTION_URL =
  process.env.VERCEL_PROJECT_PRODUCTION_URL;
const ORIGINAL_VERCEL_URL = process.env.VERCEL_URL;

describe("getValidatedRequestOrigin", () => {
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
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", ORIGINAL_SITE_URL);
    }

    if (ORIGINAL_VERCEL_PROJECT_PRODUCTION_URL === undefined) {
      delete (process.env as Record<string, string | undefined>)
        .VERCEL_PROJECT_PRODUCTION_URL;
    } else {
      vi.stubEnv(
        "VERCEL_PROJECT_PRODUCTION_URL",
        ORIGINAL_VERCEL_PROJECT_PRODUCTION_URL
      );
    }

    if (ORIGINAL_VERCEL_URL === undefined) {
      delete (process.env as Record<string, string | undefined>).VERCEL_URL;
    } else {
      vi.stubEnv("VERCEL_URL", ORIGINAL_VERCEL_URL);
    }
  });

  it("accepts matching Origin headers", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://reflix.dev");

    const request = new Request("https://reflix.dev/api/profile", {
      method: "PUT",
      headers: {
        origin: "https://reflix.dev",
      },
    });

    expect(getValidatedRequestOrigin(request)).toEqual({
      ok: true,
      siteOrigin: "https://reflix.dev",
      requestOrigin: "https://reflix.dev",
    });
  });

  it("accepts matching Referer origins when Origin is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://reflix.dev");

    const request = new Request("https://reflix.dev/api/profile", {
      method: "PUT",
      headers: {
        referer: "https://reflix.dev/ko/account",
      },
    });

    expect(getValidatedRequestOrigin(request)).toEqual({
      ok: true,
      siteOrigin: "https://reflix.dev",
      requestOrigin: "https://reflix.dev",
    });
  });

  it("rejects mismatched origins", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://reflix.dev");

    const request = new Request("https://reflix.dev/api/profile", {
      method: "PUT",
      headers: {
        origin: "https://evil.example",
      },
    });

    expect(getValidatedRequestOrigin(request)).toEqual({
      ok: false,
      error: "invalid_origin",
      status: 403,
    });
  });

  it("rejects state-changing requests without origin metadata", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://reflix.dev");

    const request = new Request("https://reflix.dev/api/profile", {
      method: "PUT",
    });

    expect(getValidatedRequestOrigin(request)).toEqual({
      ok: false,
      error: "invalid_origin",
      status: 403,
    });
  });
});
