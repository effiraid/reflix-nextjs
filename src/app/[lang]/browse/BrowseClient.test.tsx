import { act, render, screen } from "@testing-library/react";
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
  MasonryGrid: ({ clips }: { clips: ClipIndex[] }) => (
    <div data-testid="clip-order">{clips.map((clip) => clip.id).join(",")}</div>
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
});
