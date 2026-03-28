import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClipDetailView } from "./ClipDetailView";
import type { CategoryTree, Clip } from "@/lib/types";

vi.mock("@/components/clip/ShareButton", () => ({
  ShareButton: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));

vi.mock("@/components/clip/VideoPlayer", () => ({
  VideoPlayer: ({
    videoUrl,
    thumbnailUrl,
  }: {
    videoUrl: string;
    thumbnailUrl: string;
  }) => (
    <div
      data-testid="video-player"
      data-video-url={videoUrl}
      data-thumbnail-url={thumbnailUrl}
    />
  ),
}));

const baseClip: Clip = {
  id: "clip-1",
  name: "Clip One",
  ext: "mp4",
  size: 1024 * 512,
  width: 1280,
  height: 720,
  duration: 18.4,
  tags: ["tag-a", "tag-b"],
  folders: ["folder-a"],
  url: "https://example.com",
  palettes: [],
  btime: 1710000000,
  mtime: 1710000000,
  i18n: {
    title: { ko: "클립 하나", en: "Clip One" },
    description: { ko: "", en: "" },
  },
  videoUrl: "/videos/clip-1.mp4",
  thumbnailUrl: "/thumbnails/clip-1.webp",
  previewUrl: "/previews/clip-1.mp4",
  lqipBase64: "",
  category: "action",
  relatedClips: ["clip-2", "clip-3"],
  aiTags: {
    actionType: ["dash"],
    emotion: ["urgent"],
    composition: ["close-up"],
    pacing: "fast",
    characterType: ["hero"],
    effects: ["smear"],
    description: {
      ko: "AI 설명",
      en: "AI summary",
    },
    model: "gpt",
    generatedAt: "2026-03-27T00:00:00.000Z",
  },
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
    detail: "Detail",
    related: "Related Clips",
    tags: "Tags",
    folders: "Folders",
    memo: "Memo",
    properties: "Properties",
    size: "Size",
    resolution: "Resolution",
    format: "Format",
    added: "Added",
    duration: "Duration",
    inspectorDuration: "Duration",
    fileType: "File Type",
    share: "Share",
    video: "Video",
    image: "Image",
    noLink: "No link",
    colorPalette: "Color Palette",
    sourceUrl: "Source URL",
    copied: "Copied",
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
};

describe("ClipDetailView", () => {
  it("renders inspector-style sidebar cards on the detail page", () => {
    render(<ClipDetailView clip={baseClip} lang="ko" dict={dict} categories={categories} />);

    expect(screen.getByText("액션")).toBeInTheDocument();
    expect(screen.getByText("tag-a")).toBeInTheDocument();
    expect(screen.getByText("AI Analysis")).toBeInTheDocument();
    expect(screen.getByText("Source URL")).toBeInTheDocument();
    expect(screen.getByText("https://example.com")).toBeInTheDocument();
    expect(screen.getByText("File Type")).toBeInTheDocument();
    expect(screen.getByText("Video")).toBeInTheDocument();
  });

  it("passes the hosted media paths to VideoPlayer", () => {
    render(<ClipDetailView clip={baseClip} lang="en" dict={dict} categories={categories} />);

    expect(screen.getByTestId("video-player")).toHaveAttribute(
      "data-video-url",
      "/videos/clip-1.mp4"
    );
    expect(screen.getByTestId("video-player")).toHaveAttribute(
      "data-thumbnail-url",
      "/thumbnails/clip-1.webp"
    );
  });

  it("matches the inspector by hiding AI details until expanded", () => {
    render(<ClipDetailView clip={baseClip} lang="ko" dict={dict} categories={categories} />);

    expect(screen.getByRole("button", { name: "AI Analysis" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.queryByText("AI 설명")).not.toBeInTheDocument();
  });

  it("renders translated english tag labels", () => {
    render(
      <ClipDetailView
        clip={{
          ...baseClip,
          tags: ["고통", "마법사"],
        }}
        lang="en"
        tagI18n={{
          고통: "Suffering",
          마법사: "Mage",
        }}
        dict={dict}
        categories={categories}
      />
    );

    expect(screen.getByText("Suffering")).toBeInTheDocument();
    expect(screen.getByText("Mage")).toBeInTheDocument();
    expect(screen.queryByText("고통")).not.toBeInTheDocument();
  });
});
