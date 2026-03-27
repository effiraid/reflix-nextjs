import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickViewModal } from "./QuickViewModal";
import { clearClipDetailCache } from "@/lib/clip-detail-client";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { CategoryTree, ClipIndex } from "@/lib/types";

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

const categories: CategoryTree = {
  "folder-a": {
    slug: "action",
    i18n: { ko: "액션", en: "Action" },
  },
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
    rating: "Rating",
    added: "Added",
    duration: "Duration",
    inspectorRating: "Rating",
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
    share: "Share",
    copied: "Copied",
  },
} satisfies Pick<Dictionary, "clip">;

const defaultDetailOverrides = {
  ext: "mp4",
  size: 1024 * 512,
  folders: ["folder-a"],
  annotation: "An energetic scene.",
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
        categories={categories}
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
        categories={categories}
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
          categories={categories}
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
        categories={categories}
        lang="ko"
        dict={dict}
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
        categories={categories}
        lang="ko"
        dict={dict}
        onClose={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Clip One" });
    const layout = dialog.querySelector("div.grid");

    expect(layout).toHaveClass("lg:items-start");
  });

  it("renders translated tag labels in english mode", () => {
    render(
      <QuickViewModal
        clip={clip}
        categories={categories}
        lang="en"
        tagI18n={{
          "tag-a": "Tag A",
          "tag-b": "Tag B",
        }}
        dict={dict}
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
        categories={categories}
        lang="ko"
        dict={dict}
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

  it("matches the detail side panel by omitting the quick-view-only AI card", async () => {
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
        categories={categories}
        lang="en"
        dict={dict}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Clip One" })).toBeInTheDocument();
    });
    expect(screen.queryByText("AI Analysis")).not.toBeInTheDocument();
    expect(screen.queryByText("AI summary")).not.toBeInTheDocument();
  });

  it("renders the same metadata sections as the detail side panel once detail is loaded", async () => {
    render(
      <QuickViewModal
        clip={clip}
        categories={categories}
        lang="en"
        dict={dict}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Clip One" })).toBeInTheDocument();
    });

    expect(screen.getByText("An energetic scene.")).toBeInTheDocument();
    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(screen.getByText("512 KB")).toBeInTheDocument();
    expect(screen.getByText("1280×720")).toBeInTheDocument();
    expect(screen.getByText("MP4 · Video")).toBeInTheDocument();
  });
});
