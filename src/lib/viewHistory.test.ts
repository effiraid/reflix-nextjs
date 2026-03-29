import { afterEach, describe, expect, it } from "vitest";
import {
  getViewHistory,
  addViewHistory,
  removeViewHistory,
  clearViewHistory,
} from "./viewHistory";

describe("viewHistory", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("returns empty array when nothing stored", () => {
    expect(getViewHistory()).toEqual([]);
  });

  it("adds a clip id to history", () => {
    addViewHistory("clip-1");
    expect(getViewHistory()).toEqual(["clip-1"]);
  });

  it("puts newest first", () => {
    addViewHistory("clip-1");
    addViewHistory("clip-2");
    expect(getViewHistory()).toEqual(["clip-2", "clip-1"]);
  });

  it("deduplicates (moves to front)", () => {
    addViewHistory("clip-1");
    addViewHistory("clip-2");
    addViewHistory("clip-1");
    expect(getViewHistory()).toEqual(["clip-1", "clip-2"]);
  });

  it("limits to 50 items", () => {
    for (let i = 0; i < 55; i++) {
      addViewHistory(`clip-${i}`);
    }
    expect(getViewHistory()).toHaveLength(50);
    expect(getViewHistory()[0]).toBe("clip-54");
  });

  it("ignores empty strings", () => {
    addViewHistory("");
    expect(getViewHistory()).toEqual([]);
  });

  it("removes a specific clip from history", () => {
    addViewHistory("clip-1");
    addViewHistory("clip-2");
    removeViewHistory("clip-1");
    expect(getViewHistory()).toEqual(["clip-2"]);
  });

  it("clears all history", () => {
    addViewHistory("clip-1");
    addViewHistory("clip-2");
    clearViewHistory();
    expect(getViewHistory()).toEqual([]);
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("reflix:view-history", "not-json");
    expect(getViewHistory()).toEqual([]);
  });
});
