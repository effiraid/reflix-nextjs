import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowseClient } from "./BrowseClient";
import { useClipStore } from "@/stores/clipStore";
import { useFilterStore } from "@/stores/filterStore";
import { useUIStore } from "@/stores/uiStore";
import type { ClipIndex } from "@/lib/types";
import type { Dictionary } from "../dictionaries";

vi.mock("@/hooks/useFilterSync", () => ({
  useFilterSync: () => ({
    updateURL: vi.fn(),
  }),
}));

vi.mock("./ClipDataProvider", () => ({
  useClipData: () => clips,
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
  const React = require("react");
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

const dict = {
  browse: {
    noResults: "결과 없음",
  },
  clip: {
    detail: "상세 보기",
    tags: "태그",
    rating: "별점",
    duration: "재생시간",
  },
} as Dictionary;

describe("BrowseClient", () => {
  beforeEach(() => {
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
});
