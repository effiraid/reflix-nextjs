import * as React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowseClient } from "./BrowseClient";
import { searchBrowseClipIds } from "@/lib/browsePagefind";
import { useAuthStore } from "@/stores/authStore";
import { useBoardStore } from "@/stores/boardStore";
import { useClipStore } from "@/stores/clipStore";
import { useFilterStore } from "@/stores/filterStore";
import { useUIStore } from "@/stores/uiStore";
import {
  resetViewHistoryStoreForTests,
  useViewHistoryStore,
} from "@/stores/viewHistoryStore";
import koDict from "@/app/[lang]/dictionaries/ko.json";
import type {
  BrowseCardRecord,
  BrowseProjectionRecord,
  BrowseSummaryRecord,
  CategoryTree,
  ClipIndex,
} from "@/lib/types";
import type { Dictionary } from "../dictionaries";

const {
  fetchViewHistoryMock,
  recordViewHistoryBatchMock,
  deleteViewHistoryEntryMock,
  clearViewHistoryMock,
} = vi.hoisted(() => ({
  fetchViewHistoryMock: vi.fn(),
  recordViewHistoryBatchMock: vi.fn(),
  deleteViewHistoryEntryMock: vi.fn(),
  clearViewHistoryMock: vi.fn(),
}));

vi.mock("@/hooks/useFilterSync", () => ({
  useFilterSync: () => ({
    updateURL: vi.fn(),
  }),
}));

let browseDataState: {
  initialClips: BrowseSummaryRecord[];
  allCards: BrowseCardRecord[] | null;
  cardsStatus: "loading" | "ready" | "error";
  projectionClips: BrowseProjectionRecord[] | null;
  projectionStatus: "loading" | "ready" | "error";
  initialTotalCount: number;
  totalClipCount: number;
  allTags: string[];
  popularTags: string[];
  tagCounts: Record<string, number>;
  requestCardIndex: ReturnType<typeof vi.fn>;
  requestDetailedIndex: ReturnType<typeof vi.fn>;
};

vi.mock("./ClipDataProvider", () => ({
  useBrowseData: () => browseDataState,
  useClipData: () => browseDataState.projectionClips ?? browseDataState.initialClips,
}));

vi.mock("@/lib/browsePagefind", () => ({
  prewarmBrowseSearch: vi.fn(),
  searchBrowseClipIds: vi.fn(async () => []),
}));

vi.mock("@/lib/viewHistoryClient", () => ({
  fetchViewHistoryEntries: fetchViewHistoryMock,
  recordViewHistoryBatch: recordViewHistoryBatchMock,
  deleteViewHistoryEntry: deleteViewHistoryEntryMock,
  clearViewHistory: clearViewHistoryMock,
}));

