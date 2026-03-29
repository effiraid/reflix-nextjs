import { describe, expect, it, vi } from "vitest";
import { loadBrowsePageData } from "./browseBootstrap";

describe("loadBrowsePageData", () => {
  it("derives initial folder clip ids without hydrating the detailed index when no detailed index is needed", async () => {
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
    ]);

    const result = await loadBrowsePageData(
      {
        lang: "ko",
        shouldLoadDetailedIndex: false,
        viewerTier: "pro",
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
    expect(loadBrowseFilterIndex).toHaveBeenCalledTimes(1);
    expect(result.browseCards).toHaveLength(1);
    expect(result.browseFilterIndex).toBeNull();
    expect(result.initialFolderClipIds).toEqual({
      "folder-a": ["clip-a"],
    });
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
        viewerTier: "pro",
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

  it("keeps guest search payloads fully hydrated when detailed data is needed", async () => {
    const result = await loadBrowsePageData(
      {
        lang: "ko",
        shouldLoadDetailedIndex: true,
        viewerTier: "guest",
      },
      {
        getDictionary: vi.fn(async () => ({ nav: { browse: "둘러보기" } })),
        getCategories: vi.fn(async () => ({})),
        getTagGroups: vi.fn(async () => ({ groups: [], parentGroups: [] })),
        getTagI18n: vi.fn(async () => ({})),
        loadBrowseCards: vi.fn(async () =>
          Array.from({ length: 6 }, (_, index) => ({
            id: `clip-${index + 1}`,
            name: `Clip ${index + 1}`,
            thumbnailUrl: `/${index + 1}.webp`,
            previewUrl: `/${index + 1}.mp4`,
            lqipBase64: "",
            width: 100,
            height: 100,
            duration: 1,
            category: "action",
          }))
        ),
        loadBrowseSummary: vi.fn(async () => []),
        loadBrowseFilterIndex: vi.fn(async () =>
          Array.from({ length: 6 }, (_, index) => ({
            id: `clip-${index + 1}`,
            name: `Clip ${index + 1}`,
            category: "action",
            tags: [`tag-${index + 1}`],
            aiStructuredTags: [],
            folders: [`folder-${index + 1}`],
            searchTokens: [`clip-${index + 1}`],
          }))
        ),
      }
    );

    expect(result.browseCards).toHaveLength(6);
    expect(result.browseCards.map((clip) => clip.id)).toEqual([
      "clip-1",
      "clip-2",
      "clip-3",
      "clip-4",
      "clip-5",
      "clip-6",
    ]);
    expect(result.browseFilterIndex).toHaveLength(6);
    expect(result.initialFolderClipIds).toEqual({
      "folder-1": ["clip-1"],
      "folder-2": ["clip-2"],
      "folder-3": ["clip-3"],
      "folder-4": ["clip-4"],
      "folder-5": ["clip-5"],
      "folder-6": ["clip-6"],
    });
  });

  it("keeps the initial guest browse payload fully visible so the client can lock every card", async () => {
    const result = await loadBrowsePageData(
      {
        lang: "ko",
        shouldLoadDetailedIndex: false,
        viewerTier: "guest",
      },
      {
        getDictionary: vi.fn(async () => ({ nav: { browse: "둘러보기" } })),
        getCategories: vi.fn(async () => ({})),
        getTagGroups: vi.fn(async () => ({ groups: [], parentGroups: [] })),
        getTagI18n: vi.fn(async () => ({})),
        loadBrowseCards: vi.fn(async () =>
          Array.from({ length: 6 }, (_, index) => ({
            id: `clip-${index + 1}`,
            name: `Clip ${index + 1}`,
            thumbnailUrl: `/${index + 1}.webp`,
            previewUrl: `/${index + 1}.mp4`,
            lqipBase64: "",
            width: 100,
            height: 100,
            duration: 1,
            category: "action",
          }))
        ),
        loadBrowseSummary: vi.fn(async () => []),
        loadBrowseFilterIndex: vi.fn(async () => []),
      }
    );

    expect(result.browseCards).toHaveLength(6);
    expect(result.browseCards.map((clip) => clip.id)).toEqual([
      "clip-1",
      "clip-2",
      "clip-3",
      "clip-4",
      "clip-5",
      "clip-6",
    ]);
  });

  it("keeps the initial free browse payload fully visible so the client can unlock only the first five", async () => {
    const result = await loadBrowsePageData(
      {
        lang: "ko",
        shouldLoadDetailedIndex: false,
        viewerTier: "free",
      },
      {
        getDictionary: vi.fn(async () => ({ nav: { browse: "둘러보기" } })),
        getCategories: vi.fn(async () => ({})),
        getTagGroups: vi.fn(async () => ({ groups: [], parentGroups: [] })),
        getTagI18n: vi.fn(async () => ({})),
        loadBrowseCards: vi.fn(async () =>
          Array.from({ length: 6 }, (_, index) => ({
            id: `clip-${index + 1}`,
            name: `Clip ${index + 1}`,
            thumbnailUrl: `/${index + 1}.webp`,
            previewUrl: `/${index + 1}.mp4`,
            lqipBase64: "",
            width: 100,
            height: 100,
            duration: 1,
            category: "action",
          }))
        ),
        loadBrowseSummary: vi.fn(async () => []),
        loadBrowseFilterIndex: vi.fn(async () => []),
      }
    );

    expect(result.browseCards).toHaveLength(6);
    expect(result.browseCards.map((clip) => clip.id)).toEqual([
      "clip-1",
      "clip-2",
      "clip-3",
      "clip-4",
      "clip-5",
      "clip-6",
    ]);
  });
});
