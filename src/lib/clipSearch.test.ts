import { describe, expect, it } from "vitest";
import { getSearchMode, searchClips } from "./clipSearch";
import type { BrowseProjectionRecord, ClipIndex } from "./types";

const clips: ClipIndex[] = [
  {
    id: "name-hit",
    name: "슬픈 걷기",
    tags: ["걷기"],
    folders: [],
    star: 0,
    category: "acting",
    width: 100,
    height: 100,
    duration: 1,
    previewUrl: "/preview.mp4",
    thumbnailUrl: "/thumb.webp",
    lqipBase64: "",
  },
  {
    id: "ai-hit",
    name: "Heavy Walk",
    tags: ["걷기"],
    folders: [],
    star: 0,
    category: "acting",
    width: 100,
    height: 100,
    duration: 1,
    previewUrl: "/preview.mp4",
    thumbnailUrl: "/thumb.webp",
    lqipBase64: "",
    aiTags: {
      actionType: ["걷기"],
      emotion: ["슬픔"],
      composition: ["풀샷"],
      pacing: "느림",
      characterType: ["전사"],
      effects: [],
      description: {
        ko: "슬픈 장면에서 천천히 걷는 모션",
        en: "A sad slow walk cycle",
      },
      model: "gemini-2.5-flash",
      generatedAt: "2026-03-26T00:00:00.000Z",
    },
  },
];

describe("getSearchMode", () => {
  it("routes choseong queries to instant local search", () => {
    expect(getSearchMode("ko", "ㅅㅍ")).toBe("instant");
  });

  it("routes qwerty-to-hangul queries to instant local search", () => {
    expect(getSearchMode("ko", "akqjq")).toBe("instant");
  });

  it("routes natural language queries to semantic search", () => {
    expect(getSearchMode("ko", "슬픈 장면")).toBe("semantic");
  });

  it("routes multi-word with one choseong word to instant", () => {
    expect(getSearchMode("ko", "아케인 ㅎㄱ")).toBe("instant");
  });

  it("routes multi-word with one latin word to instant", () => {
    expect(getSearchMode("ko", "아케인 abc")).toBe("instant");
  });
});

describe("searchClips", () => {
  it("ranks direct name hits ahead of AI description hits", () => {
    const results = searchClips(clips, {
      lang: "ko",
      query: "슬픈",
      tagI18n: {},
    });

    expect(results.map((clip) => clip.id)).toEqual(["name-hit", "ai-hit"]);
  });

  it("matches English AI tag labels when tag i18n contains AI structured tags", () => {
    const results = searchClips(clips, {
      lang: "en",
      query: "Sadness",
      tagI18n: {
        걷기: "Walk",
        슬픔: "Sadness",
      },
    });

    expect(results.map((clip) => clip.id)).toContain("ai-hit");
  });

  it("multi-word AND: matches when words hit different fields (name + tag)", () => {
    const multiClips: ClipIndex[] = [
      {
        id: "cross-field",
        name: "아케인 버스트",
        tags: ["힘겨움", "마법"],
        folders: [],
        star: 0,
        category: "acting",
        width: 100,
        height: 100,
        duration: 1,
        previewUrl: "/preview.mp4",
        thumbnailUrl: "/thumb.webp",
        lqipBase64: "",
      },
      {
        id: "partial-only",
        name: "아케인 샷",
        tags: ["마법"],
        folders: [],
        star: 0,
        category: "acting",
        width: 100,
        height: 100,
        duration: 1,
        previewUrl: "/preview.mp4",
        thumbnailUrl: "/thumb.webp",
        lqipBase64: "",
      },
    ];

    const results = searchClips(multiClips, {
      lang: "ko",
      query: "아케인 힘겨움",
      tagI18n: {},
    });

    expect(results.map((c) => c.id)).toEqual(["cross-field"]);
  });

  it("multi-word AND: excludes clips missing any word", () => {
    const results = searchClips(clips, {
      lang: "ko",
      query: "아케인 힘겨움",
      tagI18n: {},
    });

    expect(results).toHaveLength(0);
  });

  it("single word still works as before", () => {
    const results = searchClips(clips, {
      lang: "ko",
      query: "슬픈",
      tagI18n: {},
    });

    expect(results.map((c) => c.id)).toEqual(["name-hit", "ai-hit"]);
  });

  it("whitespace-only query returns all clips", () => {
    const results = searchClips(clips, {
      lang: "ko",
      query: "   ",
      tagI18n: {},
    });

    expect(results).toHaveLength(clips.length);
  });

  it("multi-word AND: order does not matter", () => {
    const multiClips: ClipIndex[] = [
      {
        id: "cross-field",
        name: "아케인 버스트",
        tags: ["힘겨움"],
        folders: [],
        star: 0,
        category: "acting",
        width: 100,
        height: 100,
        duration: 1,
        previewUrl: "/preview.mp4",
        thumbnailUrl: "/thumb.webp",
        lqipBase64: "",
      },
    ];

    const resultsA = searchClips(multiClips, { lang: "ko", query: "아케인 힘겨움", tagI18n: {} });
    const resultsB = searchClips(multiClips, { lang: "ko", query: "힘겨움 아케인", tagI18n: {} });

    expect(resultsA.map((c) => c.id)).toEqual(["cross-field"]);
    expect(resultsB.map((c) => c.id)).toEqual(["cross-field"]);
  });

  it("multi-word AND: English cross-field matching", () => {
    const enClips: ClipIndex[] = [
      {
        id: "en-cross",
        name: "Magic Burst",
        tags: ["attack"],
        folders: [],
        star: 0,
        category: "action",
        width: 100,
        height: 100,
        duration: 1,
        previewUrl: "/preview.mp4",
        thumbnailUrl: "/thumb.webp",
        lqipBase64: "",
      },
    ];

    const results = searchClips(enClips, {
      lang: "en",
      query: "magic attack",
      tagI18n: {},
    });

    expect(results.map((c) => c.id)).toEqual(["en-cross"]);
  });

  it("matches browse projection records via aiStructuredTags and searchTokens", () => {
    const projection: BrowseProjectionRecord[] = [
      {
        id: "projection-hit",
        name: "Arcane Burst",
        tags: ["마법"],
        aiStructuredTags: ["폭발", "분노"],
        folders: ["folder-1"],
        searchTokens: ["arcane", "burst", "분노", "폭발", "비전", "충돌"],
        star: 4,
        category: "action",
        width: 100,
        height: 100,
        duration: 1,
        previewUrl: "/preview.mp4",
        thumbnailUrl: "/thumb.webp",
        lqipBase64: "",
      },
    ];

    const results = searchClips(projection, {
      lang: "ko",
      query: "충돌",
      tagI18n: {
        폭발: "Explosion",
      },
    });

    expect(results.map((clip) => clip.id)).toEqual(["projection-hit"]);
  });
});
