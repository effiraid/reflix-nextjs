import { describe, expect, it } from "vitest";
import { canAccessFullVideo } from "./accessPolicy";

describe("canAccessFullVideo", () => {
  it("allows guests to play full video from shared detail links", () => {
    expect(canAccessFullVideo(null, "free", "detail")).toBe(true);
  });

  it("keeps guest browse playback gated", () => {
    expect(canAccessFullVideo(null, "free", "browse")).toBe(false);
  });

  it("allows free users to play full video from browse", () => {
    expect(
      canAccessFullVideo({ id: "user-1" }, "free", "browse")
    ).toBe(true);
  });
});
