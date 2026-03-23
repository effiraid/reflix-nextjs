import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RightPanelInspector } from "./RightPanelInspector";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { CategoryTree, Clip } from "@/lib/types";

const categories: CategoryTree = {
  combat: {
    slug: "combat",
    i18n: { ko: "전투", en: "Combat" },
    children: {
      ultimate: {
        slug: "ultimate",
        i18n: { ko: "필살기", en: "Ultimate" },
      },
    },
  },
};

const clip: Clip = {
  id: "clip-1",
  name: "Blade Storm",
  ext: "mp4",
  size: 2048,
  width: 1920,
  height: 1080,
  duration: 65.1,
  tags: ["검"],
  folders: ["ultimate"],
  star: 4,
  annotation: "연계 마무리용",
  url: "https://example.com/share/clip-1",
  palettes: [
    { color: [12, 34, 56], ratio: 40 },
    { color: [78, 90, 120], ratio: 30 },
  ],
  btime: 0,
  mtime: 0,
  i18n: {
    title: { ko: "블레이드 스톰", en: "Blade Storm" },
    description: { ko: "", en: "" },
  },
  videoUrl: "/videos/clip-1.mp4",
  thumbnailUrl: "/thumbs/clip-1.webp",
  previewUrl: "/previews/clip-1.mp4",
  lqipBase64: "",
  category: "action",
  relatedClips: [],
};

const dict: Pick<Dictionary, "clip"> = {
  clip: {
    play: "재생",
    pause: "정지",
    speed: "속도",
    detail: "상세 보기",
    related: "관련 클립",
    memo: "메모",
    folders: "폴더",
    tags: "태그",
    rating: "별점",
    properties: "속성",
    size: "크기",
    resolution: "해상도",
    format: "포맷",
    added: "추가일",
    duration: "재생시간",
    inspectorRating: "평가",
    inspectorDuration: "지속 시간",
    fileType: "파일 형식",
    share: "공유",
    video: "동영상",
    image: "이미지",
    noLink: "링크 없음",
    colorPalette: "색상 팔레트",
    sourceUrl: "소스 URL",
  },
};

describe("RightPanelInspector", () => {
  it("renders the localized inspector fields without deprecated metadata", () => {
    render(
      <RightPanelInspector
        clip={clip}
        categories={categories}
        lang="ko"
        dict={dict}
      />
    );

    expect(screen.getByText("필살기")).toBeInTheDocument();
    expect(screen.getByText("검")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "공유" })).toBeInTheDocument();
    expect(screen.getByText("동영상")).toBeInTheDocument();
    expect(screen.getByText("MP4")).toBeInTheDocument();
    expect(screen.queryByText("규격")).not.toBeInTheDocument();
    expect(screen.queryByText("파일 크기")).not.toBeInTheDocument();
  });

  it("renders blank memo and link as muted placeholders while keeping the share CTA enabled", () => {
    render(
      <RightPanelInspector
        clip={{
          ...clip,
          annotation: "",
          url: "",
        }}
        categories={categories}
        lang="ko"
        dict={dict}
      />
    );

    const memoPlaceholder = screen.getByText("-");
    const linkPlaceholder = screen.getByText("링크 없음");
    const shareButton = screen.getByRole("button", { name: "공유" });

    expect(memoPlaceholder).toBeInTheDocument();
    expect(memoPlaceholder).toHaveClass("text-muted");
    expect(memoPlaceholder).toHaveClass("italic");
    expect(linkPlaceholder).toBeInTheDocument();
    expect(linkPlaceholder).toHaveClass("text-muted");
    expect(linkPlaceholder).toHaveClass("italic");
    expect(linkPlaceholder).not.toHaveClass("font-mono");
    expect(shareButton).toBeInTheDocument();
    expect(shareButton).not.toBeDisabled();
  });
});
