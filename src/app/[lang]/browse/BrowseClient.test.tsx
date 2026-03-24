import { act, fireEvent, render, screen } from "@testing-library/react";
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
      allClips: [],
      isLoading: true,
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
        initialClips={clips}
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

  it("opens quick view on Space, closes it on Space, and navigates the visible clip order with arrow keys", () => {
    useClipStore.setState({
      selectedClipId: "clip-a",
      allClips: [],
      isLoading: false,
    });

    render(
      <BrowseClient
        initialClips={clips}
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });
    expect(screen.getByRole("dialog", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByTestId("video-player")).toHaveAttribute(
      "data-video-url",
      "/videos/clip-a.mp4"
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });
    expect(screen.getByRole("dialog", { name: "Alpha" })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    });
    expect(screen.getByRole("dialog", { name: "Beta" })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens quick view for the requested clip id from the grid", () => {
    render(
      <BrowseClient
        initialClips={clips}
        categories={{}}
        lang="ko"
        dict={dict}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open clip-b" }));

    expect(screen.getByRole("dialog", { name: "Beta" })).toBeInTheDocument();
    expect(useClipStore.getState().selectedClipId).toBe("clip-b");
  });
});
