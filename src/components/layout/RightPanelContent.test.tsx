import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RightPanelContent } from "./RightPanelContent";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { CategoryTree } from "@/lib/types";

const useClipStoreMock = vi.fn();

vi.mock("@/stores/clipStore", () => ({
  useClipStore: () => useClipStoreMock(),
}));

vi.mock("./RightPanelInspector", () => ({
  RightPanelInspector: ({ clip }: { clip: { name: string } }) => (
    <div>Inspector: {clip.name}</div>
  ),
}));

const categories: CategoryTree = {};

const dict = {
  clip: {
    play: "재생",
    pause: "정지",
    speed: "속도",
    detail: "상세 보기",
    related: "관련 클립",
    tags: "태그",
    folders: "폴더",
    rating: "별점",
    memo: "메모",
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
  common: {
    close: "닫기",
    loading: "로딩 중...",
  },
} as Dictionary;

describe("RightPanelContent", () => {
  beforeEach(() => {
    useClipStoreMock.mockReset();
    vi.restoreAllMocks();
  });

  it("renders a loading state while the selected clip fetch is pending", () => {
    useClipStoreMock.mockReturnValue({
      selectedClipId: "clip-1",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>(() => {
            // Keep the request pending to exercise the intermediate loading state.
          })
      )
    );

    render(<RightPanelContent categories={categories} lang="ko" dict={dict} />);

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
    expect(screen.queryByText(/Inspector:/)).not.toBeInTheDocument();
  });
});
