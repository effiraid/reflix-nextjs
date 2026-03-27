import * as React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowseClient } from "./BrowseClient";
import { useClipStore } from "@/stores/clipStore";
import { useFilterStore } from "@/stores/filterStore";
import { useUIStore } from "@/stores/uiStore";
import koDict from "@/app/[lang]/dictionaries/ko.json";
import type { BrowseClipRecord, BrowseProjectionRecord, BrowseSummaryRecord, ClipIndex } from "@/lib/types";
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
    onOpenQuickView,
  }: {
    clips: ClipIndex[];
    onOpenQuickView?: (clipId: string) => void;
  }) => (
    <div>
      <div data-testid="clip-order">{clips.map((clip) => clip.id).join(",")}</div>
      <div data-testid="clip-tags">
        {clips
          .map((clip) => `${clip.id}:${(clip.tags ?? []).join("|")}`)
          .join(",")}
      </div>
      {clips.map((clip) => (
        <button
          key={clip.id}
          type="button"
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
  return {
    __esModule: true,
    default: (fn: () => Promise<unknown>) => {
      let resolvedComp: React.ComponentType<any> | null = null;
      fn().then((mod: any) => {
        resolvedComp = typeof mod === "function" ? mod : mod?.default ?? mod;
      });
      return function DynamicMock(props: Record<string, unknown>) {
        // Use arrow function to avoid React calling the component as a state initializer
        const [Comp, setComp] = React.useState<React.ComponentType<any> | null>(() => resolvedComp);
        React.useEffect(() => {
          if (!Comp && resolvedComp) {
            setComp(() => resolvedComp);
          } else if (!resolvedComp) {
            fn().then((mod: any) => {
              resolvedComp = typeof mod === "function" ? mod : mod?.default ?? mod;
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
      selectedTags: [],
      searchQuery: "",
      sortBy: "newest",
      starFilter: null,
    });
    useClipStore.setState({
      selectedClipId: null,
    });
    useUIStore.setState({
      shuffleSeed: 0,
      quickViewOpen: false,
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
});
