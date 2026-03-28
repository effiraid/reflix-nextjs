import * as React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowseClient } from "./BrowseClient";
import { useAuthStore } from "@/stores/authStore";
import { useClipStore } from "@/stores/clipStore";
import { useFilterStore } from "@/stores/filterStore";
import { useUIStore } from "@/stores/uiStore";
import koDict from "@/app/[lang]/dictionaries/ko.json";
import type { BrowseProjectionRecord, BrowseSummaryRecord, ClipIndex } from "@/lib/types";
import type { Dictionary } from "../dictionaries";

vi.mock("@/hooks/useFilterSync", () => ({
  useFilterSync: () => ({
    updateURL: vi.fn(),
  }),
}));

let browseDataState: {
  initialClips: BrowseSummaryRecord[];
  projectionClips: BrowseProjectionRecord[] | null;
  projectionStatus: "loading" | "ready" | "error";
  initialTotalCount: number;
};

vi.mock("./ClipDataProvider", () => ({
  useBrowseData: () => browseDataState,
  useClipData: () => browseDataState.projectionClips ?? browseDataState.initialClips,
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
    star: 0,
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
    star: 0,
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
    star: 0,
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
  star: clip.star,
  category: clip.category,
}));

function makeFullBrowseState(overrides?: Partial<typeof browseDataState>) {
  return {
    initialClips: clips,
    projectionClips: clips.map((clip) => ({
      ...clip,
      aiStructuredTags: [] as string[],
      searchTokens: [clip.name.toLowerCase()],
    })),
    projectionStatus: "ready" as const,
    initialTotalCount: clips.length,
    ...overrides,
  };
}

const dict = {
  ...koDict,
} satisfies Dictionary;

describe("BrowseClient", () => {
  beforeEach(() => {
    browseDataState = {
      initialClips: initialSummaryClips,
      projectionClips: clips.map((clip) => ({
        ...clip,
        aiStructuredTags: [],
        searchTokens: [clip.name.toLowerCase()],
      })),
      projectionStatus: "ready",
      initialTotalCount: clips.length,
    };
    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      excludedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "",
      sortBy: "newest",
      starFilter: null,
      contentMode: null,
    });
    useClipStore.setState({
      selectedClipId: null,
    });
    useUIStore.setState({
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
    const randomSpy = vi
      .spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);

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
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("opens quick view for the requested clip id from the grid", async () => {
    browseDataState = makeFullBrowseState();
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

  it("shows a live result count while a search query is active", () => {
    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "Alpha",
      sortBy: "newest",
      starFilter: null,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    expect(screen.getByText("1개 클립")).toHaveAttribute("aria-live", "polite");
  });

  it("shows all free search results but locks everything after the first five", () => {
    const manyClips = Array.from({ length: 7 }, (_, index) => ({
      id: `clip-${index + 1}`,
      name: `Match ${index + 1}`,
      tags: [],
      folders: [],
      star: index,
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
      starFilter: null,
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

    expect(screen.getByTestId("clip-order")).toHaveTextContent(
      "clip-1,clip-2,clip-3,clip-4,clip-5,clip-6,clip-7"
    );
    expect(screen.getByTestId("locked-order")).toHaveTextContent("clip-6,clip-7");
    expect(screen.getByRole("button", { name: "Open clip-5" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Open clip-6" })).toBeDisabled();
    const statusBar = screen.getByRole("paragraph");
    expect(statusBar).toHaveAttribute("aria-live", "polite");
    expect(statusBar).toHaveTextContent(/7개 클립/);
    expect(statusBar).toHaveTextContent(/2개 결과는 Pro 전용/);
    expect(screen.getByRole("button", { name: "Pro로 잠금 해제" })).toBeInTheDocument();
  });

  it("re-opens the requested clip after login when the free tier can now access it", async () => {
    const manyClips = Array.from({ length: 7 }, (_, index) => ({
      id: `clip-${index + 1}`,
      name: `Match ${index + 1}`,
      tags: [],
      folders: [],
      star: index,
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
      starFilter: null,
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
      star: index,
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
      starFilter: null,
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
        star: 3,
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
        star: 5,
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
        star: 5,
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
      selectedTags: ["마법"],
      excludedTags: [],
      searchQuery: "",
      sortBy: "newest",
      starFilter: 4,
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

  it("switches to projection-backed search once projection preload is ready", () => {
    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "Beta",
      sortBy: "newest",
      starFilter: null,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-b");
    expect(screen.getByText("1개 클립")).toHaveAttribute("aria-live", "polite");
  });

  it("renders a query-specific empty state when no clips match", () => {
    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      selectedTags: [],
      excludedTags: [],
      searchQuery: "없는 검색어",
      sortBy: "newest",
      starFilter: null,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    expect(screen.getByText("'없는 검색어'에 대한 결과가 없습니다")).toBeInTheDocument();
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
        star: index === 0 ? 3 : 5,
        aiStructuredTags: [],
        searchTokens: [clip.name.toLowerCase()],
      })),
      projectionStatus: "ready",
      initialTotalCount: clips.length,
    };

    useFilterStore.setState({
      category: null,
      selectedFolders: [],
      selectedTags: ["마법"],
      excludedTags: [],
      searchQuery: "",
      sortBy: "newest",
      starFilter: 4,
      contentMode: null,
    });

    render(
      <BrowseClient
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    expect(screen.getByTestId("clip-order")).toHaveTextContent("clip-b");
    expect(screen.queryByText("필터 조합은 Pro 전용입니다")).not.toBeInTheDocument();
  });
});
