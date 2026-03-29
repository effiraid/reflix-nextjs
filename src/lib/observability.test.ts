import { describe, expect, it } from "vitest";
import {
  getClientSentryConfig,
  getSentryDsn,
  getSentryEnvironment,
  getSentryTracesSampleRate,
  isSentryConfigured,
  shouldEnableWebAnalytics,
} from "./observability";

describe("observability helpers", () => {
  it("enables Vercel Web Analytics on Vercel deployments", () => {
    expect(
      shouldEnableWebAnalytics({
        VERCEL: "1",
      })
    ).toBe(true);

    expect(
      shouldEnableWebAnalytics({
        VERCEL_ENV: "preview",
      })
    ).toBe(true);
  });

  it("keeps Vercel Web Analytics disabled outside Vercel by default", () => {
    expect(
      shouldEnableWebAnalytics({
        NODE_ENV: "production",
      })
    ).toBe(false);
  });

  it("trims and validates the public Sentry DSN", () => {
    expect(
      getSentryDsn({
        NEXT_PUBLIC_SENTRY_DSN: "  https://public@example.ingest.sentry.io/1  ",
      })
    ).toBe("https://public@example.ingest.sentry.io/1");

    expect(isSentryConfigured({ NEXT_PUBLIC_SENTRY_DSN: "   " })).toBe(false);
    expect(
      isSentryConfigured({
        NEXT_PUBLIC_SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
      })
    ).toBe(true);
  });

  it("prefers an explicit Sentry environment and falls back cleanly", () => {
    expect(
      getSentryEnvironment({
        SENTRY_ENVIRONMENT: "production",
        VERCEL_ENV: "preview",
        NODE_ENV: "development",
      })
    ).toBe("production");

    expect(
      getSentryEnvironment({
        VERCEL_ENV: "preview",
        NODE_ENV: "development",
      })
    ).toBe("preview");

    expect(
      getSentryEnvironment({
        NODE_ENV: "production",
      })
    ).toBe("production");
  });

  it("parses a valid trace sample rate and falls back for invalid values", () => {
    expect(
      getSentryTracesSampleRate({
        NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: "0.25",
      })
    ).toBe(0.25);

    expect(
      getSentryTracesSampleRate({
        NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: "nope",
        NODE_ENV: "development",
      })
    ).toBe(1);

    expect(
      getSentryTracesSampleRate({
        NODE_ENV: "production",
      })
    ).toBe(0);
  });

  it("builds browser-safe Sentry config from NEXT_PUBLIC env vars", () => {
    const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    const originalRate = process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE;
    const originalNodeEnv = process.env.NODE_ENV;

    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://public@example.ingest.sentry.io/1";
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE = "0.5";
    process.env.NODE_ENV = "production";

    expect(getClientSentryConfig()).toEqual({
      dsn: "https://public@example.ingest.sentry.io/1",
      enabled: true,
      tracesSampleRate: 0.5,
    });

    process.env.NEXT_PUBLIC_SENTRY_DSN = "";
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE = "";
    process.env.NODE_ENV = "development";

    expect(getClientSentryConfig()).toEqual({
      dsn: "",
      enabled: false,
      tracesSampleRate: 1,
    });

    process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE = originalRate;
    process.env.NODE_ENV = originalNodeEnv;
  });
});
