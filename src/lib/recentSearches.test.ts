import { afterEach, describe, expect, it } from "vitest";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  migrateRecentSearches,
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

describe("migrateRecentSearches", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("replaces alias tags with canonical tags", () => {
    addRecentSearch("힘겨움");
    addRecentSearch("마법");
    migrateRecentSearches({ "힘듦": ["힘겨움"] });
    // Order preserved: ["마법", "힘겨움"] → ["마법", "힘듦"]
    expect(getRecentSearches()).toEqual(["마법", "힘듦"]);
  });

  it("deduplicates after migration", () => {
    addRecentSearch("힘겨움");
    addRecentSearch("힘듦");
    migrateRecentSearches({ "힘듦": ["힘겨움"] });
    const result = getRecentSearches();
    expect(result.filter((q) => q === "힘듦")).toHaveLength(1);
  });

  it("runs only once", () => {
    addRecentSearch("힘겨움");
    migrateRecentSearches({ "힘듦": ["힘겨움"] });
    // Now add alias again and migrate — should not change
    addRecentSearch("힘겨움");
    migrateRecentSearches({ "힘듦": ["힘겨움"] });
    expect(getRecentSearches()).toContain("힘겨움");
  });

  it("handles empty aliases gracefully", () => {
    addRecentSearch("마법");
    migrateRecentSearches({});
    expect(getRecentSearches()).toEqual(["마법"]);
  });

  it("reruns the migration when the alias config version changes", () => {
    addRecentSearch("힘겨움");
    migrateRecentSearches({ "힘듦": ["힘겨움"] }, 1);

    addRecentSearch("고통");
    migrateRecentSearches({ "힘듦": ["힘겨움"], "아픔": ["고통"] }, 2);

    expect(getRecentSearches()).toEqual(["아픔", "힘듦"]);
  });
});
