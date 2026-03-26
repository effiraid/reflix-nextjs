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
    autoPlayMuted,
  }: {
    videoUrl: string;
    thumbnailUrl: string;
    autoPlayMuted?: boolean;
  }) => (
    <div
      data-testid="video-player"
      data-video-url={videoUrl}
      data-thumbnail-url={thumbnailUrl}
      data-auto-play-muted={String(autoPlayMuted ?? false)}
    >
      <button type="button">Play video</button>
      <button type="button">Playback speed</button>
    </div>
  ),
  PLAYBACK_SPEEDS: [0.25, 0.5, 1, 1.5, 2],
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
    share: "Share",
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

  it("closes on Escape key", () => {
    const onClose = vi.fn();

    render(
      <QuickViewModal
        clip={clip}
        lang="ko"
        dict={dict}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("restores focus to previous element on close", () => {
    const onClose = vi.fn();

    const { rerender } = render(
      <>
        <button type="button">Before</button>
      </>
    );

    const beforeButton = screen.getByRole("button", { name: "Before" });
    beforeButton.focus();

    rerender(
      <>
        <button type="button">Before</button>
        <QuickViewModal
          clip={clip}
          lang="ko"
          dict={dict}
          onClose={onClose}
        />
      </>
    );

    rerender(
      <>
        <button type="button">Before</button>
      </>
    );

    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
  });

  it("renders share and detail buttons in the aside", () => {
    const onClose = vi.fn();

    render(
      <QuickViewModal
        clip={clip}
        lang="ko"
        dict={dict}
        onClose={onClose}
      />
    );

    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Detail" })).toBeInTheDocument();
  });
});
