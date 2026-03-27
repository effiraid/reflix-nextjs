import { describe, it, expect } from "vitest";
import {
  buildLeafToTopMap,
  groupClipsByTopCategory,
  pickHeroAndSubs,
  type TopCategoryInfo,
} from "./feedGrouping";
import type { BrowseSummaryRecord, CategoryTree } from "./types";

const CATEGORIES: CategoryTree = {
  FOLDER_MOVE: {
    slug: "movement",
    i18n: { ko: "이동", en: "Movement" },
    children: {
      FOLDER_WALK: { slug: "walk", i18n: { ko: "걷기", en: "Walk" } },
      FOLDER_RUN: { slug: "run", i18n: { ko: "달리기", en: "Run" } },
    },
  },
  FOLDER_COMBAT: {
    slug: "combat",
    i18n: { ko: "교전", en: "Combat" },
    children: {
      FOLDER_ATTACK: { slug: "attack", i18n: { ko: "공격", en: "Attack" } },
    },
  },
  FOLDER_RETURN: {
    slug: "return",
    i18n: { ko: "리턴", en: "Return" },
  },
};

function makeClip(
  id: string,
  category: string,
  star: number
): BrowseSummaryRecord {
  return {
    id,
    name: `clip-${id}`,
    thumbnailUrl: `/thumbnails/${id}.webp`,
    previewUrl: `/previews/${id}.mp4`,
    lqipBase64: "",
    width: 1920,
    height: 1080,
    duration: 2,
    star,
    category,
  };
}

describe("buildLeafToTopMap", () => {
  it("maps leaf slugs to their top-level parent", () => {
    const map = buildLeafToTopMap(CATEGORIES);
    expect(map.get("walk")).toEqual({
      topSlug: "movement",
      topFolderId: "FOLDER_MOVE",
      topI18n: { ko: "이동", en: "Movement" },
    });
    expect(map.get("attack")).toEqual({
      topSlug: "combat",
      topFolderId: "FOLDER_COMBAT",
      topI18n: { ko: "교전", en: "Combat" },
    });
  });

  it("maps top-level slug to itself when it has no children", () => {
    const map = buildLeafToTopMap(CATEGORIES);
    expect(map.get("return")).toEqual({
      topSlug: "return",
      topFolderId: "FOLDER_RETURN",
      topI18n: { ko: "리턴", en: "Return" },
    });
  });

  it("maps top-level slug to itself when it also has children", () => {
    const map = buildLeafToTopMap(CATEGORIES);
    expect(map.get("movement")?.topSlug).toBe("movement");
  });
});

describe("groupClipsByTopCategory", () => {
  it("groups clips by top-level category", () => {
    const clips = [
      makeClip("1", "walk", 5),
      makeClip("2", "run", 3),
      makeClip("3", "attack", 4),
    ];
    const map = buildLeafToTopMap(CATEGORIES);
    const grouped = groupClipsByTopCategory(clips, map);

    expect(grouped.get("movement")?.length).toBe(2);
    expect(grouped.get("combat")?.length).toBe(1);
  });

  it("puts unknown categories under 'uncategorized'", () => {
    const clips = [makeClip("1", "unknown-slug", 3)];
    const map = buildLeafToTopMap(CATEGORIES);
    const grouped = groupClipsByTopCategory(clips, map);

    expect(grouped.get("uncategorized")?.length).toBe(1);
  });

  it("handles empty clip array", () => {
    const map = buildLeafToTopMap(CATEGORIES);
    const grouped = groupClipsByTopCategory([], map);
    expect(grouped.size).toBe(0);
  });
});

describe("pickHeroAndSubs", () => {
  it("picks highest-star clip as hero, next 3 as subs", () => {
    const clips = [
      makeClip("1", "walk", 3),
      makeClip("2", "walk", 5),
      makeClip("3", "walk", 4),
      makeClip("4", "walk", 4),
      makeClip("5", "walk", 2),
    ];
    const { hero, subs } = pickHeroAndSubs(clips);

    expect(hero!.id).toBe("2");
    expect(subs).toHaveLength(3);
    expect(subs[0].id).toBe("3");
    expect(subs[1].id).toBe("4");
    expect(subs[2].id).toBe("1");
  });

  it("returns hero only when fewer than 2 clips", () => {
    const clips = [makeClip("1", "walk", 3)];
    const { hero, subs } = pickHeroAndSubs(clips);
    expect(hero!.id).toBe("1");
    expect(subs).toHaveLength(0);
  });

  it("handles all-zero stars by using array order", () => {
    const clips = [
      makeClip("a", "walk", 0),
      makeClip("b", "walk", 0),
      makeClip("c", "walk", 0),
    ];
    const { hero, subs } = pickHeroAndSubs(clips);
    expect(hero!.id).toBe("a");
    expect(subs).toHaveLength(2);
  });

  it("limits subs to 3 even with many clips", () => {
    const clips = Array.from({ length: 10 }, (_, i) =>
      makeClip(`${i}`, "walk", i)
    );
    const { subs } = pickHeroAndSubs(clips);
    expect(subs).toHaveLength(3);
  });
});
