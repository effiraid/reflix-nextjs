import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileSearchOverlay } from "./MobileSearchOverlay";
import type { ClipIndex } from "@/lib/types";
import { searchBrowseClipIds } from "@/lib/browsePagefind";
import { searchClips } from "@/lib/clipSearch";

vi.mock("@/lib/browsePagefind", () => ({
  searchBrowseClipIds: vi.fn(async () => []),
}));

vi.mock("@/lib/clipSearch", () => ({
  searchClips: vi.fn(() => []),
}));

const clips: ClipIndex[] = [
  {
    id: "clip-1",
    name: "슬픈 걷기",
    tags: ["걷기"],
    folders: [],
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
    vi.mocked(searchBrowseClipIds).mockReset();
    vi.mocked(searchBrowseClipIds).mockResolvedValue([]);
    vi.mocked(searchClips).mockReset();
    vi.mocked(searchClips).mockReturnValue([]);
  });

  it("renders Pagefind-ranked results without using local fallback on the success path", async () => {
    const handleSelectClip = vi.fn();
    vi.mocked(searchBrowseClipIds).mockResolvedValue(["clip-1"]);

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

    expect(searchBrowseClipIds).toHaveBeenCalledWith("ko", "슬픈");
    expect(searchClips).not.toHaveBeenCalled();
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
    vi.mocked(searchBrowseClipIds).mockResolvedValue(["clip-1"]);

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

    expect(searchBrowseClipIds).toHaveBeenCalledWith("en", "walk");
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

  it("requests search preparation as soon as the overlay opens", () => {
    const onRequestSearchReady = vi.fn();

    render(
      <MobileSearchOverlay
        open
        clips={clips}
        searchReady={false}
        lang="ko"
        tagI18n={{}}
        placeholder="클립 검색"
        closeLabel="닫기"
        noResultsLabel="결과 없음"
        loadingLabel="검색 준비 중..."
        onClose={vi.fn()}
        onRequestSearchReady={onRequestSearchReady}
        onSelectClip={vi.fn()}
      />
    );

    expect(onRequestSearchReady).toHaveBeenCalledTimes(1);
  });

  it("keeps the searchbar dropdown out of the mobile overlay so result taps stay unobstructed", () => {
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
        onSelectClip={vi.fn()}
        popularTags={["아케인"]}
      />
    );

    const input = screen.getByRole("searchbox", { name: "클립 검색" });

    fireEvent.focus(input);
    fireEvent.change(input, {
      target: { value: "슬픈" },
    });

    expect(
      screen.queryByRole("listbox", { name: "태그 제안" })
    ).not.toBeInTheDocument();
  });

  it("falls back to local search results when Pagefind rejects", async () => {
    vi.mocked(searchBrowseClipIds).mockRejectedValue(new Error("pagefind down"));
    vi.mocked(searchClips).mockReturnValue([clips[0]]);

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
        onSelectClip={vi.fn()}
      />
    );

    const input = screen.getByRole("searchbox", { name: "클립 검색" });

    fireEvent.change(input, {
      target: { value: "fallback-only" },
    });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(searchBrowseClipIds).toHaveBeenCalledWith("ko", "fallback-only");
    expect(await screen.findByRole("button", { name: "슬픈 걷기" })).toBeInTheDocument();
    expect(searchClips).toHaveBeenCalledWith(
      clips,
      expect.objectContaining({
        lang: "ko",
        query: "fallback-only",
        tagI18n: {},
      })
    );
  });

  it("resets query and prior results after close then reopen", async () => {
    vi.mocked(searchBrowseClipIds).mockResolvedValue(["clip-1"]);

    function Harness() {
      const [open, setOpen] = useState(true);

      return (
        <div>
          <button type="button" onClick={() => setOpen((value) => !value)}>
            toggle
          </button>
          <MobileSearchOverlay
            key={open ? "mobile-search-open" : "mobile-search-closed"}
            open={open}
            clips={clips}
            searchReady
            lang="ko"
            tagI18n={{}}
            placeholder="클립 검색"
            closeLabel="닫기"
            noResultsLabel="결과 없음"
            loadingLabel="검색 준비 중..."
            onClose={() => setOpen(false)}
            onSelectClip={vi.fn()}
          />
        </div>
      );
    }

    render(<Harness />);

    const input = screen.getByRole("searchbox", { name: "클립 검색" });
    fireEvent.change(input, {
      target: { value: "슬픈" },
    });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(await screen.findByRole("button", { name: "슬픈 걷기" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog", { name: "클립 검색" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));

    const reopenedInput = screen.getByRole("searchbox", { name: "클립 검색" });
    expect(reopenedInput).toHaveValue("");
    expect(screen.queryByRole("button", { name: "슬픈 걷기" })).not.toBeInTheDocument();
  });
});
