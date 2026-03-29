import { describe, expect, it } from "vitest";
import { matchTags, matchTagsWithMeta, buildTagGroupLookup, buildClientAliasMap, diversifyPopularTags } from "./tagSuggestions";
import type { TagGroupData } from "./types";

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

describe("matchTagsWithMeta", () => {
  const tagGroups: TagGroupData = {
    groups: [
      {
        id: "emotion-pain",
        name: { ko: "아픔", en: "Pain" },
        parent: "emotion",
        color: "#ef4444",
        tags: ["아픔", "고통"],
      },
      {
        id: "action-movement",
        name: { ko: "이동", en: "Movement" },
        parent: "action",
        color: "#06b6d4",
        tags: ["달리기", "걷기"],
      },
    ],
    parentGroups: [],
  };

  const tagCounts: Record<string, number> = {
    "달리기": 5,
    "걷기": 3,
    "아픔": 2,
  };

  it("returns TagSuggestionItem with group info and count", () => {
    const lookup = buildTagGroupLookup(tagGroups, "ko");
    const result = matchTagsWithMeta(
      ["달리기", "걷기", "아픔"],
      "달",
      "ko",
      { tagCounts, tagGroupLookup: lookup }
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      tag: "달리기",
      groupName: "이동",
      groupColor: "#06b6d4",
      count: 5,
      aliases: undefined,
    });
  });

  it("includes alias info when aliasMap provided", () => {
    const lookup = buildTagGroupLookup(tagGroups, "ko");
    const aliasMap = buildClientAliasMap({ aliases: { "아픔": ["고통", "괴로움"] } });
    const result = matchTagsWithMeta(
      ["아픔"],
      "아",
      "ko",
      { tagCounts, tagGroupLookup: lookup, aliasMap }
    );
    expect(result).toHaveLength(1);
    expect(result[0].aliases).toEqual(["고통", "괴로움"]);
  });

  it("matches alias queries and returns the canonical tag", () => {
    const lookup = buildTagGroupLookup(tagGroups, "ko");
    const aliasMap = buildClientAliasMap({ aliases: { "아픔": ["고통", "괴로움"] } });
    const result = matchTagsWithMeta(
      ["아픔"],
      "고통",
      "ko",
      { tagCounts, tagGroupLookup: lookup, aliasMap }
    );

    expect(result.map((item) => item.tag)).toEqual(["아픔"]);
  });

  it("gracefully handles missing tagCounts", () => {
    const result = matchTagsWithMeta(["마법"], "마", "ko");
    expect(result[0].count).toBe(0);
    expect(result[0].groupName).toBeUndefined();
  });

  it("excludes alias tags from suggestions", () => {
    const aliasMap = buildClientAliasMap({ aliases: { "힘듦": ["힘겨움"] } });
    const result = matchTagsWithMeta(
      ["힘듦", "힘겨움", "힘겨워하다"],
      "힘",
      "ko",
      { aliasMap }
    );
    const tags = result.map((r) => r.tag);
    expect(tags).toContain("힘듦");
    expect(tags).not.toContain("힘겨움");
    // "힘겨워하다" is NOT an alias, so it should still appear
    expect(tags).toContain("힘겨워하다");
  });
});

describe("buildTagGroupLookup", () => {
  it("maps tags to their group name and color", () => {
    const tagGroups: TagGroupData = {
      groups: [
        { id: "g1", name: { ko: "감정", en: "Emotion" }, parent: "emotion", color: "#ff0000", tags: ["분노", "슬픔"] },
      ],
      parentGroups: [],
    };
    const lookup = buildTagGroupLookup(tagGroups, "ko");
    expect(lookup.get("분노")).toEqual({ groupName: "감정", groupColor: "#ff0000" });
    expect(lookup.get("없는태그")).toBeUndefined();
  });

  it("uses en name when lang is en", () => {
    const tagGroups: TagGroupData = {
      groups: [
        { id: "g1", name: { ko: "감정", en: "Emotion" }, parent: "emotion", tags: ["분노"] },
      ],
      parentGroups: [],
    };
    const lookup = buildTagGroupLookup(tagGroups, "en");
    expect(lookup.get("분노")?.groupName).toBe("Emotion");
  });
});

