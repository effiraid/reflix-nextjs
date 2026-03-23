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
];

describe("filterClips", () => {
  it("matches translated tag labels when tag i18n data is provided", () => {
    const filtered = filterClips(
      clips,
      {
        category: null,
        selectedFolders: [],
        selectedTags: [],
        starFilter: null,
        searchQuery: "magic",
        sortBy: "newest",
      },
      undefined,
      { 마법: "Magic" }
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("clip-1");
  });
});