vi.mock("@/components/clip/MasonryGrid", () => ({
  MasonryGrid: ({
    clips,
    lockedClipIds,
    onOpenQuickView,
  }: {
    clips: ClipIndex[];
    lockedClipIds?: Set<string>;
    onOpenQuickView?: (clipId: string) => void;
  }) => (
    <div>
      <div data-testid="clip-order">{clips.map((clip) => clip.id).join(",")}</div>
      <div data-testid="locked-order">
        {clips
          .filter((clip) => lockedClipIds?.has(clip.id))
          .map((clip) => clip.id)
          .join(",")}
      </div>
      <div data-testid="clip-tags">
        {clips
          .map((clip) => `${clip.id}:${(clip.tags ?? []).join("|")}`)
          .join(",")}
      </div>
      {clips.map((clip) => (
        <button
          key={clip.id}
          type="button"
          disabled={lockedClipIds?.has(clip.id)}
          onClick={() => onOpenQuickView?.(clip.id)}
        >
          Open {clip.id}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/clip/ClipCard", () => ({
  ClipCard: ({
    clip,
    locked = false,
  }: {
    clip: ClipIndex;
    locked?: boolean;
  }) => (
    <div
      data-testid="feed-clip-card"
      data-clip-id={clip.id}
      data-locked={String(locked)}
    >
      {clip.id}
    </div>
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/dynamic", () => {
  type DynamicComponent = React.ComponentType<Record<string, unknown>>;

  function resolveDynamicComponent(moduleValue: unknown): DynamicComponent {
    if (typeof moduleValue === "function") {
      return moduleValue as DynamicComponent;
    }

    if (
      moduleValue &&
      typeof moduleValue === "object" &&
      "default" in moduleValue &&
      typeof moduleValue.default === "function"
    ) {
      return moduleValue.default as DynamicComponent;
    }

    return () => null;
  }

  return {
    __esModule: true,
    default: (fn: () => Promise<unknown>) => {
      let resolvedComp: DynamicComponent | null = null;
      fn().then((mod) => {
        resolvedComp = resolveDynamicComponent(mod);
      });
      return function DynamicMock(props: Record<string, unknown>) {
        // Use arrow function to avoid React calling the component as a state initializer
        const [Comp, setComp] = React.useState<DynamicComponent | null>(
          () => resolvedComp
        );
        React.useEffect(() => {
          if (!Comp && resolvedComp) {
            setComp(() => resolvedComp);
          } else if (!resolvedComp) {
            fn().then((mod) => {
              resolvedComp = resolveDynamicComponent(mod);
              setComp(() => resolvedComp);
            });
          }
        }, [Comp]);
        return Comp ? React.createElement(Comp, props) : null;
      };
    },
  };
});

vi.mock("@/components/clip/ClipRatingPanel", () => ({
  ClipRatingPanel: () => null,
}));

vi.mock("@/hooks/useClipDetail", () => ({
  useClipDetail: () => ({ detail: null, isLoading: false }),
}));

vi.mock("@/components/clip/VideoPlayer", () => ({
  VideoPlayer: ({ videoUrl }: { videoUrl: string }) => (
    <div data-testid="video-player" data-video-url={videoUrl} />
  ),
}));

vi.mock("@/components/splash/BrandSplash", () => ({
  BrandSplash: ({ onComplete }: { onComplete?: () => void }) => (
    <button
      type="button"
      data-testid="brand-splash"
      onClick={onComplete}
    >
      Splash
    </button>
  ),
}));

const clips: ClipIndex[] = [
  {
    id: "clip-a",
    name: "Alpha",
    tags: [],
    folders: [],
    category: "action",
    width: 100,
    height: 100,
    duration: 1,
    previewUrl: "/a.mp4",
    thumbnailUrl: "/a.jpg",
    lqipBase64: "",
  },
  {
    id: "clip-b",
    name: "Beta",
    tags: [],
    folders: [],
    category: "action",
    width: 100,
    height: 100,
    duration: 1,
    previewUrl: "/b.mp4",
    thumbnailUrl: "/b.jpg",
    lqipBase64: "",
  },
  {
    id: "clip-c",
    name: "Gamma",
    tags: [],
    folders: [],
    category: "action",
    width: 100,
    height: 100,
    duration: 1,
    previewUrl: "/c.mp4",
    thumbnailUrl: "/c.jpg",
    lqipBase64: "",
  },
];

const initialSummaryClips: BrowseSummaryRecord[] = clips.slice(0, 1).map((clip) => ({
  id: clip.id,
  name: clip.name,
  thumbnailUrl: clip.thumbnailUrl,
  previewUrl: clip.previewUrl,
  lqipBase64: clip.lqipBase64,
  width: clip.width,
  height: clip.height,
  duration: clip.duration,
  category: clip.category,
}));

const feedCategories: CategoryTree = {
  actionRoot: {
    slug: "action",
    i18n: { ko: "액션", en: "Action" },
  },
  dramaRoot: {
    slug: "drama",
    i18n: { ko: "드라마", en: "Drama" },
  },
};

function makeFullBrowseState(overrides?: Partial<typeof browseDataState>) {
  return {
    initialClips: clips,
    allCards: clips,
    cardsStatus: "ready" as const,
    projectionClips: clips.map((clip) => ({
      ...clip,
      aiStructuredTags: [] as string[],
      searchTokens: [clip.name.toLowerCase()],
    })),
    projectionStatus: "ready" as const,
    initialTotalCount: clips.length,
    totalClipCount: clips.length,
    allTags: [],
    popularTags: [],
    tagCounts: {},
    requestCardIndex: vi.fn(),
    requestDetailedIndex: vi.fn(),
    ...overrides,
  };
}

const dict = {
  ...koDict,
} satisfies Dictionary;

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

async function defaultSearchBrowseClipIds(_lang: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const source =
    browseDataState.projectionClips ??
    browseDataState.allCards ??
    browseDataState.initialClips;

  return source
    .filter((clip) => {
      const searchTokens = "searchTokens" in clip ? (clip.searchTokens ?? []) : [];
      return (
        clip.name.toLowerCase().includes(normalizedQuery) ||
        searchTokens.some((token) => token.toLowerCase().includes(normalizedQuery))
      );
    })
    .map((clip) => clip.id);
}

describe("BrowseClient", () => {
  beforeEach(() => {
    resetViewHistoryStoreForTests();
    fetchViewHistoryMock.mockReset();
    fetchViewHistoryMock.mockResolvedValue([]);
    recordViewHistoryBatchMock.mockReset();
    recordViewHistoryBatchMock.mockResolvedValue(undefined);
    deleteViewHistoryEntryMock.mockReset();
    deleteViewHistoryEntryMock.mockResolvedValue(undefined);
    clearViewHistoryMock.mockReset();
    clearViewHistoryMock.mockResolvedValue(undefined);
    localStorage.clear();
    browseDataState = {
      initialClips: initialSummaryClips,
      allCards: clips,
      cardsStatus: "ready",
      projectionClips: clips.map((clip) => ({
        ...clip,
        aiStructuredTags: [],
        searchTokens: [clip.name.toLowerCase()],
      })),
      projectionStatus: "ready",
      initialTotalCount: clips.length,
      totalClipCount: clips.length,
      allTags: [],
      popularTags: [],
      tagCounts: {},
      requestCardIndex: vi.fn(),
      requestDetailedIndex: vi.fn(),
    };
    vi.mocked(searchBrowseClipIds).mockReset();
    vi.mocked(searchBrowseClipIds).mockImplementation(defaultSearchBrowseClipIds);
    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "",
      sortBy: "newest",

      contentMode: null,
      boardId: null,
    });
    useBoardStore.setState({
      boards: [],
      isLoading: false,
      activeBoardId: null,
      activeBoardClipIds: null,
    });
    useClipStore.setState({
      selectedClipId: null,
    });
    useUIStore.setState({
      browseMode: "grid",
      shuffleSeed: 0,
      quickViewOpen: false,
      viewMode: "masonry",
      pricingModalOpen: false,
      pricingModalIntent: null,
    });
    useAuthStore.setState({
      user: null,
      tier: "free",
      isLoading: false,
    });
  });

  it("reshuffles the filtered clips when the shuffle seed changes", () => {
    browseDataState = makeFullBrowseState();
    const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => 0);

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-a,clip-b,clip-c");

    act(() => {
      useUIStore.getState().reshuffleClips();
    });

    expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-b,clip-c,clip-a");

    randomSpy.mockRestore();
  });

  it("shows the intro splash when the visitor has not opened browse before", async () => {
    localStorage.removeItem("reflix-visited");
    useUIStore.setState({
      viewMode: "feed",
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    expect(await screen.findByTestId("brand-splash")).toBeInTheDocument();
  });

  it("opens quick view on Space and closes it on Escape", async () => {
    browseDataState = makeFullBrowseState();
    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" } as never,
      tier: "free",
      isLoading: false,
    });
    useClipStore.setState({
      selectedClipId: "clip-a",
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });
    expect(await screen.findByRole("dialog", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByTestId("video-player")).toHaveAttribute(
      "data-video-url",
      "/videos/clip-a.mp4"
    );

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Alpha" })).not.toBeInTheDocument();
    });
  });

  it("opens quick view for the requested clip id from the grid", async () => {
    browseDataState = makeFullBrowseState();
    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" } as never,
      tier: "free",
      isLoading: false,
    });
    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open clip-b" }));
    });

    expect(await screen.findByRole("dialog", { name: "Beta" })).toBeInTheDocument();
    expect(useClipStore.getState().selectedClipId).toBe("clip-b");
  });

  it("shows a live result count while a search query is active", async () => {
    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "Alpha",
      sortBy: "newest",

    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/1개 클립/)).toHaveAttribute("aria-live", "polite");
    });
  });

  it("shows all free search results but locks everything after the first five", async () => {
    const manyClips = Array.from({ length: 7 }, (_, index) => ({
      id: `clip-${index + 1}`,
      name: `Match ${index + 1}`,
      tags: [],
      folders: [],
      category: "action",
      width: 100,
      height: 100,
      duration: 1,
      previewUrl: `/${index + 1}.mp4`,
      thumbnailUrl: `/${index + 1}.jpg`,
      lqipBase64: "",
    }));

    browseDataState = {
      initialClips: manyClips,
      projectionClips: manyClips.map((clip) => ({
        ...clip,
        aiStructuredTags: [],
        searchTokens: ["match"],
      })),
      projectionStatus: "ready",
      initialTotalCount: manyClips.length,
    };

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "match",
      sortBy: "newest",

      contentMode: null,
    });

    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" } as never,
      tier: "free",
      isLoading: false,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("clip-order")).toHaveTextContent(
        "clip-1,clip-2,clip-3,clip-4,clip-5,clip-6,clip-7"
      );
    });
    expect(screen.getByTestId("locked-order")).toHaveTextContent("clip-6,clip-7");
    expect(screen.getByRole("button", { name: "Open clip-5" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Open clip-6" })).toBeDisabled();
    const statusBar = screen.getByRole("paragraph");
    expect(statusBar).toHaveAttribute("aria-live", "polite");
    expect(statusBar).toHaveTextContent(/7개 클립/);
    expect(statusBar).toHaveTextContent(/2개 결과는 Pro 전용/);
    expect(screen.getByRole("button", { name: "Pro로 잠금 해제" })).toBeInTheDocument();
  });

  it("shows all guest search matches but locks every thumbnail behind login", async () => {
    const manyClips = Array.from({ length: 7 }, (_, index) => ({
      id: `clip-${index + 1}`,
      name: `Match ${index + 1}`,
      tags: [],
      folders: [],
      category: "action",
      width: 100,
      height: 100,
      duration: 1,
      previewUrl: `/${index + 1}.mp4`,
      thumbnailUrl: `/${index + 1}.jpg`,
      lqipBase64: "",
    }));

    browseDataState = {
      initialClips: manyClips,
      projectionClips: manyClips.map((clip) => ({
        ...clip,
        aiStructuredTags: [],
        searchTokens: ["match"],
      })),
      projectionStatus: "ready",
      initialTotalCount: manyClips.length,
    };

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "match",
      sortBy: "newest",
      contentMode: null,
      boardId: null,
    });

    useAuthStore.setState({
      user: null,
      tier: "free",
      isLoading: false,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("clip-order")).toHaveTextContent(
        "clip-1,clip-2,clip-3,clip-4,clip-5,clip-6,clip-7"
      );
    });
    expect(screen.getByTestId("locked-order")).toHaveTextContent(
      "clip-1,clip-2,clip-3,clip-4,clip-5,clip-6,clip-7"
    );
    expect(screen.getByText(/로그인하면 결과를 열 수 있어요/)).toHaveAttribute(
      "aria-live",
      "polite"
    );
    expect(
      screen.queryByRole("button", { name: "Pro로 잠금 해제" })
    ).not.toBeInTheDocument();
  });

  it("shows the full guest browse grid on first load but keeps every card locked", () => {
    const manyClips = Array.from({ length: 7 }, (_, index) => ({
      id: `clip-${index + 1}`,
      name: `Match ${index + 1}`,
      tags: [],
      folders: [],
      category: "action",
      width: 100,
      height: 100,
      duration: 1,
      previewUrl: `/${index + 1}.mp4`,
      thumbnailUrl: `/${index + 1}.jpg`,
      lqipBase64: "",
    }));

    browseDataState = makeFullBrowseState({
      initialClips: manyClips,
      allCards: manyClips,
      projectionClips: manyClips.map((clip) => ({
        ...clip,
        aiStructuredTags: [],
        searchTokens: [clip.name.toLowerCase()],
      })),
      initialTotalCount: manyClips.length,
      totalClipCount: manyClips.length,
    });

    useAuthStore.setState({
      user: null,
      tier: "free",
      isLoading: false,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    expect(screen.getByTestId("clip-order")).toHaveTextContent(
      "clip-1,clip-2,clip-3,clip-4,clip-5,clip-6,clip-7"
    );
    expect(screen.getByTestId("locked-order")).toHaveTextContent(
      "clip-1,clip-2,clip-3,clip-4,clip-5,clip-6,clip-7"
    );
    expect(screen.getByText(/로그인하면 결과를 열 수 있어요/)).toHaveAttribute(
      "aria-live",
      "polite"
    );
  });

  it("keeps guest feed cards locked when the full browse payload is visible", () => {
    const feedClips = [
      {
        ...clips[0],
        category: "action",
      },
      {
        ...clips[1],
        category: "action",
      },
      {
        ...clips[2],
        id: "clip-d",
        name: "Delta",
        previewUrl: "/d.mp4",
        thumbnailUrl: "/d.jpg",
        category: "drama",
      },
      {
        ...clips[2],
        id: "clip-e",
        name: "Epsilon",
        previewUrl: "/e.mp4",
        thumbnailUrl: "/e.jpg",
        category: "drama",
      },
      {
        ...clips[2],
        id: "clip-f",
        name: "Zeta",
        previewUrl: "/f.mp4",
        thumbnailUrl: "/f.jpg",
        category: "drama",
      },
    ];

    browseDataState = makeFullBrowseState({
      initialClips: feedClips,
      allCards: feedClips,
      projectionClips: feedClips.map((clip) => ({
        ...clip,
        aiStructuredTags: [],
        searchTokens: [clip.name.toLowerCase()],
      })),
      initialTotalCount: feedClips.length,
      totalClipCount: feedClips.length,
    });
    useUIStore.setState({
      viewMode: "feed",
    });
    useAuthStore.setState({
      user: null,
      tier: "free",
      isLoading: false,
    });

    render(
      <BrowseClient
        categories={feedCategories}
        lang="ko"
        dict={dict}
      />
    );

    expect(
      screen.getAllByTestId("feed-clip-card").map((card) => card.dataset.locked)
    ).toEqual(["true", "true", "true", "true", "true"]);
  });

  it("locks feed cards after the first five for free users", () => {
    const feedClips = [
      {
        ...clips[0],
        category: "action",
      },
      {
        ...clips[1],
        category: "action",
      },
      {
        ...clips[2],
        id: "clip-d",
        name: "Delta",
        previewUrl: "/d.mp4",
        thumbnailUrl: "/d.jpg",
        category: "drama",
      },
      {
        ...clips[2],
        id: "clip-e",
        name: "Epsilon",
        previewUrl: "/e.mp4",
        thumbnailUrl: "/e.jpg",
        category: "drama",
      },
      {
        ...clips[2],
        id: "clip-f",
        name: "Zeta",
        previewUrl: "/f.mp4",
        thumbnailUrl: "/f.jpg",
        category: "drama",
      },
      {
        ...clips[2],
        id: "clip-g",
        name: "Eta",
        previewUrl: "/g.mp4",
        thumbnailUrl: "/g.jpg",
        category: "drama",
      },
    ];

    browseDataState = makeFullBrowseState({
      initialClips: feedClips,
      allCards: feedClips,
      projectionClips: feedClips.map((clip) => ({
        ...clip,
        aiStructuredTags: [],
        searchTokens: [clip.name.toLowerCase()],
      })),
      initialTotalCount: feedClips.length,
      totalClipCount: feedClips.length,
    });
    useUIStore.setState({
      viewMode: "feed",
    });
    useAuthStore.setState({
      user: { id: "user-1" } as never,
      tier: "free",
      isLoading: false,
    });

    render(
      <BrowseClient
        categories={feedCategories}
        lang="ko"
        dict={dict}
      />
    );

    expect(
      screen.getAllByTestId("feed-clip-card").map((card) => [
        card.dataset.clipId,
        card.dataset.locked,
      ])
    ).toEqual([
      ["clip-a", "false"],
      ["clip-b", "false"],
      ["clip-d", "false"],
      ["clip-e", "false"],
      ["clip-f", "false"],
      ["clip-g", "true"],
    ]);
  });

  it("locks free direction-tab results after the first five even without search text", () => {
    const manyClips = Array.from({ length: 7 }, (_, index) => ({
      id: `clip-${index + 1}`,
      name: `연출 Match ${index + 1}`,
      tags: [],
      folders: [],
      category: "action",
      width: 100,
      height: 100,
      duration: 1,
      previewUrl: `/${index + 1}.mp4`,
      thumbnailUrl: `/${index + 1}.jpg`,
      lqipBase64: "",
    }));

    browseDataState = makeFullBrowseState({
      initialClips: manyClips,
      allCards: manyClips,
      projectionClips: manyClips.map((clip) => ({
        ...clip,
        aiStructuredTags: [],
        searchTokens: [clip.name.toLowerCase()],
      })),
      initialTotalCount: manyClips.length,
      totalClipCount: manyClips.length,
    });

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "",
      sortBy: "newest",
      contentMode: "direction",
      boardId: null,
    });

    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" } as never,
      tier: "free",
      isLoading: false,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    expect(screen.getByTestId("clip-order")).toHaveTextContent(
      "clip-1,clip-2,clip-3,clip-4,clip-5,clip-6,clip-7"
    );
    expect(screen.getByTestId("locked-order")).toHaveTextContent("clip-6,clip-7");
  });

  it("locks board-only direction results after the first five for free users", () => {
    const manyClips = Array.from({ length: 7 }, (_, index) => ({
      id: `clip-${index + 1}`,
      name: `연출 Match ${index + 1}`,
      tags: [],
      folders: [],
      category: "action",
      width: 100,
      height: 100,
      duration: 1,
      previewUrl: `/${index + 1}.mp4`,
      thumbnailUrl: `/${index + 1}.jpg`,
      lqipBase64: "",
    }));

    browseDataState = {
      initialClips: manyClips,
      projectionClips: manyClips.map((clip) => ({
        ...clip,
        aiStructuredTags: [],
        searchTokens: ["match"],
      })),
      projectionStatus: "ready",
      initialTotalCount: manyClips.length,
    };

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "",
      sortBy: "newest",
      contentMode: "direction",
      boardId: "board-1",
    });

    useBoardStore.setState({
      activeBoardId: "board-1",
      activeBoardClipIds: new Set(manyClips.map((clip) => clip.id)),
    });

    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" } as never,
      tier: "free",
      isLoading: false,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    expect(screen.getByTestId("clip-order")).toHaveTextContent(
      "clip-1,clip-2,clip-3,clip-4,clip-5,clip-6,clip-7"
    );
    expect(screen.getByTestId("locked-order")).toHaveTextContent("clip-6,clip-7");
  });

  it("re-opens the requested clip after login when the free tier can now access it", async () => {
    const manyClips = Array.from({ length: 7 }, (_, index) => ({
      id: `clip-${index + 1}`,
      name: `Match ${index + 1}`,
      tags: [],
      folders: [],
      category: "action",
      width: 100,
      height: 100,
      duration: 1,
      previewUrl: `/${index + 1}.mp4`,
      thumbnailUrl: `/${index + 1}.jpg`,
      lqipBase64: "",
    }));

    browseDataState = {
      initialClips: manyClips,
      projectionClips: manyClips.map((clip) => ({
        ...clip,
        aiStructuredTags: [],
        searchTokens: ["match"],
      })),
      projectionStatus: "ready",
      initialTotalCount: manyClips.length,
    };

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "match",
      sortBy: "newest",

      contentMode: null,
    });

    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" } as never,
      tier: "free",
      isLoading: false,
    });

    window.history.replaceState(
      null,
      "",
      "/ko/browse?q=match&resumeClip=clip-4&resumeOpen=1"
    );

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    expect(await screen.findByRole("dialog", { name: "Match 4" })).toBeInTheDocument();
    expect(useClipStore.getState().selectedClipId).toBe("clip-4");
    expect(window.location.search).toBe("?q=match");
  });

  it("re-opens the pricing modal after login when the resumed clip is still locked for free", async () => {
    const manyClips = Array.from({ length: 7 }, (_, index) => ({
      id: `clip-${index + 1}`,
      name: `Match ${index + 1}`,
      tags: [],
      folders: [],
      category: "action",
      width: 100,
      height: 100,
      duration: 1,
      previewUrl: `/${index + 1}.mp4`,
      thumbnailUrl: `/${index + 1}.jpg`,
      lqipBase64: "",
    }));

    browseDataState = {
      initialClips: manyClips,
      projectionClips: manyClips.map((clip) => ({
        ...clip,
        aiStructuredTags: [],
        searchTokens: ["match"],
      })),
      projectionStatus: "ready",
      initialTotalCount: manyClips.length,
    };

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "match",
      sortBy: "newest",

      contentMode: null,
    });

    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" } as never,
      tier: "free",
      isLoading: false,
    });

    window.history.replaceState(
      null,
      "",
      "/ko/browse?q=match&resumeClip=clip-6&resumeOpen=1"
    );

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(useUIStore.getState().pricingModalOpen).toBe(true);
    });
    expect(useUIStore.getState().pricingModalIntent).toMatchObject({
      kind: "locked-clip",
      viewerTier: "free",
      clipId: "clip-6",
    });
    expect(useClipStore.getState().selectedClipId).toBe("clip-6");
    expect(window.location.search).toBe("?q=match");
  });

  it("blocks free users from combining multiple filter axes", () => {
    const comboClips = [
      {
        id: "clip-a",
        name: "Mage Low",
        tags: ["마법"],
        folders: [],
        category: "action",
        width: 100,
        height: 100,
        duration: 1,
        previewUrl: "/a.mp4",
        thumbnailUrl: "/a.jpg",
        lqipBase64: "",
      },
      {
        id: "clip-b",
        name: "Mage High",
        tags: ["마법"],
        folders: [],
        category: "action",
        width: 100,
        height: 100,
        duration: 1,
        previewUrl: "/b.mp4",
        thumbnailUrl: "/b.jpg",
        lqipBase64: "",
      },
      {
        id: "clip-c",
        name: "Other High",
        tags: ["걷기"],
        folders: [],
        category: "action",
        width: 100,
        height: 100,
        duration: 1,
        previewUrl: "/c.mp4",
        thumbnailUrl: "/c.jpg",
        lqipBase64: "",
      },
    ];

    browseDataState = {
      initialClips: comboClips,
      projectionClips: comboClips.map((clip) => ({
        ...clip,
        aiStructuredTags: [],
        searchTokens: [clip.name.toLowerCase()],
      })),
      projectionStatus: "ready",
      initialTotalCount: comboClips.length,
    };

    useFilterStore.setState({
      category: "action",
      selectedFolders: [],
      selectedTags: ["마법"],
      excludedTags: [],
      searchQuery: "",
      sortBy: "newest",
      contentMode: null,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-a,clip-b");
    const statusBar = screen.getByRole("paragraph");
    expect(statusBar).toHaveTextContent(/필터 조합은 Pro 전용입니다/);
  });

  it("treats search text and tag filters as separate axes for free users", async () => {
    const comboClips = [
      {
        id: "clip-a",
        name: "Mage Alpha",
        tags: ["마법"],
        folders: [],
        category: "action",
        width: 100,
        height: 100,
        duration: 1,
        previewUrl: "/a.mp4",
        thumbnailUrl: "/a.jpg",
        lqipBase64: "",
      },
      {
        id: "clip-b",
        name: "Mage Beta",
        tags: ["걷기"],
        folders: [],
        category: "action",
        width: 100,
        height: 100,
        duration: 1,
        previewUrl: "/b.mp4",
        thumbnailUrl: "/b.jpg",
        lqipBase64: "",
      },
      {
        id: "clip-c",
        name: "Other Gamma",
        tags: ["마법"],
        folders: [],
        category: "action",
        width: 100,
        height: 100,
        duration: 1,
        previewUrl: "/c.mp4",
        thumbnailUrl: "/c.jpg",
        lqipBase64: "",
      },
    ];

    browseDataState = {
      initialClips: comboClips,
      projectionClips: comboClips.map((clip) => ({
        ...clip,
        aiStructuredTags: [],
        searchTokens: [clip.name.toLowerCase()],
      })),
      projectionStatus: "ready",
      initialTotalCount: comboClips.length,
    };

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: ["마법"],
      excludedTags: [],
      searchQuery: "Mage",
      sortBy: "newest",
      contentMode: null,
      boardId: null,
    });

    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" } as never,
      tier: "free",
      isLoading: false,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-a,clip-b");
    });
    expect(screen.getByText(/필터 조합은 Pro 전용입니다/)).toHaveAttribute(
      "aria-live",
      "polite"
    );
  });

  it("keeps the initial summary page when projection is ready but no filters are active", () => {
    browseDataState = {
      initialClips: initialSummaryClips,
      projectionClips: clips.map((clip, index) => ({
        ...clip,
        tags: index === 0 ? ["magic"] : [],
        aiStructuredTags: [],
        searchTokens: [clip.name.toLowerCase()],
      })),
      projectionStatus: "ready",
      initialTotalCount: clips.length,
    };

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-a");
    expect(screen.getByTestId("clip-tags")).toHaveTextContent("clip-a:");
    expect(screen.getByTestId("clip-tags")).toHaveTextContent("magic");
  });

  it("switches to projection-backed search once projection preload is ready", async () => {
    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "Beta",
      sortBy: "newest",

    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-b");
    });
    expect(screen.getByText(/1개 클립/)).toHaveAttribute("aria-live", "polite");
  });

  it("uses Pagefind ids for search-only results without requiring projection", async () => {
    vi.mocked(searchBrowseClipIds).mockResolvedValue(["clip-c", "clip-a"]);
    const requestCardIndex = vi.fn();

    browseDataState = makeFullBrowseState({
      initialClips: initialSummaryClips,
      allCards: clips,
      cardsStatus: "ready",
      projectionClips: null,
      projectionStatus: "loading",
      requestCardIndex,
    });

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "pagefind only",
      sortBy: "newest",
      contentMode: null,
      boardId: null,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-c,clip-a");
    });

    expect(searchBrowseClipIds).toHaveBeenCalledWith("ko", "pagefind only");
    expect(requestCardIndex).toHaveBeenCalled();
  });

  it("keeps local search results visible while the first Pagefind request is loading", async () => {
    const deferred = createDeferred<string[]>();
    vi.mocked(searchBrowseClipIds).mockReturnValue(deferred.promise);

    browseDataState = makeFullBrowseState({
      projectionClips: [
        {
          ...clips[0],
          aiStructuredTags: [],
          searchTokens: ["alpha"],
        },
        {
          ...clips[1],
          aiStructuredTags: [],
          searchTokens: ["beta"],
        },
        {
          ...clips[2],
          aiStructuredTags: [],
          searchTokens: ["gamma"],
        },
      ],
    });

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "Beta",
      sortBy: "newest",
      contentMode: null,
      boardId: null,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(searchBrowseClipIds).toHaveBeenCalledWith("ko", "Beta");
    });

    expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-b");
    expect(screen.getByRole("paragraph")).toHaveTextContent("1개 클립");
    expect(screen.queryByText("'Beta'에 대한 결과가 없습니다")).not.toBeInTheDocument();

    await act(async () => {
      deferred.resolve(["clip-b"]);
      await deferred.promise;
    });

    await waitFor(() => {
      expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-b");
    });
  });

  it("keeps the previous stable search results visible while a new Pagefind request is loading", async () => {
    const deferred = createDeferred<string[]>();
    vi.mocked(searchBrowseClipIds)
      .mockResolvedValueOnce(["clip-a"])
      .mockReturnValueOnce(deferred.promise);

    browseDataState = makeFullBrowseState({
      projectionClips: [
        {
          ...clips[0],
          aiStructuredTags: [],
          searchTokens: ["alpha"],
        },
        {
          ...clips[1],
          aiStructuredTags: [],
          searchTokens: ["beta"],
        },
        {
          ...clips[2],
          aiStructuredTags: [],
          searchTokens: ["gamma"],
        },
      ],
    });

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "Alpha",
      sortBy: "newest",
      contentMode: null,
      boardId: null,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-a");
    });

    act(() => {
      useFilterStore.setState({
        searchQuery: "Beta",
      });
    });

    await waitFor(() => {
      expect(searchBrowseClipIds).toHaveBeenCalledWith("ko", "Beta");
    });

    expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-a");
    expect(screen.getByRole("paragraph")).toHaveTextContent("1개 클립");
    expect(screen.queryByText("'Beta'에 대한 결과가 없습니다")).not.toBeInTheDocument();

    await act(async () => {
      deferred.resolve(["clip-b"]);
      await deferred.promise;
    });

    await waitFor(() => {
      expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-b");
    });
  });

  it("shows a holding state instead of incorrect fallback results when projection-dependent filters are active and projection is not ready", async () => {
    const deferred = createDeferred<string[]>();
    vi.mocked(searchBrowseClipIds).mockReturnValue(deferred.promise);

    browseDataState = makeFullBrowseState({
      initialClips: initialSummaryClips,
      allCards: clips,
      cardsStatus: "ready",
      projectionClips: null,
      projectionStatus: "loading",
    });

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: ["마법"],
      excludedTags: [],
      searchQuery: "Alpha",
      sortBy: "newest",
      contentMode: null,
      boardId: null,
    });

    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" } as never,
      tier: "pro",
      isLoading: false,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(searchBrowseClipIds).toHaveBeenCalledWith("ko", "Alpha");
    });

    expect(screen.getByTestId("browse-results-holding")).toBeInTheDocument();
    expect(screen.queryByTestId("clip-order")).not.toBeInTheDocument();
    expect(screen.queryByText("'Alpha'에 대한 결과가 없습니다")).not.toBeInTheDocument();

    await act(async () => {
      deferred.resolve(["clip-a"]);
      await deferred.promise;
    });
  });

  it("keeps previous stable results while projection-dependent search waits for projection", async () => {
    vi.mocked(searchBrowseClipIds).mockResolvedValueOnce(["clip-a"]);

    browseDataState = makeFullBrowseState({
      projectionClips: [
        {
          ...clips[0],
          tags: ["마법"],
          aiStructuredTags: [],
          searchTokens: ["alpha"],
        },
        {
          ...clips[1],
          tags: ["걷기"],
          aiStructuredTags: [],
          searchTokens: ["beta"],
        },
        {
          ...clips[2],
          tags: ["피격"],
          aiStructuredTags: [],
          searchTokens: ["gamma"],
        },
      ],
    });

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: ["마법"],
      excludedTags: [],
      searchQuery: "Alpha",
      sortBy: "newest",
      contentMode: null,
      boardId: null,
    });

    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" } as never,
      tier: "pro",
      isLoading: false,
    });

    const { rerender } = render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-a");
    });

    const deferred = createDeferred<string[]>();
    vi.mocked(searchBrowseClipIds).mockReset();
    vi.mocked(searchBrowseClipIds).mockReturnValue(deferred.promise);

    act(() => {
      browseDataState = makeFullBrowseState({
        initialClips: initialSummaryClips,
        allCards: clips,
        cardsStatus: "ready",
        projectionClips: null,
        projectionStatus: "loading",
      });
      useFilterStore.setState({
        searchQuery: "Beta",
      });
    });

    rerender(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(searchBrowseClipIds).toHaveBeenCalledWith("ko", "Beta");
    });

    expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-a");
    expect(screen.queryByTestId("browse-results-holding")).not.toBeInTheDocument();
    expect(screen.queryByText("'Beta'에 대한 결과가 없습니다")).not.toBeInTheDocument();

    await act(async () => {
      deferred.resolve(["clip-b"]);
      await deferred.promise;
    });
  });

  it("falls back to local in-memory search when Pagefind fails", async () => {
    vi.mocked(searchBrowseClipIds).mockRejectedValue(new Error("pagefind down"));

    browseDataState = makeFullBrowseState({
      projectionClips: [
        {
          ...clips[0],
          tags: ["마법"],
          aiStructuredTags: [],
          searchTokens: [],
        },
        {
          ...clips[1],
          tags: ["마법"],
          aiStructuredTags: [],
          searchTokens: [],
        },
        {
          ...clips[2],
          tags: ["피격"],
          aiStructuredTags: [],
          searchTokens: [],
        },
      ],
    });

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "magic",
      sortBy: "newest",
      contentMode: null,
      boardId: null,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
        tagI18n={{ 마법: "Magic" }}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-a,clip-b");
    });
  });

  it("keeps a holding state on Pagefind error when projection-dependent filters still lack projection data", async () => {
    vi.mocked(searchBrowseClipIds).mockRejectedValue(new Error("pagefind down"));

    browseDataState = makeFullBrowseState({
      initialClips: initialSummaryClips,
      allCards: clips,
      cardsStatus: "ready",
      projectionClips: null,
      projectionStatus: "loading",
    });

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: ["마법"],
      excludedTags: [],
      searchQuery: "Alpha",
      sortBy: "newest",
      contentMode: null,
      boardId: null,
    });

    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" } as never,
      tier: "pro",
      isLoading: false,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("browse-results-holding")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("clip-order")).not.toBeInTheDocument();
    expect(screen.queryByText("'Alpha'에 대한 결과가 없습니다")).not.toBeInTheDocument();
  });

  it("intersects Pagefind ids with structural filters once projection data is ready", async () => {
    vi.mocked(searchBrowseClipIds).mockResolvedValue(["clip-c", "clip-a", "clip-b"]);

    browseDataState = makeFullBrowseState({
      initialClips: clips,
      allCards: clips,
      cardsStatus: "ready",
      projectionClips: null,
      projectionStatus: "loading",
    });

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: ["마법"],
      excludedTags: [],
      searchQuery: "pagefind filters",
      sortBy: "newest",
      contentMode: null,
      boardId: null,
    });

    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" } as never,
      tier: "pro",
      isLoading: false,
    });

    const { rerender } = render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(searchBrowseClipIds).toHaveBeenCalledWith("ko", "pagefind filters");
    });

    act(() => {
      browseDataState = makeFullBrowseState({
        projectionClips: [
          {
            ...clips[0],
            tags: ["마법"],
            aiStructuredTags: [],
            searchTokens: ["alpha"],
          },
          {
            ...clips[1],
            tags: ["죽음"],
            aiStructuredTags: [],
            searchTokens: ["beta"],
          },
          {
            ...clips[2],
            tags: ["마법"],
            aiStructuredTags: [],
            searchTokens: ["gamma"],
          },
        ],
        projectionStatus: "ready",
      });
    });

    rerender(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-c,clip-a");
    });
  });

  it("keeps Pagefind result ordering instead of falling back to alphabetical sort", async () => {
    vi.mocked(searchBrowseClipIds).mockResolvedValue(["clip-b", "clip-a", "clip-c"]);

    browseDataState = makeFullBrowseState({
      projectionClips: [
        {
          ...clips[0],
          aiStructuredTags: [],
          searchTokens: ["shared"],
        },
        {
          ...clips[1],
          aiStructuredTags: [],
          searchTokens: ["shared"],
        },
        {
          ...clips[2],
          aiStructuredTags: [],
          searchTokens: ["shared"],
        },
      ],
    });

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "shared",
      sortBy: "name",
      contentMode: null,
      boardId: null,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-b,clip-a,clip-c");
    });
  });

  it("renders translated-tag style queries through the Pagefind id path", async () => {
    vi.mocked(searchBrowseClipIds).mockResolvedValue(["clip-b", "clip-a"]);

    browseDataState = makeFullBrowseState({
      projectionClips: [
        {
          ...clips[0],
          tags: ["마법"],
          aiStructuredTags: [],
          searchTokens: [],
        },
        {
          ...clips[1],
          tags: ["마법"],
          aiStructuredTags: [],
          searchTokens: [],
        },
        {
          ...clips[2],
          tags: ["피격"],
          aiStructuredTags: [],
          searchTokens: [],
        },
      ],
    });

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "magic",
      sortBy: "newest",
      contentMode: null,
      boardId: null,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
        tagI18n={{ 마법: "Magic" }}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-b,clip-a");
    });
  });

  it("renders ai-description-style queries through the Pagefind id path", async () => {
    vi.mocked(searchBrowseClipIds).mockResolvedValue(["clip-4"]);

    const aiClip: ClipIndex = {
      id: "clip-4",
      name: "Heavy Walk",
      tags: ["걷기"],
      folders: ["movement"],
      category: "acting",
      width: 100,
      height: 100,
      duration: 1,
      previewUrl: "/d.mp4",
      thumbnailUrl: "/d.jpg",
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
    };

    browseDataState = makeFullBrowseState({
      initialClips: [aiClip],
      allCards: [aiClip],
      projectionClips: [
        {
          ...aiClip,
          aiStructuredTags: ["걷기", "슬픔", "풀샷", "느림", "전사"],
          searchTokens: [],
        },
      ],
      initialTotalCount: 1,
      totalClipCount: 1,
    });

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "슬픈 장면",
      sortBy: "newest",
      contentMode: null,
      boardId: null,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-4");
    });
  });

  it("renders a query-specific empty state when no clips match", async () => {
    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "없는 검색어",
      sortBy: "newest",

    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("'없는 검색어'에 대한 결과가 없습니다")).toBeInTheDocument();
    });
  });

  it("waits for active search results before resolving resume lock state", async () => {
    const deferred = createDeferred<string[]>();
    vi.mocked(searchBrowseClipIds).mockReturnValue(deferred.promise);

    const manyClips = Array.from({ length: 7 }, (_, index) => ({
      id: `clip-${index + 1}`,
      name: `Match ${index + 1}`,
      tags: [],
      folders: [],
      category: "action",
      width: 100,
      height: 100,
      duration: 1,
      previewUrl: `/${index + 1}.mp4`,
      thumbnailUrl: `/${index + 1}.jpg`,
      lqipBase64: "",
    }));

    browseDataState = {
      initialClips: manyClips,
      allCards: manyClips,
      cardsStatus: "ready",
      projectionClips: manyClips.map((clip) => ({
        ...clip,
        aiStructuredTags: [],
        searchTokens: ["match"],
      })),
      projectionStatus: "ready",
      initialTotalCount: manyClips.length,
      totalClipCount: manyClips.length,
      allTags: [],
      popularTags: [],
      tagCounts: {},
      requestCardIndex: vi.fn(),
      requestDetailedIndex: vi.fn(),
    };

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "match",
      sortBy: "newest",
      contentMode: null,
      boardId: null,
    });

    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" } as never,
      tier: "free",
      isLoading: false,
    });

    window.history.replaceState(
      null,
      "",
      "/ko/browse?q=match&resumeClip=clip-6&resumeOpen=1"
    );

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(searchBrowseClipIds).toHaveBeenCalledWith("ko", "match");
    });

    expect(useUIStore.getState().pricingModalOpen).toBe(false);
    expect(useUIStore.getState().quickViewOpen).toBe(false);
    expect(window.location.search).toBe("?q=match&resumeClip=clip-6&resumeOpen=1");

    await act(async () => {
      deferred.resolve(manyClips.map((clip) => clip.id));
      await deferred.promise;
    });

    await waitFor(() => {
      expect(useUIStore.getState().pricingModalOpen).toBe(true);
    });
    expect(useUIStore.getState().quickViewOpen).toBe(false);
    expect(window.location.search).toBe("?q=match");
  });

  it("does not record recent history for guests when the selected clip changes", async () => {
    browseDataState = makeFullBrowseState();

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await act(async () => {
      useClipStore.setState({ selectedClipId: "clip-a" });
    });

    expect(useViewHistoryStore.getState().entries).toEqual([]);
    expect(recordViewHistoryBatchMock).not.toHaveBeenCalled();
  });

  it("records recent history for the signed-in account when the selected clip changes", async () => {
    browseDataState = makeFullBrowseState();
    useAuthStore.setState({
      user: { id: "user-1" } as never,
      tier: "free",
      isLoading: false,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await act(async () => {
      useClipStore.setState({ selectedClipId: "clip-b" });
    });

    await waitFor(() => {
      expect(useViewHistoryStore.getState().entries.map((entry) => entry.clipId)).toEqual([
        "clip-b",
      ]);
    });
  });

  it("renders the signed-in account's recent history from the server", async () => {
    browseDataState = makeFullBrowseState();
    useAuthStore.setState({
      user: { id: "user-1" } as never,
      tier: "free",
      isLoading: false,
    });
    useUIStore.setState({
      browseMode: "history",
    });
    fetchViewHistoryMock.mockResolvedValueOnce([
      { clipId: "clip-c", viewedAt: "2026-03-29T10:00:00.000Z" },
      { clipId: "clip-a", viewedAt: "2026-03-29T09:00:00.000Z" },
    ]);

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(
        screen
          .getAllByTestId("feed-clip-card")
          .filter((card) => card.tagName === "ARTICLE")
          .map((card) => card.dataset.clipId)
      ).toEqual(["clip-c", "clip-a"]);
    });
  });

  it("updates history mode from the optimistic store without refetching on selection", async () => {
    browseDataState = makeFullBrowseState();
    useAuthStore.setState({
      user: { id: "user-1" } as never,
      tier: "free",
      isLoading: false,
    });
    useUIStore.setState({
      browseMode: "history",
    });
    fetchViewHistoryMock.mockResolvedValue([
      { clipId: "clip-a", viewedAt: "2026-03-29T09:00:00.000Z" },
    ]);

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    await waitFor(() => {
      expect(
        screen
          .getAllByTestId("feed-clip-card")
          .filter((card) => card.tagName === "ARTICLE")
          .map((card) => card.dataset.clipId)
      ).toEqual(["clip-a"]);
    });

    expect(fetchViewHistoryMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      useClipStore.setState({ selectedClipId: "clip-b" });
    });

    await waitFor(() => {
      expect(useViewHistoryStore.getState().entries.map((entry) => entry.clipId)).toEqual([
        "clip-b",
        "clip-a",
      ]);
    });
    expect(fetchViewHistoryMock).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(
        screen
          .getAllByTestId("feed-clip-card")
          .filter((card) => card.tagName === "ARTICLE")
          .map((card) => card.dataset.clipId)
      ).toEqual(["clip-b", "clip-a"]);
    });
    expect(fetchViewHistoryMock).toHaveBeenCalledTimes(1);
  });

  it("lets Pro users keep multiple filter axes active", () => {
    useAuthStore.setState({
      user: { id: "user-1" } as never,
      tier: "pro",
      isLoading: false,
    });

    browseDataState = {
      initialClips: clips,
      projectionClips: clips.map((clip, index) => ({
        ...clip,
        tags: index < 2 ? ["마법"] : ["걷기"],
        aiStructuredTags: [],
        searchTokens: [clip.name.toLowerCase()],
      })),
      projectionStatus: "ready",
      initialTotalCount: clips.length,
    };

    useFilterStore.setState({
      category: "action",
      selectedFolders: [],
      selectedTags: ["마법"],
      excludedTags: [],
      searchQuery: "",
      sortBy: "newest",
      contentMode: null,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-a,clip-b");
    expect(screen.queryByText("필터 조합은 Pro 전용입니다")).not.toBeInTheDocument();
  });
});
