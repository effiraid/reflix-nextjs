import { describe, expect, it } from "vitest";
import { matchTags } from "./tagSuggestions";

const sampleTags = [
  "걷기",
  "공격",
  "달리기",
  "마법",
  "마법사",
  "무기",
  "모션",
  "슬픔",
  "전사",
  "폭발",
  "Walk",
  "Magic",
  "Sword",
];

describe("matchTags", () => {
  it("returns empty for empty query", () => {
    expect(matchTags(sampleTags, "", "ko")).toEqual([]);
    expect(matchTags(sampleTags, "   ", "ko")).toEqual([]);
  });

  it("matches Korean tags by includes", () => {
    const result = matchTags(sampleTags, "마법", "ko");
    expect(result).toContain("마법");
    expect(result).toContain("마법사");
  });

  it("matches Korean tags by choseong", () => {
    const result = matchTags(sampleTags, "ㅁㅂ", "ko");
    expect(result).toContain("마법");
    expect(result).toContain("마법사");
  });

  it("matches Korean tags by qwerty→hangul", () => {
    // "akqjq" → "마법" via qwerty conversion
    const result = matchTags(sampleTags, "akqjq", "ko");
    expect(result.length).toBeGreaterThan(0);
  });

  it("matches English tags with fuzzy", () => {
    const result = matchTags(sampleTags, "mag", "en");
    expect(result).toContain("Magic");
  });

  it("limits to 8 results", () => {
    const manyTags = Array.from({ length: 20 }, (_, i) => `태그${i}`);
    const result = matchTags(manyTags, "태그", "ko");
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it("returns empty when no matches", () => {
    expect(matchTags(sampleTags, "zzzzz", "ko")).toEqual([]);
  });
});
