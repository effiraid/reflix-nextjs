import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ClipCard } from "./ClipCard";
import type { ClipIndex } from "@/lib/types";

const setSelectedClipIdMock = vi.fn();
const { getMediaUrlMock, clipStoreState } = vi.hoisted(() => ({
  getMediaUrlMock: vi.fn((path: string) => path),
  clipStoreState: {
    selectedClipId: null as string | null,
  },
}));

vi.mock("@/hooks/useIntersectionLoader", () => ({
  useIntersectionLoader: () => ({
    ref: { current: null },
    stage: "thumbnail" as const,
    isInView: false,
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
  tags: [],
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
    setSelectedClipIdMock.mockReset();
    getMediaUrlMock.mockClear();
    getMediaUrlMock.mockImplementation((path: string) => path);
  });

  it("shows title and duration with lighter default text that brightens on hover and omits stars", () => {
    render(<ClipCard clip={clip} />);

    expect(screen.getByText(clip.name)).toBeInTheDocument();
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

    fireEvent.doubleClick(screen.getByText(clip.name));

    expect(setSelectedClipIdMock).toHaveBeenCalledWith(clip.id);
    expect(onOpenQuickView).toHaveBeenCalledWith(clip.id);
  });

  it("opens quick view on single click when the clip is already selected", () => {
    const onOpenQuickView = vi.fn();
    clipStoreState.selectedClipId = clip.id;

    render(<ClipCard clip={clip} onOpenQuickView={onOpenQuickView} />);

    fireEvent.click(screen.getByText(clip.name));

    expect(setSelectedClipIdMock).not.toHaveBeenCalled();
    expect(onOpenQuickView).toHaveBeenCalledWith(clip.id);
  });
});
