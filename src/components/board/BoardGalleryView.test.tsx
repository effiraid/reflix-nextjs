import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BoardGalleryView } from "./BoardGalleryView";

const { updateFilterURLMock, clearActiveBoardClipIdsMock } = vi.hoisted(() => ({
  updateFilterURLMock: vi.fn(),
  clearActiveBoardClipIdsMock: vi.fn(),
}));

const fetchBoardsMock = vi.fn();
const addBoardMock = vi.fn();
const loadBoardClipIdsMock = vi.fn();
const setBrowseModeMock = vi.fn();
const requestDetailedIndexMock = vi.fn();

const boardState = {
  boards: [
    {
      id: "board-1",
      name: "Favorites",
      clipCount: 1,
      coverClipIds: ["clip-99"],
      created_at: "2026-03-29T00:00:00.000Z",
      updated_at: "2026-03-29T00:00:00.000Z",
    },
  ],
  fetchBoards: fetchBoardsMock,
  addBoard: addBoardMock,
  loadBoardClipIds: loadBoardClipIdsMock,
  clearActiveBoardClipIds: clearActiveBoardClipIdsMock,
};

vi.mock("next/navigation", () => ({
  usePathname: () => "/ko/browse",
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/mediaUrl", () => ({
  getMediaUrl: (value: string) => value,
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({
    user: { id: "user-1", email: "user@example.com" },
    tier: "pro",
  }),
}));

vi.mock("@/stores/boardStore", () => ({
  useBoardStore: (selector?: (state: typeof boardState) => unknown) =>
    selector ? selector(boardState) : boardState,
}));

vi.mock("@/stores/uiStore", () => ({
  useUIStore: (selector: (state: { setBrowseMode: typeof setBrowseModeMock }) => unknown) =>
    selector({ setBrowseMode: setBrowseModeMock }),
}));

vi.mock("@/hooks/useFilterSync", () => ({
  updateFilterURL: updateFilterURLMock,
}));

vi.mock("@/stores/filterStore", () => ({
  useFilterStore: (selector: (state: { boardId: string | null }) => unknown) =>
    selector({ boardId: "board-1" }),
}));

vi.mock("@/app/[lang]/browse/ClipDataProvider", () => ({
  useBrowseData: () => ({
    initialClips: [],
    requestDetailedIndex: requestDetailedIndexMock,
  }),
  useClipData: () => [
    {
      id: "clip-99",
      name: "Clip 99",
      thumbnailUrl: "/thumbnails/clip-99.webp",
      previewUrl: "/previews/clip-99.mp4",
      lqipBase64: "",
      width: 100,
      height: 100,
      duration: 1,
      category: "action",
    },
  ],
}));

describe("BoardGalleryView", () => {
  beforeEach(() => {
    fetchBoardsMock.mockReset();
    addBoardMock.mockReset();
    loadBoardClipIdsMock.mockReset();
    setBrowseModeMock.mockReset();
    requestDetailedIndexMock.mockReset();
    updateFilterURLMock.mockReset();
    clearActiveBoardClipIdsMock.mockReset();
  });

  it("renders board cover images from the full clip dataset, not just initial browse items", () => {
    const dict = {
      browse: {
        all: "전체",
        myBoards: "내 보드",
      },
      board: {
        title: "보드",
        empty: "빈 보드",
        newBoardPlaceholder: "보드 이름",
        create: "만들기",
        delete: "삭제",
        add: "추가",
        remove: "제거",
        freeLimitNotice: "제한",
        signInNotice: "로그인",
        galleryEmpty: "비어 있음",
        galleryNewBoard: "새 보드",
      },
    } as const;

    const { container } = render(<BoardGalleryView lang="ko" dict={dict as never} />);

    expect(
      container.querySelector('img[src="/thumbnails/clip-99.webp"]')
    ).not.toBeNull();
  });

  it("clears the active board filter when returning to the all-clips view", () => {
    const dict = {
      browse: {
        all: "전체",
        myBoards: "내 보드",
      },
      board: {
        title: "보드",
        empty: "빈 보드",
        newBoardPlaceholder: "보드 이름",
        create: "만들기",
        delete: "삭제",
        add: "추가",
        remove: "제거",
        freeLimitNotice: "제한",
        signInNotice: "로그인",
        galleryEmpty: "비어 있음",
        galleryNewBoard: "새 보드",
      },
    } as const;

    render(<BoardGalleryView lang="ko" dict={dict as never} />);

    fireEvent.click(screen.getByRole("button", { name: "전체" }));

    expect(setBrowseModeMock).toHaveBeenCalledWith("grid");
    expect(clearActiveBoardClipIdsMock).toHaveBeenCalledTimes(1);
    expect(updateFilterURLMock).toHaveBeenCalledWith("/ko/browse", {
      boardId: null,
    });
  });
});
