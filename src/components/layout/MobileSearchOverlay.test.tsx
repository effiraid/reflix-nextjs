import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileSearchOverlay } from "./MobileSearchOverlay";
import type { ClipIndex } from "@/lib/types";

const clips: ClipIndex[] = [
  {
    id: "clip-1",
    name: "슬픈 걷기",
    tags: ["걷기"],
    folders: [],
    star: 0,
    category: "acting",
    width: 100,
    height: 100,
    duration: 1,
    previewUrl: "/previews/clip-1.mp4",
    thumbnailUrl: "/thumbs/clip-1.webp",
    lqipBase64: "",
    aiTags: {
      actionType: ["걷기"],
      emotion: ["슬픔"],
      composition: ["풀샷"],
      pacing: "느림",
      characterType: ["전사"],
      effects: [],
      description: {
        ko: "슬픈 장면에서 천천히 걷는 모션",
        en: "A sad walk cycle",
      },
      model: "gemini-2.5-flash",
      generatedAt: "2026-03-26T00:00:00.000Z",
    },
  },
];

describe("MobileSearchOverlay", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("renders matching results inside the full-screen overlay", async () => {
    const handleSelectClip = vi.fn();

    render(
      <MobileSearchOverlay
        open
        clips={clips}
        searchReady
        lang="ko"
        tagI18n={{}}
        placeholder="클립 검색"
        closeLabel="닫기"
        noResultsLabel="결과 없음"
        loadingLabel="검색 준비 중..."
        onClose={vi.fn()}
        onSelectClip={handleSelectClip}
      />
    );

    const input = screen.getByRole("searchbox", { name: "클립 검색" });

    fireEvent.change(input, {
      target: { value: "슬픈" },
    });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    fireEvent.click(await screen.findByRole("button", { name: "슬픈 걷기" }));

    expect(handleSelectClip).toHaveBeenCalledWith("clip-1", "슬픈");
  });

  it("closes from the close button", () => {
    const handleClose = vi.fn();

    render(
      <MobileSearchOverlay
        open
        clips={clips}
        searchReady
        lang="ko"
        tagI18n={{}}
        placeholder="클립 검색"
        closeLabel="닫기"
        noResultsLabel="결과 없음"
        loadingLabel="검색 준비 중..."
        onClose={handleClose}
        onSelectClip={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(handleClose).toHaveBeenCalled();
  });

  it("shows translated english tags in result summaries", async () => {
    render(
      <MobileSearchOverlay
        open
        clips={clips}
        searchReady
        lang="en"
        tagI18n={{ 걷기: "Walk" }}
        placeholder="Search clips"
        closeLabel="Close"
        noResultsLabel="No results"
        loadingLabel="Preparing search..."
        onClose={vi.fn()}
        onSelectClip={vi.fn()}
      />
    );

    const input = screen.getByRole("searchbox", { name: "Search clips" });

    fireEvent.change(input, {
      target: { value: "walk" },
    });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(await screen.findByText("Walk")).toBeInTheDocument();
    expect(screen.queryByText("걷기")).not.toBeInTheDocument();
  });

  it("shows a loading state until projection-backed search is ready", async () => {
    render(
      <MobileSearchOverlay
        open
        clips={[]}
        searchReady={false}
        lang="ko"
        tagI18n={{}}
        placeholder="클립 검색"
        closeLabel="닫기"
        noResultsLabel="결과 없음"
        loadingLabel="검색 준비 중..."
        onClose={vi.fn()}
        onSelectClip={vi.fn()}
      />
    );

    const input = screen.getByRole("searchbox", { name: "클립 검색" });

    fireEvent.change(input, {
      target: { value: "슬픈" },
    });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(await screen.findByText("검색 준비 중...")).toBeInTheDocument();
    expect(screen.queryByText("결과 없음")).not.toBeInTheDocument();
  });
});
