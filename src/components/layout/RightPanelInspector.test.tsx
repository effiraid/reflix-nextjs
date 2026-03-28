import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RightPanelInspector } from "./RightPanelInspector";
import { useUIStore } from "@/stores/uiStore";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { CategoryTree, Clip } from "@/lib/types";

const { getMediaUrlMock } = vi.hoisted(() => ({
  getMediaUrlMock: vi.fn((path: string) => path),
}));

vi.mock("@/lib/mediaUrl", () => ({
  getMediaUrl: getMediaUrlMock,
}));

vi.mock("@/components/clip/ClipRatingPanel", () => ({
  ClipRatingPanel: () => <section data-testid="clip-rating-panel" />,
}));

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
    properties: "속성",
    size: "크기",
    resolution: "해상도",
    format: "포맷",
    added: "추가일",
    duration: "재생시간",
    inspectorDuration: "지속 시간",
    fileType: "파일 형식",
    share: "공유",
    copied: "복사됨",
    video: "동영상",
    image: "이미지",
    noLink: "링크 없음",
    colorPalette: "색상 팔레트",
    sourceUrl: "소스 URL",
    aiLatest: "NEW",
    aiAnalysis: "AI 분석",
    aiPending: "AI 분석 대기 중",
    tipClose: "닫기",
    tipPlayPause: "재생/정지",
    tipSeek: "1초 이동",
    tipFrame: "프레임 이동",
    tipSpeed: "속도 조절",
    tipLoop: "반복",
    tipInOut: "구간 설정",
    tipResetMarkers: "구간 초기화",
    tipMute: "음소거",
    tipFullscreen: "전체화면",
    tipExpand: "패널 확장",
    tipToggleHelp: "도움말 토글",
    tooltipPlay: "재생 (Space)",
    tooltipPause: "일시정지 (Space)",
    tooltipMute: "음소거 (M)",
    tooltipUnmute: "음소거 해제 (M)",
    tooltipTimeFrame: "시간 / 프레임",
    tooltipSpeed: "속도 (+/−)",
    tooltipLoop: "반복 (L)",
    tooltipExpand: "확장 (E)",
    tooltipFullscreen: "전체화면 (F)",
  },
};

