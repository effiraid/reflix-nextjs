import { describe, expect, it } from "vitest";
import { useUIStore } from "./uiStore";

describe("uiStore", () => {
  it("defaults first-time sessions to feed view", () => {
    expect(useUIStore.getState().viewMode).toBe("feed");
  });
});