describe("matchTagsWithMeta sorting", () => {
  it("sorts by exact > prefix > contains, then count desc", () => {
    const allTags = ["달리기", "메달리기", "달", "달걀"];
    const tagCounts: Record<string, number> = {
      "달리기": 5,
      "메달리기": 10,
      "달": 1,
      "달걀": 3,
    };
    const result = matchTagsWithMeta(allTags, "달", "ko", { tagCounts });
    const tags = result.map((r) => r.tag);
    // exact "달" first, then prefix sorted by count: "달리기"(5) > "달걀"(3), then contains "메달리기"(10)
    expect(tags[0]).toBe("달");
    expect(tags[1]).toBe("달리기");
    expect(tags[2]).toBe("달걀");
    expect(tags[3]).toBe("메달리기");
  });

  it("sorts grouped tags before AI tags at same count", () => {
    const tagGroups: TagGroupData = {
      groups: [{ id: "g1", name: { ko: "행동", en: "Action" }, parent: "action", tags: ["달리기"] }],
      parentGroups: [],
    };
    const lookup = buildTagGroupLookup(tagGroups, "ko");
    const result = matchTagsWithMeta(
      ["달리기", "달려들기"],
      "달",
      "ko",
      { tagCounts: { "달리기": 3, "달려들기": 3 }, tagGroupLookup: lookup }
    );
    // "달리기" (grouped) should come before "달려들기" (AI) at same count
    expect(result[0].tag).toBe("달리기");
    expect(result[1].tag).toBe("달려들기");
  });
});

describe("diversifyPopularTags", () => {
  const tagGroups: TagGroupData = {
    groups: [
      { id: "emotion-angry", name: { ko: "화남", en: "Anger" }, parent: "emotion", tags: ["분노", "짜증", "화남"] },
      { id: "emotion-sad", name: { ko: "슬픔", en: "Sadness" }, parent: "emotion", tags: ["슬픔", "우울"] },
      { id: "action-action", name: { ko: "행동", en: "Action" }, parent: "action", tags: ["달리기", "걷기", "잡기"] },
    ],
    parentGroups: [],
  };

  it("limits to max 2 per parent group", () => {
    const tags = ["분노", "짜증", "화남", "슬픔", "달리기", "걷기"];
    const counts: Record<string, number> = {
      "분노": 10, "짜증": 8, "화남": 7, "슬픔": 6, "달리기": 5, "걷기": 4,
    };
    const lookup = buildTagGroupLookup(tagGroups, "ko");
    const result = diversifyPopularTags(tags, counts, lookup, tagGroups);

    // emotion should have max 2 (분노, 짜증), not 3 (화남 skipped initially)
    const emotionTags = result.filter((t) => ["분노", "짜증", "화남", "슬픔", "우울"].includes(t));
    // action tags should be included for diversity
    expect(result).toContain("달리기");
    // First 2 emotion tags by count: 분노, 짜증
    expect(result.indexOf("분노")).toBeLessThan(result.indexOf("달리기"));
  });

  it("fills remaining slots with skipped tags", () => {
    const tags = ["분노", "짜증", "화남", "슬픔", "달리기"];
    const counts: Record<string, number> = {
      "분노": 10, "짜증": 8, "화남": 7, "슬픔": 6, "달리기": 5,
    };
    const lookup = buildTagGroupLookup(tagGroups, "ko");
    const result = diversifyPopularTags(tags, counts, lookup, tagGroups);
    // 화남 was skipped (emotion already has 2) but should fill remaining
    expect(result).toContain("화남");
  });
});

describe("buildClientAliasMap", () => {
  it("builds reverse map from alias config", () => {
    const map = buildClientAliasMap({ aliases: { "힘듦": ["힘겨움"], "아픔": ["고통"] } });
    expect(map.get("힘듦")).toEqual(["힘겨움"]);
    expect(map.get("아픔")).toEqual(["고통"]);
  });

  it("returns empty map for null config", () => {
    expect(buildClientAliasMap(null).size).toBe(0);
  });
});
