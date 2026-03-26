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

  it("returns all clips when excludedTags is empty", () => {
    const filtered = filterClips(clips, baseFilters);
    expect(filtered).toHaveLength(3);
  });

  it("excludes clips with a single excluded tag", () => {
    const filtered = filterClips(clips, {
      ...baseFilters,
      excludedTags: ["죽음"],
    });
    expect(filtered).toHaveLength(2);
    expect(filtered.map((c) => c.id)).toEqual(["clip-1", "clip-3"]);
  });

  it("excludes clips matching ANY excluded tag (OR logic)", () => {
    const filtered = filterClips(clips, {
      ...baseFilters,
      excludedTags: ["죽음", "피격"],
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("clip-1");
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
