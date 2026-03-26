import { describe, expect, it } from "vitest";
import { shouldEnableSpeedInsights } from "./speedInsights";

describe("shouldEnableSpeedInsights", () => {
  it("returns false when no Vercel or observability configuration is present", () => {
    expect(
      shouldEnableSpeedInsights({
        NODE_ENV: "production",
      })
    ).toBe(false);
  });

  it("returns true on Vercel deployments", () => {
    expect(
      shouldEnableSpeedInsights({
        VERCEL: "1",
      })
    ).toBe(true);
  });

  it("returns true when an observability base path is configured", () => {
    expect(
      shouldEnableSpeedInsights({
        REACT_APP_VERCEL_OBSERVABILITY_BASEPATH: "/_vercel",
      })
    ).toBe(true);
  });

  it("returns true when observability client config is configured", () => {
    expect(
      shouldEnableSpeedInsights({
        REACT_APP_VERCEL_OBSERVABILITY_CLIENT_CONFIG: "{\"speedInsights\":{}}",
      })
    ).toBe(true);
  });
});
