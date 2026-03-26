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
  star: 4,
  annotation: "An energetic scene.",
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
    rating: "Rating",
    memo: "Memo",
    properties: "Properties",
    size: "Size",
    resolution: "Resolution",
    format: "Format",
    added: "Added",
    duration: "Duration",
    inspectorRating: "Rating",
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
  },
};

describe("ClipDetailView", () => {
  it("renders title, annotation, tags, and clip stats", () => {
    render(<ClipDetailView clip={baseClip} lang="ko" dict={dict} categories={categories} />);

    expect(screen.getByRole("heading", { name: "클립 하나" })).toBeInTheDocument();
    expect(screen.getByText("An energetic scene.")).toBeInTheDocument();
    expect(screen.getByText("tag-a")).toBeInTheDocument();
    expect(screen.getByText("1280×720")).toBeInTheDocument();
    expect(screen.getByText("512 KB")).toBeInTheDocument();
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

  it("renders folder labels from categories", () => {
    render(<ClipDetailView clip={baseClip} lang="ko" dict={dict} categories={categories} />);

    expect(screen.getByText("액션")).toBeInTheDocument();
  });

  it("centers palette swatches inside the palette card", () => {
    render(
      <ClipDetailView
        clip={{
          ...baseClip,
          palettes: [
            { color: [14, 13, 12], ratio: 66 },
            { color: [74, 81, 66], ratio: 9 },
          ],
        }}
        lang="ko"
        dict={dict}
        categories={categories}
      />
    );

    const paletteSection = screen.getByRole("heading", { name: "Color Palette" }).parentElement;
    const swatchRow = paletteSection?.querySelector(".flex.flex-wrap");

    expect(swatchRow).not.toBeNull();
    expect(swatchRow).toHaveClass("justify-center");
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