describe("RightPanelInspector", () => {
  beforeEach(() => {
    getMediaUrlMock.mockClear();
    getMediaUrlMock.mockImplementation((path: string) => path);
    useUIStore.setState({
      quickViewOpen: false,
    });
  });

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
    expect(screen.getAllByText("동영상")).toHaveLength(2);
    expect(screen.queryByText("MP4")).not.toBeInTheDocument();
    expect(screen.queryByText("규격")).not.toBeInTheDocument();
    expect(screen.queryByText("파일 크기")).not.toBeInTheDocument();
    expect(getMediaUrlMock).toHaveBeenCalledWith(clip.thumbnailUrl);
    expect(getMediaUrlMock).toHaveBeenCalledWith(clip.previewUrl);
  });

  it("renders blank link as muted placeholder while keeping the share CTA enabled", () => {
    render(
      <RightPanelInspector
        clip={{
          ...clip,
          url: "",
        }}
        categories={categories}
        lang="ko"
        dict={dict}
      />
    );

    const linkPlaceholder = screen.getByText("링크 없음");
    const shareButton = screen.getByRole("button", { name: "공유" });

    expect(linkPlaceholder).toBeInTheDocument();
    expect(linkPlaceholder).toHaveClass("text-muted");
    expect(linkPlaceholder).toHaveClass("italic");
    expect(linkPlaceholder).not.toHaveClass("font-mono");
    expect(shareButton).toBeInTheDocument();
    expect(shareButton).not.toBeDisabled();
  });

  it("renders the palette swatches inside the properties section", () => {
    render(
      <RightPanelInspector
        clip={clip}
        categories={categories}
        lang="ko"
        dict={dict}
      />
    );

    const propertiesHeading = screen.getByText("속성");
    const propertiesSection = propertiesHeading.closest("section");
    const paletteLabel = screen.getByText("색상 팔레트");

    expect(propertiesSection).toContainElement(paletteLabel);
  });

  it("does not render the clip title below the palette card", () => {
    render(
      <RightPanelInspector
        clip={clip}
        categories={categories}
        lang="ko"
        dict={dict}
      />
    );

    expect(
      screen.queryByRole("heading", { name: "블레이드 스톰" })
    ).not.toBeInTheDocument();
  });

  it("renders image clips with a visible thumbnail and localized media labels", () => {
    render(
      <RightPanelInspector
        clip={{
          ...clip,
          ext: "png",
          previewUrl: "/previews/clip-1.png",
          thumbnailUrl: "/thumbs/clip-1.png",
        }}
        categories={categories}
        lang="ko"
        dict={dict}
      />
    );

    expect(screen.getAllByText("이미지")).toHaveLength(2);
    expect(screen.getByAltText("블레이드 스톰")).toBeInTheDocument();
    expect(screen.queryByText("PNG")).not.toBeInTheDocument();
    expect(getMediaUrlMock).toHaveBeenCalledWith("/thumbs/clip-1.png");
  });

  it("falls back to the inspector thumbnail when the preview video errors", () => {
    const { container } = render(
      <RightPanelInspector
        clip={clip}
        categories={categories}
        lang="ko"
        dict={dict}
      />
    );

    const preview = container.querySelector("video");

    expect(preview).not.toBeNull();

    fireEvent.error(preview!);

    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByAltText("블레이드 스톰")).toBeInTheDocument();
  });

  it("suppresses native download affordances on preview videos", () => {
    const { container } = render(
      <RightPanelInspector
        clip={clip}
        categories={categories}
        lang="ko"
        dict={dict}
      />
    );

    const preview = container.querySelector("video") as HTMLVideoElement;
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });

    preview.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(preview.getAttribute("controlsList")).toBe(
      "nodownload nofullscreen noremoteplayback"
    );
    expect(preview.hasAttribute("disablePictureInPicture")).toBe(true);
  });

  it("renders translated manual and AI tag labels in english mode", () => {
    render(
      <RightPanelInspector
        clip={{
          ...clip,
          tags: ["검"],
          aiTags: {
            actionType: ["비틀거리기"],
            emotion: ["고통"],
            composition: ["미디엄샷"],
            pacing: "느림",
            characterType: ["마법사"],
            effects: ["잔상"],
            description: {
              ko: "큰 충격 뒤 비틀거리며 일어나는 장면",
              en: "A staggered recovery motion",
            },
            model: "gemini-2.5-flash",
            generatedAt: "2026-03-26T00:00:00.000Z",
          },
        }}
        categories={categories}
        lang="en"
        tagI18n={{
          검: "Sword",
          비틀거리기: "Staggering",
          고통: "Suffering",
          미디엄샷: "Medium Shot",
          느림: "Slow",
          마법사: "Mage",
          잔상: "Afterimage",
        }}
        dict={{
          clip: {
            ...dict.clip,
            folders: "Folders",
            tags: "Tags",
            properties: "Properties",
            inspectorDuration: "Duration",
            fileType: "File Type",
            share: "Share",
            copied: "Copied",
            video: "Video",
            image: "Image",
            noLink: "No link",
            colorPalette: "Color Palette",
            sourceUrl: "Source URL",
            aiLatest: "NEW",
            aiAnalysis: "AI Analysis",
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
            related: "Related Clips",
            memo: "Memo",
          },
        }}
      />
    );

    expect(screen.getByText("Sword")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "AI Analysis" }));
    expect(screen.getByText("Staggering")).toBeInTheDocument();
    expect(screen.queryByText("비틀거리기")).not.toBeInTheDocument();
  });

  it("falls back to the thumbnail when quick view is open over browse", () => {
    useUIStore.setState({
      quickViewOpen: true,
    });

    const { container } = render(
      <RightPanelInspector
        clip={clip}
        categories={categories}
        lang="ko"
        dict={dict}
      />
    );

    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByAltText("블레이드 스톰")).toBeInTheDocument();
  });

  it("reveals AI analysis only after expanding the inspector section", () => {
    render(
      <RightPanelInspector
        clip={{
          ...clip,
          aiTags: {
            actionType: ["베기"],
            emotion: ["결의"],
            composition: ["클로즈업"],
            pacing: "빠름",
            characterType: ["전사"],
            effects: ["잔상"],
            description: {
              ko: "대검을 크게 휘두르는 공격 모션",
              en: "A powerful greatsword slash",
            },
            model: "gemini-2.5-flash",
            generatedAt: "2026-03-26T00:00:00.000Z",
          },
        }}
        categories={categories}
        lang="ko"
        dict={dict}
        relatedClips={[]}
      />
    );

    expect(screen.getByRole("button", { name: "AI 분석" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.queryByText("대검을 크게 휘두르는 공격 모션")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "AI 분석" }));

    expect(screen.getByText("대검을 크게 휘두르는 공격 모션")).toBeInTheDocument();
    expect(screen.getByText("베기")).toBeInTheDocument();
    expect(screen.getByText("결의")).toBeInTheDocument();
  });

  it("highlights the AI analysis card as a latest feature", () => {
    render(
      <RightPanelInspector
        clip={{
          ...clip,
          aiTags: {
            actionType: ["베기"],
            emotion: ["결의"],
            composition: ["클로즈업"],
            pacing: "빠름",
            characterType: ["전사"],
            effects: ["잔상"],
            description: {
              ko: "대검을 크게 휘두르는 공격 모션",
              en: "A powerful greatsword slash",
            },
            model: "gemini-2.5-flash",
            generatedAt: "2026-03-26T00:00:00.000Z",
          },
        }}
        categories={categories}
        lang="ko"
        dict={dict}
      />
    );

    const aiToggle = screen.getByRole("button", { name: "AI 분석" });
    const aiSection = aiToggle.closest("section");

    expect(screen.getByText("NEW")).toBeInTheDocument();
    expect(aiSection).not.toBeNull();
    expect(aiSection).toHaveClass("border-accent/35");
    expect(aiSection).toHaveClass("overflow-hidden");
  });

  it("uses a larger padded hit area for the AI analysis toggle", () => {
    render(
      <RightPanelInspector
        clip={{
          ...clip,
          aiTags: {
            actionType: ["베기"],
            emotion: ["결의"],
            composition: ["클로즈업"],
            pacing: "빠름",
            characterType: ["전사"],
            effects: ["잔상"],
            description: {
              ko: "대검을 크게 휘두르는 공격 모션",
              en: "A powerful greatsword slash",
            },
            model: "gemini-2.5-flash",
            generatedAt: "2026-03-26T00:00:00.000Z",
          },
        }}
        categories={categories}
        lang="ko"
        dict={dict}
      />
    );

    const aiToggle = screen.getByRole("button", { name: "AI 분석" });
    const aiSection = aiToggle.closest("section");

    expect(aiToggle).toHaveClass("min-h-12");
    expect(aiToggle).toHaveClass("px-4");
    expect(aiToggle).toHaveClass("py-4");
    expect(aiSection).not.toHaveClass("p-4");
  });

  it("invokes folder and tag navigation callbacks from the inspector badges", () => {
    const handleSelectFolder = vi.fn();
    const handleSelectTag = vi.fn();

    render(
      <RightPanelInspector
        clip={clip}
        categories={categories}
        lang="ko"
        dict={dict}
        onSelectFolder={handleSelectFolder}
        onSelectTag={handleSelectTag}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "필살기" }));
    fireEvent.click(screen.getByRole("button", { name: "검" }));

    expect(handleSelectFolder).toHaveBeenCalledWith("ultimate");
    expect(handleSelectTag).toHaveBeenCalledWith("검");
  });

  it("places the AI analysis section directly below the preview", () => {
    const { container } = render(
      <RightPanelInspector
        clip={{
          ...clip,
          aiTags: {
            actionType: ["베기"],
            emotion: ["결의"],
            composition: ["클로즈업"],
            pacing: "빠름",
            characterType: ["전사"],
            effects: ["잔상"],
            description: {
              ko: "대검을 크게 휘두르는 공격 모션",
              en: "A powerful greatsword slash",
            },
            model: "gemini-2.5-flash",
            generatedAt: "2026-03-26T00:00:00.000Z",
          },
        }}
        categories={categories}
        lang="ko"
        dict={dict}
      />
    );

    const inspector = container.firstElementChild as HTMLElement;
    const aiSection = container.querySelector(
      'section[aria-label="AI 분석"]'
    );

    expect(aiSection).not.toBeNull();
    // children[0] = preview, children[1] = AI analysis
    expect(inspector.children[1]).toBe(aiSection);
  });

  it("places folders and tags directly below the AI analysis section", () => {
    const { container } = render(
      <RightPanelInspector
        clip={{
          ...clip,
          aiTags: {
            actionType: ["베기"],
            emotion: ["결의"],
            composition: ["클로즈업"],
            pacing: "빠름",
            characterType: ["전사"],
            effects: ["잔상"],
            description: {
              ko: "대검을 크게 휘두르는 공격 모션",
              en: "A powerful greatsword slash",
            },
            model: "gemini-2.5-flash",
            generatedAt: "2026-03-26T00:00:00.000Z",
          },
        }}
        categories={categories}
        lang="ko"
        dict={dict}
      />
    );

    const inspector = container.firstElementChild as HTMLElement;
    const folderSection = screen
      .getByRole("heading", { name: "폴더" })
      .closest("section");
    const tagSection = screen
      .getByRole("heading", { name: "태그" })
      .closest("section");

    expect(folderSection).not.toBeNull();
    expect(tagSection).not.toBeNull();
    // children[0] = preview, children[1] = AI analysis, children[2] = my rating, children[3] = folders, children[4] = tags
    expect(inspector.children[3]).toBe(folderSection);
    expect(inspector.children[4]).toBe(tagSection);
  });

  it("renders a pending AI state and clickable related clips", () => {
    const handleSelectRelatedClip = vi.fn();

    render(
      <RightPanelInspector
        clip={{
          ...clip,
          aiTags: null,
        }}
        categories={categories}
        lang="ko"
        dict={dict}
        relatedClips={[
          {
            id: "clip-2",
            name: "Counter Slash",
            tags: ["검"],
            folders: [],
            category: "action",
            width: 120,
            height: 120,
            duration: 1,
            previewUrl: "/previews/clip-2.mp4",
            thumbnailUrl: "/thumbs/clip-2.webp",
            lqipBase64: "",
          },
        ]}
        onSelectRelatedClip={handleSelectRelatedClip}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "AI 분석" }));

    expect(screen.getByText("AI 분석 대기 중")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "관련 클립" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Counter Slash" }));

    expect(handleSelectRelatedClip).toHaveBeenCalledWith("clip-2");
  });

  it("renders inspector thumbnails without Next fill mode to avoid dev warnings on mount", () => {
    render(
      <RightPanelInspector
        clip={{
          ...clip,
          aiTags: null,
        }}
        categories={categories}
        lang="ko"
        dict={dict}
        relatedClips={[
          {
            id: "clip-2",
            name: "Counter Slash",
            tags: ["검"],
            folders: [],
            category: "action",
            width: 120,
            height: 120,
            duration: 1,
            previewUrl: "/previews/clip-2.mp4",
            thumbnailUrl: "/thumbs/clip-2.webp",
            lqipBase64: "",
          },
        ]}
      />
    );

    fireEvent.error(document.querySelector("video")!);

    expect(screen.getByAltText("블레이드 스톰")).not.toHaveAttribute("data-nimg", "fill");
    expect(screen.getByAltText("블레이드 스톰")).toHaveAttribute("loading", "eager");
    expect(screen.getByAltText("Counter Slash")).not.toHaveAttribute("data-nimg", "fill");
  });
});
