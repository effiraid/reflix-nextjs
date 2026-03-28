import { afterEach, describe, expect, it } from "vitest";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
} from "./recentSearches";

describe("recentSearches", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("returns empty array when nothing stored", () => {
    expect(getRecentSearches()).toEqual([]);
  });

  it("adds and retrieves a search", () => {
    addRecentSearch("마법");
    expect(getRecentSearches()).toEqual(["마법"]);
  });

  it("puts newest first", () => {
    addRecentSearch("마법");
    addRecentSearch("공격");
    expect(getRecentSearches()).toEqual(["공격", "마법"]);
  });

  it("deduplicates (moves to front)", () => {
    addRecentSearch("마법");
    addRecentSearch("공격");
    addRecentSearch("마법");
    expect(getRecentSearches()).toEqual(["마법", "공격"]);
  });

  it("limits to 5 items", () => {
    for (let i = 0; i < 7; i++) {
      addRecentSearch(`검색${i}`);
    }
    expect(getRecentSearches()).toHaveLength(5);
    expect(getRecentSearches()[0]).toBe("검색6");
  });

  it("ignores empty/whitespace strings", () => {
    addRecentSearch("");
    addRecentSearch("   ");
    expect(getRecentSearches()).toEqual([]);
  });

  it("removes a specific search", () => {
    addRecentSearch("마법");
    addRecentSearch("공격");
    removeRecentSearch("마법");
    expect(getRecentSearches()).toEqual(["공격"]);
  });

  it("clears all searches", () => {
    addRecentSearch("마법");
    addRecentSearch("공격");
    clearRecentSearches();
    expect(getRecentSearches()).toEqual([]);
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("reflix:recent-searches", "not-json");
    expect(getRecentSearches()).toEqual([]);
  });
});
