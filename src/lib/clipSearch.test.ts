import { describe, expect, it } from "vitest";
import { getSearchMode, searchClips } from "./clipSearch";
import type { ClipIndex } from "./types";

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
});
