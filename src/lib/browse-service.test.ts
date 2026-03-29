import { describe, expect, it } from "vitest";
import {
  listBrowseResults,
  parseBrowsePageQuery,
  requiresDetailedBrowseIndex,
} from "./browse-service";
import type { BrowseFilterIndexRecord, BrowseSummaryRecord } from "./types";

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
    category: "acting",
  },
];

const filterIndex: BrowseFilterIndexRecord[] = [
  {
    id: summary[0].id,
    name: summary[0].name,
    category: summary[0].category,
    tags: ["마법"],
    aiStructuredTags: ["폭발"],
    folders: ["folder-1"],
    searchTokens: ["arcane", "burst", "폭발"],
  },
  {
    id: summary[1].id,
    name: summary[1].name,
    category: summary[1].category,
    tags: ["걷기"],
    aiStructuredTags: ["슬픔"],
    folders: ["folder-2"],
    searchTokens: ["heavy", "walk", "슬픔"],
  },
];

describe("browse-service", () => {
  it("parses browse deep-link query params into filter state", () => {
    const filters = parseBrowsePageQuery(
      new URLSearchParams("q=arcane&tag=%EB%A7%88%EB%B2%95&folder=folder-1&sort=name")
    );

    expect(filters).toEqual({
      category: null,
      selectedFolders: ["folder-1"],
      excludedFolders: [],
      selectedTags: ["마법"],
      excludedTags: [],
      searchQuery: "arcane",
      sortBy: "name",
      contentMode: null,
      boardId: null,
    });
  });

  it("returns summary records for a deep-link query page", () => {
    const result = listBrowseResults({
      summary,
      projection: filterIndex,
      filters: {
        category: null,
        selectedFolders: [],
        excludedFolders: [],
        selectedTags: ["폭발"],
        excludedTags: [],
        searchQuery: "",
        sortBy: "newest",
        contentMode: null,
        boardId: null,
      },
      pageSize: 10,
    });

    expect(result.totalCount).toBe(1);
    expect(result.items.map((item) => item.id)).toEqual(["A"]);
    expect(result.nextOffset).toBeNull();
  });

  it("uses only lightweight records for simple filters", () => {
    const result = listBrowseResults({
      summary,
      projection: summary,
      filters: {
        category: "acting",
        selectedFolders: [],
        excludedFolders: [],
        selectedTags: [],
        excludedTags: [],
        searchQuery: "",
        sortBy: "newest",
        contentMode: null,
        boardId: null,
      },
      pageSize: 10,
    });

    expect(result.totalCount).toBe(1);
    expect(result.items.map((item) => item.id)).toEqual(["B"]);
  });

  it("parses excluded folders from browse deep-link query params", () => {
    const filters = parseBrowsePageQuery(
      new URLSearchParams("folder=folder-1&excludeFolder=folder-2")
    );

    expect(filters.excludedFolders).toEqual(["folder-2"]);
  });

  it("flags only tag, folder, and search filters as requiring the detailed index", () => {
    expect(
      requiresDetailedBrowseIndex({
        selectedFolders: [],
        excludedFolders: [],
        selectedTags: [],
        excludedTags: [],
        searchQuery: "",
      })
    ).toBe(false);

    expect(
      requiresDetailedBrowseIndex({
        selectedFolders: [],
        excludedFolders: [],
        selectedTags: ["마법"],
        excludedTags: [],
        searchQuery: "",
      })
    ).toBe(true);
  });

  it("still requires detailed browse index for tag and folder filters on the server path", () => {
    expect(
      requiresDetailedBrowseIndex(
        {
          selectedFolders: ["folder-1"],
          excludedFolders: [],
          selectedTags: [],
          excludedTags: [],
          searchQuery: "",
        },
        { includeSearchQuery: false }
      )
    ).toBe(true);

    expect(
      requiresDetailedBrowseIndex(
        {
          selectedFolders: [],
          excludedFolders: [],
          selectedTags: [],
          excludedTags: ["마법"],
          searchQuery: "",
        },
        { includeSearchQuery: false }
      )
    ).toBe(true);
  });

  it("does not require detailed browse index for search-only queries on the server path", () => {
    expect(
      requiresDetailedBrowseIndex(
        {
          selectedFolders: [],
          excludedFolders: [],
          selectedTags: [],
          excludedTags: [],
          searchQuery: "alpha",
        },
        { includeSearchQuery: false }
      )
    ).toBe(false);

    expect(
      requiresDetailedBrowseIndex({
        selectedFolders: [],
        excludedFolders: [],
        selectedTags: [],
        excludedTags: [],
        searchQuery: "alpha",
      })
    ).toBe(true);
  });
});
