import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingHero } from "./LandingHero";
import type { BrowseClipRecord } from "@/lib/types";

vi.mock("@/lib/mediaUrl", () => ({
  getMediaUrl: (path: string) => path,
}));

const clip: BrowseClipRecord = {
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
  heroTitle: "게임 애니메이션\n레퍼런스 라이브러리",
  heroTitleMobile: "게임 애니메이션\n레퍼런스\n라이브러리",
  heroTitleMobileCompact: "게임\n애니메이션\n레퍼런스\n라이브러리",
  heroSub: "프로 애니메이터와 학생을 위한 모션 레퍼런스.",
  heroSubMobile: "프로 애니메이터와 학생을 위한\n모션 레퍼런스.",
  heroCta: "무료로 탐색 시작하기",
  heroCtaSub: "가입 없이 바로 시작 — 50개 무료 클립",
  heroPills: "연출,전투,감정",
};

function mockMatchMedia(matchingQueries: string[]) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: matchingQueries.includes(query),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe("LandingHero", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses mobile-specific copy on small screens", () => {
    mockMatchMedia(["(max-width: 768px)"]);

    const { container } = render(
      <LandingHero lang="ko" clips={[clip]} dict={dict} />
    );

    expect(container.querySelector("h1")?.textContent).toBe(
      "게임 애니메이션\n레퍼런스\n라이브러리"
    );
    expect(container.querySelector("p")?.textContent).toBe(
      "프로 애니메이터와 학생을 위한\n모션 레퍼런스."
    );
  });

  it("uses compact title copy on very narrow screens", () => {
    mockMatchMedia(["(max-width: 768px)", "(max-width: 360px)"]);

    const { container } = render(
      <LandingHero lang="ko" clips={[clip]} dict={dict} />
    );

    expect(container.querySelector("h1")?.textContent).toBe(
      "게임\n애니메이션\n레퍼런스\n라이브러리"
    );
  });

  it("keeps the default copy on larger screens", () => {
    mockMatchMedia([]);

    const { container } = render(
      <LandingHero lang="ko" clips={[clip]} dict={dict} />
    );

    expect(container.querySelector("h1")?.textContent).toBe(
      "게임 애니메이션\n레퍼런스 라이브러리"
    );
    expect(container.querySelector("p")?.textContent).toBe(
      "프로 애니메이터와 학생을 위한 모션 레퍼런스."
    );
  });

  it("animates the mock browse thumbnails under the hero CTA", () => {
    mockMatchMedia([]);

    render(
      <LandingHero
        lang="ko"
        clips={[
          clip,
          { ...clip, id: "clip-2", previewUrl: "/preview-2.mp4", thumbnailUrl: "/thumb-2.webp" },
          { ...clip, id: "clip-3", previewUrl: "/preview-3.mp4", thumbnailUrl: "/thumb-3.webp" },
        ]}
        dict={dict}
      />
    );

    const gridPreviews = screen.getAllByTestId("landing-hero-mock-grid-preview");
    expect(gridPreviews).toHaveLength(3);
    // MockBrowseUI uses static thumbnails (img) instead of video for performance
    expect(gridPreviews[0]).toHaveAttribute("src", "/thumb.webp");

    expect(screen.getByTestId("landing-hero-mock-inspector-preview")).toHaveAttribute(
      "src",
      "/thumb.webp"
    );
  });
});
