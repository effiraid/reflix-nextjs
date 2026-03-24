import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickViewModal } from "./QuickViewModal";
import type { ClipIndex } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: ComponentPropsWithoutRef<"a"> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/clip/VideoPlayer", () => ({
  VideoPlayer: ({
    videoUrl,
    thumbnailUrl,
    playbackToggleCount,
    autoPlayMuted,
  }: {
    videoUrl: string;
    thumbnailUrl: string;
    playbackToggleCount?: number;
    autoPlayMuted?: boolean;
  }) => (
    <div
      data-testid="video-player"
      data-video-url={videoUrl}
      data-thumbnail-url={thumbnailUrl}
      data-playback-toggle-count={String(playbackToggleCount ?? 0)}
      data-auto-play-muted={String(autoPlayMuted ?? false)}
    />
  ),
}));

const clip: ClipIndex = {
  id: "clip-1",
  name: "Clip One",
  tags: ["tag-a", "tag-b"],
  folders: [],
  star: 4,
  category: "action",
  width: 1280,
  height: 720,
  duration: 12.4,
  previewUrl: "/previews/clip-1.mp4",
  thumbnailUrl: "/thumbnails/clip-1.webp",
  lqipBase64: "",
};

const dict = {
  clip: {
    detail: "View Detail",
    tags: "Tags",
    rating: "Rating",
    duration: "Duration",
  },
};

describe("QuickViewModal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders VideoPlayer with the selected clip URLs and closes on backdrop click", () => {
    const onClose = vi.fn();

    render(
      <QuickViewModal
        clip={clip}
        lang="ko"
        dict={dict}
        onClose={onClose}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
      />
    );

    const player = screen.getByTestId("video-player");
    expect(player).toHaveAttribute("data-video-url", "/videos/clip-1.mp4");
    expect(player).toHaveAttribute(
      "data-thumbnail-url",
      "/thumbnails/clip-1.webp"
    );
    expect(player).toHaveAttribute("data-auto-play-muted", "true");
    expect(screen.getByRole("link", { name: "View Detail" })).toHaveAttribute(
      "href",
      "/ko/clip/clip-1"
    );

    fireEvent.click(screen.getByTestId("quick-view-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("maps keyboard navigation to the provided callbacks", () => {
    const onClose = vi.fn();
    const onNext = vi.fn();
    const onPrevious = vi.fn();

    render(
      <QuickViewModal
        clip={clip}
        lang="ko"
        dict={dict}
        onClose={onClose}
        onNext={onNext}
        onPrevious={onPrevious}
      />
    );

    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uses Space to close the modal", () => {
    const onClose = vi.fn();

    render(
      <QuickViewModal
        clip={clip}
        lang="ko"
        dict={dict}
        onClose={onClose}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
      />
    );

    const player = screen.getByTestId("video-player");
    expect(player).toHaveAttribute("data-playback-toggle-count", "0");

    fireEvent.keyDown(window, { key: " " });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("video-player")).toHaveAttribute(
      "data-playback-toggle-count",
      "0"
    );
  });
});
