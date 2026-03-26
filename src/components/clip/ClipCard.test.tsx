import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ClipCard } from "./ClipCard";
import type { ClipIndex } from "@/lib/types";

const setSelectedClipIdMock = vi.fn();
const { getMediaUrlMock, clipStoreState, intersectionState } = vi.hoisted(() => ({
  getMediaUrlMock: vi.fn((path: string) => path),
  clipStoreState: {
    selectedClipId: null as string | null,
  },
  intersectionState: {
    stage: "thumbnail" as "lqip" | "thumbnail" | "webp",
    isInView: false,
  },
}));

vi.mock("@/hooks/useIntersectionLoader", () => ({
  useIntersectionLoader: () => ({
    ref: { current: null },
    stage: intersectionState.stage,
    isInView: intersectionState.isInView,
  }),
}));

vi.mock("@/stores/clipStore", () => ({
  useClipStore: () => ({
    selectedClipId: clipStoreState.selectedClipId,
    setSelectedClipId: setSelectedClipIdMock,
  }),
}));

vi.mock("@/lib/mediaUrl", () => ({
  getMediaUrl: getMediaUrlMock,
}));

const clip: ClipIndex = {
  id: "clip-1",
  name: "연출 아케인 힘듦 일어나기 비몽사몽 비틀비틀 아픔",
  tags: ["아케인", "힘듦"],
  folders: [],
  star: 3,
  category: "acting",
  width: 1920,
  height: 1080,
  duration: 8.6,
  previewUrl: "/preview.mp4",
  thumbnailUrl: "/thumb.webp",
  lqipBase64: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
};

describe("ClipCard", () => {
  beforeEach(() => {
    clipStoreState.selectedClipId = null;
    intersectionState.stage = "thumbnail";
    intersectionState.isInView = false;
    setSelectedClipIdMock.mockReset();
    getMediaUrlMock.mockClear();
    getMediaUrlMock.mockImplementation((path: string) => path);
  });

  it("shows tags and duration with lighter default text that brightens on hover and omits stars", () => {
    render(<ClipCard clip={clip} />);

    expect(screen.getByRole("button", { name: clip.name })).toBeInTheDocument();
    expect(screen.getByText("아케인, 힘듦")).toBeInTheDocument();
    expect(screen.getByText("8.6s")).toBeInTheDocument();
    expect(screen.queryByText("★★★")).not.toBeInTheDocument();

    const duration = screen.getByText("8.6s");
    const infoRow = duration.closest("div");
    const overlay = infoRow?.parentElement;

    expect(infoRow).not.toBeNull();
    expect(infoRow?.className).toContain("text-white/60");
    expect(infoRow?.className).toContain("group-hover:text-white");
    expect(overlay).not.toBeNull();
    expect(overlay?.className).toContain("bg-gradient-to-t");
    expect(overlay?.className).not.toContain("opacity-0");
    expect(overlay?.className).not.toContain("hover:opacity-100");
  });

  it("resolves the thumbnail path through the shared media URL helper", () => {
    render(<ClipCard clip={clip} />);

    expect(getMediaUrlMock).toHaveBeenCalledWith(clip.thumbnailUrl);
  });

  it("opens quick view on double click while keeping the clip selected", () => {
    const onOpenQuickView = vi.fn();

    render(<ClipCard clip={clip} onOpenQuickView={onOpenQuickView} />);

    fireEvent.doubleClick(screen.getByRole("button", { name: clip.name }));

    expect(setSelectedClipIdMock).toHaveBeenCalledWith(clip.id);
    expect(onOpenQuickView).toHaveBeenCalledWith(clip.id);
  });

  it("opens quick view on single click when the clip is already selected", () => {
    const onOpenQuickView = vi.fn();
    clipStoreState.selectedClipId = clip.id;

    render(<ClipCard clip={clip} onOpenQuickView={onOpenQuickView} />);

    fireEvent.click(screen.getByRole("button", { name: clip.name }));

    expect(setSelectedClipIdMock).not.toHaveBeenCalled();
    expect(onOpenQuickView).toHaveBeenCalledWith(clip.id);
  });

  it("only plays the preview on hover when hover playback is enabled", () => {
    intersectionState.stage = "webp";
    intersectionState.isInView = true;

    const { container } = render(<ClipCard clip={clip} previewOnHover />);
    const card = container.firstElementChild as HTMLElement;

    expect(container.querySelector("video")).not.toBeInTheDocument();

    fireEvent.mouseEnter(card);

    expect(container.querySelector("video")).toBeInTheDocument();

    fireEvent.mouseLeave(card);

    expect(container.querySelector("video")).not.toBeInTheDocument();
  });

  it("drops the preview video overlay after a preview load error", () => {
    intersectionState.stage = "webp";
    intersectionState.isInView = true;

    const { container } = render(<ClipCard clip={clip} />);
    const preview = container.querySelector("video");

    expect(preview).not.toBeNull();

    fireEvent.error(preview!);

    expect(container.querySelector("video")).not.toBeInTheDocument();
    expect(screen.getByAltText(clip.name)).toBeInTheDocument();
  });

  it("hides the clip info overlay when text display is disabled", () => {
    render(<ClipCard clip={clip} showInfo={false} />);

    expect(screen.queryByText("아케인, 힘듦")).not.toBeInTheDocument();
    expect(screen.queryByText("8.6s")).not.toBeInTheDocument();
  });

  it("marks prioritized thumbnails for eager loading above the fold", () => {
    render(<ClipCard clip={clip} prioritizeThumbnail />);

    expect(screen.getByAltText(clip.name)).toHaveAttribute("loading", "eager");
  });

  it("shows watermark only when video preview is playing", () => {
    intersectionState.stage = "webp";
    intersectionState.isInView = true;

    const { container } = render(<ClipCard clip={clip} />);

    expect(container.querySelector("video")).toBeInTheDocument();
    expect(screen.getByText("reflix.dev")).toBeInTheDocument();
  });

  it("hides watermark when preview is not playing", () => {
    intersectionState.stage = "thumbnail";
    intersectionState.isInView = false;

    render(<ClipCard clip={clip} />);

    expect(screen.queryByText("reflix.dev")).not.toBeInTheDocument();
  });
});
