import { fireEvent, render, screen } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { LandingFeatures } from "./LandingFeatures";
import type { BrowseClipRecord } from "@/lib/types";

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

vi.mock("@/lib/mediaUrl", () => ({
  getMediaUrl: (path: string) => path,
}));

vi.mock("@/components/clip/VideoPlayer", () => ({
  VideoPlayer: ({
    videoUrl,
    thumbnailUrl,
    duration,
    playbackRate,
    onPlaybackRateChange,
    autoPlayMuted,
    useBlobUrl,
  }: {
    videoUrl: string;
    thumbnailUrl: string;
    duration: number;
    playbackRate?: number;
    onPlaybackRateChange?: (rate: number) => void;
    autoPlayMuted?: boolean;
    useBlobUrl?: boolean;
  }) => (
    <div
      data-testid="landing-feature-player"
      data-video-url={videoUrl}
      data-thumbnail-url={thumbnailUrl}
      data-duration={duration}
      data-playback-rate={playbackRate}
      data-autoplay-muted={String(autoPlayMuted)}
      data-use-blob-url={String(useBlobUrl)}
    >
      <button type="button" onClick={() => onPlaybackRateChange?.(0.5)}>
        cycle-speed
      </button>
    </div>
  ),
}));

const baseClip: BrowseClipRecord = {
  id: "clip-1",
  name: "Clip 1",
  thumbnailUrl: "/thumb.webp",
  previewUrl: "/preview.mp4",
  lqipBase64: "",
  width: 1920,
  height: 1080,
  duration: 2.4,
  star: 5,
  category: "direction",
};

const dict = {
  featuresTitle: "원하는 모션을 찾는 가장 빠른 방법",
  featuresSub: "태그 탐색. AI 분석. 프레임 재생.",
  featureTagTitle: "태그 기반 탐색",
  featureTagDesc: "태그 설명",
  featureTagBadges: "아케인,달리기,힘듦",
  featureAiTitle: "AI 클립 분석",
  featureAiDesc: "AI가 동작, 감정, 스타일을 읽어냅니다.",
  featureAiBadge: "AI: 감정-경이로움 / 동작-감탄",
  featurePlayerTitle: "프레임 단위 재생",
  featurePlayerDesc: "프레임 설명",
  featurePlayerBadge: "0.25x | frame 24/60",
};

const tagI18n = {
  힘듦: "Weariness",
  심호흡: "Deep breath",
  슬픔: "Sadness",
  숨쉬기: "Breathing",
};

const englishDict = {
  ...dict,
  featuresTitle: "The fastest way to find the motion you need",
  featuresSub: "Tag search. AI analysis. Frame playback.",
  featureTagTitle: "Tag-Based Search",
  featureTagDesc: "Tag copy",
  featureAiTitle: "AI Clip Analysis",
  featureAiDesc: "AI reads action, emotion, and style.",
  featureAiBadge: "AI: Emotion-Weariness / Action-Deep breath",
  featurePlayerTitle: "Frame-by-Frame Playback",
  featurePlayerDesc: "Player copy",
};

function createClip(id: string, withAiDescription = false): BrowseClipRecord {
  return {
    ...baseClip,
    id,
    name: `Clip ${id}`,
    tags: ["아케인", "달리기"],
    aiTags: withAiDescription
      ? {
          actionType: ["숨쉬기"],
          emotion: ["슬픔"],
          composition: ["클로즈업"],
          pacing: "느림",
          characterType: ["애니메이션 캐릭터"],
          effects: ["색수차"],
          description: {
            ko: "클립은 보라색 빛과 색수차 효과가 두드러진 캐릭터의 눈에 대한 익스트림 클로즈업으로 시작합니다.",
            en: "The clip opens with an extreme close-up of a character's eye with purple light and chromatic aberration.",
          },
          model: "gemini-test",
          generatedAt: "2026-03-27T00:00:00.000Z",
        }
      : null,
  };
}

describe("LandingFeatures", () => {
  it("shows the clip AI summary inside the thumbnail in Korean", () => {
    render(
      <LandingFeatures
        lang="ko"
        tagI18n={{}}
        featureClips={[
          createClip("clip-1"),
          createClip("clip-2", true),
          createClip("clip-3"),
        ]}
        dict={dict}
      />
    );

    expect(screen.getByText("AI 분석")).toBeInTheDocument();
    expect(
      screen.getByText(/보라색 빛과 색수차 효과가 두드러진 캐릭터의 눈/)
    ).toBeInTheDocument();
    expect(
      screen.getByText("AI: 감정-슬픔 / 동작-숨쉬기")
    ).toBeInTheDocument();
  });

  it("uses the English AI summary when the landing page is English", () => {
    render(
      <LandingFeatures
        lang="en"
        tagI18n={tagI18n}
        featureClips={[
          createClip("clip-1"),
          createClip("clip-2", true),
          createClip("clip-3"),
        ]}
        dict={englishDict}
      />
    );

    expect(screen.getByText("AI Analysis")).toBeInTheDocument();
    expect(
      screen.getByText(/The clip opens with an extreme close-up/)
    ).toBeInTheDocument();
    expect(
      screen.getByText("AI: Emotion-Sadness / Action-Breathing")
    ).toBeInTheDocument();
  });

  it("renders the reusable video player for the frame playback feature", () => {
    render(
      <LandingFeatures
        lang="ko"
        tagI18n={{}}
        featureClips={[
          createClip("clip-1"),
          createClip("clip-2", true),
          createClip("clip-3"),
        ]}
        dict={dict}
      />
    );

    const player = screen.getByTestId("landing-feature-player");
    expect(player).toHaveAttribute("data-video-url", "/preview.mp4");
    expect(player).toHaveAttribute("data-thumbnail-url", "/thumb.webp");
    expect(player).toHaveAttribute("data-duration", "2.4");
    expect(player).toHaveAttribute("data-playback-rate", "0.25");
    expect(player).toHaveAttribute("data-autoplay-muted", "true");
    expect(player).toHaveAttribute("data-use-blob-url", "true");
  });

  it("wires playback rate changes for the landing feature player", () => {
    render(
      <LandingFeatures
        lang="ko"
        tagI18n={{}}
        featureClips={[
          createClip("clip-1"),
          createClip("clip-2", true),
          createClip("clip-3"),
        ]}
        dict={dict}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "cycle-speed" }));

    expect(screen.getByTestId("landing-feature-player")).toHaveAttribute(
      "data-playback-rate",
      "0.5"
    );
  });
});
