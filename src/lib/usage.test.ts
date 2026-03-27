import { describe, expect, it } from "vitest";
import { getDailyLimit, isViewAllowed, getRemainingViews } from "./usage";

describe("usage", () => {
  describe("getDailyLimit", () => {
    it("returns 20 for free tier", () => {
      expect(getDailyLimit("free")).toBe(20);
    });

    it("returns Infinity for pro tier", () => {
      expect(getDailyLimit("pro")).toBe(Infinity);
    });
  });

  describe("isViewAllowed", () => {
    it("allows view when under limit", () => {
      expect(isViewAllowed("free", 0)).toBe(true);
      expect(isViewAllowed("free", 19)).toBe(true);
    });

    it("blocks view when at limit", () => {
      expect(isViewAllowed("free", 20)).toBe(false);
    });

    it("blocks view when over limit", () => {
      expect(isViewAllowed("free", 25)).toBe(false);
    });

    it("always allows for pro", () => {
      expect(isViewAllowed("pro", 0)).toBe(true);
      expect(isViewAllowed("pro", 10000)).toBe(true);
    });
  });

  describe("getRemainingViews", () => {
    it("returns correct remaining for free", () => {
      expect(getRemainingViews("free", 0)).toBe(20);
      expect(getRemainingViews("free", 15)).toBe(5);
      expect(getRemainingViews("free", 20)).toBe(0);
      expect(getRemainingViews("free", 25)).toBe(0);
    });

    it("returns Infinity for pro", () => {
      expect(getRemainingViews("pro", 100)).toBe(Infinity);
    });
  });
});
