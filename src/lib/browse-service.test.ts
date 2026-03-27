import { describe, expect, it } from "vitest";
import { listBrowseResults, parseBrowsePageQuery } from "./browse-service";
import type { BrowseProjectionRecord, BrowseSummaryRecord } from "./types";

const summary: BrowseSummaryRecord[] = [
  {
    id: "A",
    name: "Arcane Burst",
    thumbnailUrl: "/thumbnails/A.webp",
    previewUrl: "/previews/A.mp4",
    lqipBase64: "",
    width: 640,
    height: 360,
    duration: 1,
    star: 4,
    category: "direction-video",
  },
  {
    id: "B",
    name: "Heavy Walk",
    thumbnailUrl: "/thumbnails/B.webp",
    previewUrl: "/previews/B.mp4",
    lqipBase64: "",
    width: 640,
    height: 360,
    duration: 1,
    star: 2,
    category: "acting",
  },
];

const projection: BrowseProjectionRecord[] = [
  {
    ...summary[0],
    tags: ["마법"],
    aiStructuredTags: ["폭발"],
    folders: ["folder-1"],
    searchTokens: ["arcane", "burst", "폭발"],
  },
  {
    ...summary[1],
    tags: ["걷기"],
    aiStructuredTags: ["슬픔"],
    folders: ["folder-2"],
    searchTokens: ["heavy", "walk", "슬픔"],
  },
];

describe("browse-service", () => {
  it("parses browse deep-link query params into filter state", () => {
    const filters = parseBrowsePageQuery(
      new URLSearchParams("q=arcane&tag=%EB%A7%88%EB%B2%95&folder=folder-1&star=3&sort=name")
    );

    expect(filters).toEqual({
      category: null,
      selectedFolders: ["folder-1"],
      excludedFolders: [],
      selectedTags: ["마법"],
      excludedTags: [],
      starFilter: 3,
      searchQuery: "arcane",
      sortBy: "name",
      contentMode: null,
    });
  });

  it("returns summary records for a deep-link query page", () => {
    const result = listBrowseResults({
      summary,
      projection,
      filters: {
        category: null,
        selectedFolders: [],
        excludedFolders: [],
        selectedTags: ["폭발"],
        excludedTags: [],
        starFilter: null,
        searchQuery: "",
        sortBy: "newest",
        contentMode: null,
      },
      pageSize: 10,
    });

    expect(result.totalCount).toBe(1);
    expect(result.items.map((item) => item.id)).toEqual(["A"]);
    expect(result.nextOffset).toBeNull();
  });

  it("parses excluded folders from browse deep-link query params", () => {
    const filters = parseBrowsePageQuery(
      new URLSearchParams("folder=folder-1&excludeFolder=folder-2")
    );

    expect(filters.excludedFolders).toEqual(["folder-2"]);
  });
});
