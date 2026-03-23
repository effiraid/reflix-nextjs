import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClipCard } from "./ClipCard";
import type { ClipIndex } from "@/lib/types";

const setSelectedClipIdMock = vi.fn();

vi.mock("@/hooks/useIntersectionLoader", () => ({
  useIntersectionLoader: () => ({
    ref: { current: null },
    stage: "thumbnail" as const,
    isInView: false,
  }),
}));

vi.mock("@/stores/clipStore", () => ({
  useClipStore: () => ({
    selectedClipId: null,
    setSelectedClipId: setSelectedClipIdMock,
  }),
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
    setSelectedClipIdMock.mockReset();
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
});
