import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickViewModal } from "./QuickViewModal";
import { clearClipDetailCache } from "@/lib/clip-detail-client";
import type { Dictionary } from "@/app/[lang]/dictionaries";
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
    isExpanded,
    onExpandToggle,
  }: {
    videoUrl: string;
    thumbnailUrl: string;
    autoPlayMuted?: boolean;
    isExpanded?: boolean;
    onExpandToggle?: () => void;
  }) => (
    <div
      data-testid="video-player"
      data-video-url={videoUrl}
      data-thumbnail-url={thumbnailUrl}
      data-auto-play-muted={String(autoPlayMuted ?? false)}
      data-is-expanded={String(isExpanded ?? false)}
    >
      <button type="button">Play video</button>
      <button type="button">Playback speed</button>
      {onExpandToggle ? (
        <button
          type="button"
          aria-label={isExpanded ? "Collapse player" : "Expand player"}
          onClick={onExpandToggle}
        >
          Toggle expand
        </button>
      ) : null}
    </div>
  ),
  PLAYBACK_SPEEDS: [0.25, 0.5, 1, 1.5, 2],
}));

const clip: ClipIndex = {
  id: "clip-1",
  name: "Clip One",
  tags: ["tag-a", "tag-b"],
  folders: [],
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
    play: "Play",
    pause: "Pause",
    speed: "Speed",
    detail: "View Detail",
    related: "Related Clips",
    tags: "Tags",
    folders: "Folders",
    added: "Added",
    duration: "Duration",
    inspectorDuration: "Duration",
    fileType: "File Type",
    memo: "Memo",
    properties: "Properties",
    size: "Size",
    resolution: "Resolution",
    format: "Format",
    video: "Video",
    image: "Image",
    sourceUrl: "Source URL",
    noLink: "No link",
    colorPalette: "Color Palette",
    aiAnalysis: "AI Analysis",
    aiLatest: "NEW",
    aiPending: "AI analysis pending",
    tipClose: "Close",
    tipPlayPause: "Play/Pause",
    tipSeek: "Seek 1s",
    tipFrame: "Frame step",
    tipSpeed: "Speed",
    tipLoop: "Loop",
    tipInOut: "Set in/out",
    tipResetMarkers: "Reset markers",
    tipMute: "Mute",
    tipFullscreen: "Fullscreen",
    tipExpand: "Expand",
    tipToggleHelp: "Toggle help",
    share: "Share",
    copied: "Copied",
    tooltipPlay: "Play (Space)",
    tooltipPause: "Pause (Space)",
    tooltipMute: "Mute (M)",
    tooltipUnmute: "Unmute (M)",
    tooltipTimeFrame: "Time / Frame",
    tooltipSpeed: "Speed (+/−)",
    tooltipLoop: "Loop (L)",
    tooltipExpand: "Expand (E)",
    tooltipFullscreen: "Fullscreen (F)",
  },
} satisfies Pick<Dictionary, "clip">;

const defaultDetailOverrides = {
  ext: "mp4",
  size: 1024 * 512,
  folders: ["folder-a"],
  url: "https://example.com/source",
  palettes: [],
  btime: 0,
  mtime: 0,
  i18n: {
    title: { ko: clip.name, en: clip.name },
    description: { ko: "", en: "" },
  },
  videoUrl: `/videos/${clip.id}.mp4`,
  relatedClips: [],
};

function mockClipDetailResponse(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...clip,
            ...defaultDetailOverrides,
            ...overrides,
          }),
      } as Response)
    )
  );
}

