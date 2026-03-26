import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RightPanelContent } from "./RightPanelContent";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { CategoryTree } from "@/lib/types";

const useClipStoreMock = vi.fn();
const updateURLMock = vi.fn();

vi.mock("@/stores/clipStore", () => ({
  useClipStore: () => useClipStoreMock(),
}));

vi.mock("@/hooks/useFilterSync", () => ({
  useFilterSync: () => ({
    updateURL: updateURLMock,
  }),
}));

vi.mock("./RightPanelInspector", () => ({
  RightPanelInspector: ({
    clip,
    onSelectFolder,
    onSelectTag,
  }: {
    clip: { name: string };
    onSelectFolder?: (folderId: string) => void;
    onSelectTag?: (tag: string) => void;
  }) => (
    <div>
      <div>Inspector: {clip.name}</div>
      <button type="button" onClick={() => onSelectFolder?.("ultimate")}>
        필살기
      </button>
      <button type="button" onClick={() => onSelectTag?.("검")}>
        검
      </button>
    </div>
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
    loadFailed: "클립을 불러오지 못했습니다.",
  },
} as Dictionary;

describe("RightPanelContent", () => {
  beforeEach(() => {
    useClipStoreMock.mockReset();
    updateURLMock.mockReset();
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

  it("renders an error state when the selected clip fetch fails", async () => {
    useClipStoreMock.mockReturnValue({
      selectedClipId: "missing-clip",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
        } as Response)
      )
    );

    render(<RightPanelContent categories={categories} lang="ko" dict={dict} />);

    expect(
      await screen.findByText("클립을 불러오지 못했습니다.")
    ).toBeInTheDocument();
    expect(screen.queryByText("로딩 중...")).not.toBeInTheDocument();
    expect(screen.queryByText(/Inspector:/)).not.toBeInTheDocument();
  });

  it("replaces folder filters when a folder badge is clicked in the inspector", async () => {
    const setSelectedClipId = vi.fn();

    useClipStoreMock.mockReturnValue({
      selectedClipId: "clip-1",
      setSelectedClipId,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "clip-1",
              name: "Blade Storm",
            }),
        } as Response)
      )
    );

    render(<RightPanelContent categories={categories} lang="ko" dict={dict} />);

    fireEvent.click(await screen.findByRole("button", { name: "필살기" }));

    expect(updateURLMock).toHaveBeenCalledWith({
      selectedFolders: ["ultimate"],
      selectedTags: [],
      excludedTags: [],
    });
    expect(setSelectedClipId).not.toHaveBeenCalled();
  });

  it("replaces tag filters when a tag badge is clicked in the inspector", async () => {
    const setSelectedClipId = vi.fn();

    useClipStoreMock.mockReturnValue({
      selectedClipId: "clip-1",
      setSelectedClipId,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "clip-1",
              name: "Blade Storm",
            }),
        } as Response)
      )
    );

    render(<RightPanelContent categories={categories} lang="ko" dict={dict} />);

    fireEvent.click(await screen.findByRole("button", { name: "검" }));

    expect(updateURLMock).toHaveBeenCalledWith({
      selectedTags: ["검"],
      selectedFolders: [],
      excludedTags: [],
    });
    expect(setSelectedClipId).not.toHaveBeenCalled();
  });
});
