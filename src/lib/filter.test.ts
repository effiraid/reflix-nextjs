import { describe, expect, it } from "vitest";
import { filterClips } from "./filter";
import type { ClipIndex } from "./types";

const clips: ClipIndex[] = [
  {
    id: "clip-1",
    name: "Arcane Breath",
    tags: ["마법"],
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
  {
    id: "clip-2",
    name: "Death Strike",
    tags: ["마법", "죽음"],
    folders: [],
    star: 3,
    category: "action",
    width: 100,
    height: 100,
    duration: 1,
    previewUrl: "/preview.mp4",
    thumbnailUrl: "/thumb.webp",
    lqipBase64: "",
  },
  {
    id: "clip-3",
    name: "Hit Reaction",
    tags: ["피격"],
    folders: [],
    star: 5,
    category: "action",
    width: 100,
    height: 100,
    duration: 1,
    previewUrl: "/preview.mp4",
    thumbnailUrl: "/thumb.webp",
    lqipBase64: "",
  },
  {
    id: "clip-4",
    name: "Heavy Walk",
    tags: ["걷기"],
    folders: [],
    star: 4,
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
        en: "A sad, slow walk cycle",
      },
      model: "gemini-2.5-flash",
      generatedAt: "2026-03-26T00:00:00.000Z",
    },
  },
];

const baseFilters = {
  category: null,
  selectedFolders: [],
  selectedTags: [],
  excludedTags: [],
  starFilter: null,
  searchQuery: "",
  sortBy: "newest" as const,
};

describe("filterClips", () => {
  it("matches translated tag labels when tag i18n data is provided", () => {
    const filtered = filterClips(
      clips,
      { ...baseFilters, searchQuery: "magic" },
      undefined,
      { 마법: "Magic" }
    );

    expect(filtered).toHaveLength(2);
  });

  it("matches AI-generated descriptions and structured tags", () => {
    const filtered = filterClips(clips, {
      ...baseFilters,
      searchQuery: "슬픈 장면",
    });

    expect(filtered.map((clip) => clip.id)).toContain("clip-4");
  });

  it("treats AI-generated tags as filterable tags", () => {
    const filtered = filterClips(clips, {
      ...baseFilters,
      selectedTags: ["슬픔"],
    });

    expect(filtered.map((clip) => clip.id)).toEqual(["clip-4"]);
  });

  it("returns all clips when excludedTags is empty", () => {
    const filtered = filterClips(clips, baseFilters);
    expect(filtered).toHaveLength(4);
  });

  it("excludes clips with a single excluded tag", () => {
    const filtered = filterClips(clips, {
      ...baseFilters,
      excludedTags: ["죽음"],
    });
    expect(filtered).toHaveLength(3);
    expect(filtered.map((c) => c.id)).toEqual(["clip-1", "clip-3", "clip-4"]);
  });

  it("excludes clips matching ANY excluded tag (OR logic)", () => {
    const filtered = filterClips(clips, {
      ...baseFilters,
      excludedTags: ["죽음", "피격"],
    });
    expect(filtered).toHaveLength(2);
    expect(filtered.map((c) => c.id)).toEqual(["clip-1", "clip-4"]);
  });

  it("combines include + exclude tags correctly", () => {
    const filtered = filterClips(clips, {
      ...baseFilters,
      selectedTags: ["마법"],
      excludedTags: ["죽음"],
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("clip-1");
  });
});