describe("QuickViewModal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    clearClipDetailCache();
    mockClipDetailResponse();
  });

  it("renders VideoPlayer with the selected clip URLs and closes on backdrop click", () => {
    const onClose = vi.fn();

    render(
      <QuickViewModal
        clip={clip}
        dict={dict}
        lang="ko"
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

    vi.useFakeTimers();
    fireEvent.click(screen.getByTestId("quick-view-backdrop"));
    vi.advanceTimersByTime(200);
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("closes on Escape key", () => {
    const onClose = vi.fn();

    render(
      <QuickViewModal
        clip={clip}
        dict={dict}
        lang="ko"
        onClose={onClose}
      />
    );

    vi.useFakeTimers();
    fireEvent.keyDown(window, { key: "Escape" });
    vi.advanceTimersByTime(200);
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
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
          dict={dict}
          lang="ko"
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
        dict={dict}
        lang="ko"
        onClose={onClose}
      />
    );

    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Detail" })).toBeInTheDocument();
  });

  it("top-aligns the quick view columns instead of stretching the player", () => {
    render(
      <QuickViewModal
        clip={clip}
        dict={dict}
        lang="ko"
        onClose={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Clip One" });
    const layout = dialog.querySelector("div.grid");

    expect(layout).toHaveClass("lg:items-start");
  });

  it("stacks the details panel below the player when expanded", () => {
    render(
      <QuickViewModal
        clip={clip}
        dict={dict}
        lang="ko"
        onClose={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Clip One" });
    const layout = dialog.querySelector("div.grid");
    const player = screen.getByTestId("video-player");

    expect(layout).toHaveClass("lg:grid-cols-[minmax(0,2fr)_320px]");
    expect(player).toHaveAttribute("data-is-expanded", "false");

    fireEvent.click(screen.getByRole("button", { name: "Expand player" }));

    expect(layout).toHaveClass("lg:grid-cols-1");
    expect(layout).not.toHaveClass("lg:grid-cols-[minmax(0,2fr)_320px]");
    expect(player).toHaveAttribute("data-is-expanded", "true");
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Detail" })).toBeInTheDocument();
  });

  it("caps the quick view height so the modal stays inside the viewport", () => {
    render(
      <QuickViewModal
        clip={clip}
        dict={dict}
        lang="ko"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog", { name: "Clip One" })).toHaveClass(
      "max-h-[calc(100vh-2rem)]",
      "overflow-y-auto"
    );
  });

  it("renders translated tag labels in english mode", () => {
    render(
      <QuickViewModal
        clip={clip}
        tagI18n={{
          "tag-a": "Tag A",
          "tag-b": "Tag B",
        }}
        dict={dict}
        lang="en"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Tag A")).toBeInTheDocument();
    expect(screen.getByText("Tag B")).toBeInTheDocument();
    expect(screen.queryByText("tag-a")).not.toBeInTheDocument();
  });

  it("loads clip detail on open and prefers fetched detail fields", async () => {
    mockClipDetailResponse({
      tags: ["detail-tag"],
      videoUrl: "/videos/detail-source.mp4",
    });

    render(
      <QuickViewModal
        clip={clip}
        dict={dict}
        lang="ko"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("video-player")).toHaveAttribute(
        "data-video-url",
        "/videos/detail-source.mp4"
      );
    });
    expect(screen.getByText("detail-tag")).toBeInTheDocument();
  });

  it("renders AI analysis from loaded detail data", async () => {
    mockClipDetailResponse({
      aiTags: {
        actionType: ["dash"],
        emotion: ["urgent"],
        composition: ["close-up"],
        pacing: "fast",
        characterType: ["hero"],
        effects: ["smear"],
        description: { ko: "AI 설명", en: "AI summary" },
        model: "gpt",
        generatedAt: "2026-03-27T00:00:00.000Z",
      },
    });

    render(
      <QuickViewModal
        clip={clip}
        dict={dict}
        lang="en"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("AI Analysis")).toBeInTheDocument();
    });
    expect(screen.getByText("AI summary")).toBeInTheDocument();
  });

  it("keeps quick-view-only sidebar sections instead of detail-page cards", async () => {
    render(
      <QuickViewModal
        clip={clip}
        dict={dict}
        lang="en"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("tag-a")).toBeInTheDocument();
    });

    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.queryByText("Memo")).not.toBeInTheDocument();
    expect(screen.queryByText("Properties")).not.toBeInTheDocument();
    expect(screen.queryByText("1280×720")).not.toBeInTheDocument();
  });
});
