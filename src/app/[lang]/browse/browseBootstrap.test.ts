import { describe, expect, it, vi } from "vitest";
import { loadBrowsePageData } from "./browseBootstrap";

describe("loadBrowsePageData", () => {
  it("loads cards but skips summary and filter-index when no detailed index is needed", async () => {
    const getDictionary = vi.fn(async () => ({ nav: { browse: "둘러보기" } }));
    const getCategories = vi.fn(async () => ({}));
    const getTagGroups = vi.fn(async () => ({ groups: [], parentGroups: [] }));
    const getTagI18n = vi.fn(async () => ({}));
    const loadBrowseCards = vi.fn(async () => [
      {
        id: "clip-a",
        name: "Alpha",
        thumbnailUrl: "/a.webp",
        previewUrl: "/a.mp4",
        lqipBase64: "",
        width: 100,
        height: 100,
        duration: 1,
        category: "action",
      },
    ]);
    const loadBrowseSummary = vi.fn(async () => []);
    const loadBrowseFilterIndex = vi.fn(async () => []);

    const result = await loadBrowsePageData(
      {
        lang: "ko",
        shouldLoadDetailedIndex: false,
      },
      {
        getDictionary,
        getCategories,
        getTagGroups,
        getTagI18n,
        loadBrowseCards,
        loadBrowseSummary,
        loadBrowseFilterIndex,
      }
    );

    expect(loadBrowseCards).toHaveBeenCalledTimes(1);
    expect(loadBrowseSummary).not.toHaveBeenCalled();
    expect(loadBrowseFilterIndex).not.toHaveBeenCalled();
    expect(result.browseCards).toHaveLength(1);
    expect(result.browseFilterIndex).toBeNull();
    expect(result.initialFolderClipIds).toEqual({});
  });

  it("loads filter-index once and derives initial folder clip ids when detailed data is needed", async () => {
    const loadBrowseFilterIndex = vi.fn(async () => [
      {
        id: "clip-a",
        name: "Alpha",
        category: "action",
        tags: ["magic"],
        aiStructuredTags: [],
        folders: ["folder-a"],
        searchTokens: ["alpha"],
      },
      {
        id: "clip-b",
        name: "Beta",
        category: "acting",
        tags: ["walk"],
        aiStructuredTags: [],
        folders: ["folder-a", "folder-b"],
        searchTokens: ["beta"],
      },
    ]);

    const result = await loadBrowsePageData(
      {
        lang: "ko",
        shouldLoadDetailedIndex: true,
      },
      {
        getDictionary: vi.fn(async () => ({ nav: { browse: "둘러보기" } })),
        getCategories: vi.fn(async () => ({})),
        getTagGroups: vi.fn(async () => ({ groups: [], parentGroups: [] })),
        getTagI18n: vi.fn(async () => ({})),
        loadBrowseCards: vi.fn(async () => []),
        loadBrowseSummary: vi.fn(async () => []),
        loadBrowseFilterIndex,
      }
    );

    expect(loadBrowseFilterIndex).toHaveBeenCalledTimes(1);
    expect(result.initialFolderClipIds).toEqual({
      "folder-a": ["clip-a", "clip-b"],
      "folder-b": ["clip-b"],
    });
  });
});
