import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

const {
  getDictionary,
  getClipIndex,
  getTagGroups,
  getTagI18n,
  landingStatsSpy,
} = vi.hoisted(() => ({
  getDictionary: vi.fn(),
  getClipIndex: vi.fn(),
  getTagGroups: vi.fn(),
  getTagI18n: vi.fn(),
  landingStatsSpy: vi.fn(),
}));

vi.mock("./dictionaries", () => ({
  getDictionary,
}));

vi.mock("@/lib/data", () => ({
  getClipIndex,
  getTagGroups,
  getTagI18n,
  loadLandingStats: () => Promise.resolve(null),
}));

vi.mock("./LandingNavbar", () => ({
  LandingNavbar: () => <div>Landing Navbar</div>,
}));

vi.mock("./LandingHero", () => ({
  LandingHero: () => <div>Landing Hero</div>,
}));

vi.mock("./LandingFeatures", () => ({
  LandingFeatures: () => <div>Landing Features</div>,
}));

vi.mock("./LandingPricing", () => ({
  LandingPricing: () => <div>Landing Pricing</div>,
}));

vi.mock("./LandingCTA", () => ({
  LandingCTA: () => <div>Landing CTA</div>,
}));

vi.mock("./LandingStats", () => ({
  LandingStats: (props: unknown) => {
    landingStatsSpy(props);
    return <div data-testid="landing-stats" />;
  },
}));

describe("HomePage", () => {
  beforeEach(() => {
    landingStatsSpy.mockClear();
    getDictionary.mockResolvedValue({
      landing: {
        heroTitle: "히어로 타이틀",
        heroSub: "히어로 설명",
        statsClips: "큐레이션된 클립",
        statsAiRecommendedTags: "AI 추천 태그",
        statsTags: "태그",
      },
      nav: {},
      auth: {},
      pricing: {},
    });
    getClipIndex.mockResolvedValue({
      totalCount: 20,
      clips: [
        {
          id: "clip-1",
          name: "Clip 1",
          thumbnailUrl: "/thumb-1.webp",
          previewUrl: "/preview-1.mp4",
          lqipBase64: "",
          width: 1920,
          height: 1080,
          duration: 2.4,
          category: "action",
          aiTags: {
            actionType: ["달리기", "공격", "피하기"],
            emotion: ["긴장", "분노"],
            composition: ["클로즈업", "로우앵글"],
            pacing: "빠름",
            characterType: ["전사", "인간"],
            effects: ["파티클", "잔상"],
            description: {
              ko: "설명",
              en: "Description",
            },
            model: "gemini-test",
            generatedAt: "2026-03-27T00:00:00.000Z",
          },
        },
        {
          id: "clip-2",
          name: "Clip 2",
          thumbnailUrl: "/thumb-2.webp",
          previewUrl: "/preview-2.mp4",
          lqipBase64: "",
          width: 1920,
          height: 1080,
          duration: 2.4,
          category: "action",
          aiTags: {
            actionType: ["걷기", "점프", "착지"],
            emotion: ["집중", "놀람"],
            composition: ["미디엄샷", "하이앵글"],
            pacing: "보통",
            characterType: ["마법사", "인간"],
            effects: ["빛", "카메라흔들림"],
            description: {
              ko: "설명",
              en: "Description",
            },
            model: "gemini-test",
            generatedAt: "2026-03-27T00:00:00.000Z",
          },
        },
      ],
    });
    getTagGroups.mockResolvedValue({
      groups: [
        {
          id: "movement",
          name: { ko: "움직임", en: "Movement" },
          parent: "motion",
          tags: ["달리기", "걷기"],
        },
        {
          id: "combat",
          name: { ko: "전투", en: "Combat" },
          parent: "action",
          tags: ["공격"],
        },
      ],
      parentGroups: [],
    });
    getTagI18n.mockResolvedValue({});
  });

  it("passes the full-library AI recommendation tag count instead of the tag group count", async () => {
    render(
      await HomePage({
        params: Promise.resolve({ lang: "ko" }),
      })
    );

    expect(screen.getByTestId("landing-stats")).toBeInTheDocument();
    expect(landingStatsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        clipCount: 20,
        aiRecommendationCount: 23,
        tagCount: 3,
        dict: expect.objectContaining({
          statsAiRecommendedTags: "AI 추천 태그",
        }),
      })
    );
  });
});
