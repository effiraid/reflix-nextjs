import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import koDict from "@/app/[lang]/dictionaries/ko.json";
import { useAuthStore } from "@/stores/authStore";
import {
  resetViewHistoryStoreForTests,
  useViewHistoryStore,
} from "@/stores/viewHistoryStore";
import { ViewHistoryPanel } from "./ViewHistoryPanel";

const {
  fetchViewHistoryEntriesMock,
  recordViewHistoryBatchMock,
  deleteViewHistoryEntryMock,
  clearViewHistoryMock,
} = vi.hoisted(() => ({
  fetchViewHistoryEntriesMock: vi.fn(),
  recordViewHistoryBatchMock: vi.fn(),
  deleteViewHistoryEntryMock: vi.fn(),
  clearViewHistoryMock: vi.fn(),
}));

vi.mock("@/lib/viewHistoryClient", () => ({
  fetchViewHistoryEntries: fetchViewHistoryEntriesMock,
  recordViewHistoryBatch: recordViewHistoryBatchMock,
  deleteViewHistoryEntry: deleteViewHistoryEntryMock,
  clearViewHistory: clearViewHistoryMock,
}));

vi.mock("@/components/clip/ClipCard", () => ({
  ClipCard: ({ clip }: { clip: { id: string; name: string } }) => (
    <div data-testid="history-clip-card" data-clip-id={clip.id}>
      {clip.name}
    </div>
  ),
}));

const clips = [
  {
    id: "clip-a",
    name: "Alpha",
    tags: [],
    folders: [],
    category: "action",
    width: 100,
    height: 100,
    duration: 1,
    previewUrl: "/a.mp4",
    thumbnailUrl: "/a.jpg",
    lqipBase64: "",
  },
  {
    id: "clip-b",
    name: "Beta",
    tags: [],
    folders: [],
    category: "action",
    width: 100,
    height: 100,
    duration: 1,
    previewUrl: "/b.mp4",
    thumbnailUrl: "/b.jpg",
    lqipBase64: "",
  },
];

describe("ViewHistoryPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T10:00:00.000Z"));
    resetViewHistoryStoreForTests();
    useAuthStore.setState({
      user: { id: "user-1" } as never,
      tier: "free",
      planTier: "free",
      accessSource: "free",
      betaEndsAt: null,
      isLoading: false,
    });
    fetchViewHistoryEntriesMock.mockReset();
    fetchViewHistoryEntriesMock.mockResolvedValue([]);
    recordViewHistoryBatchMock.mockReset();
    recordViewHistoryBatchMock.mockResolvedValue(undefined);
    deleteViewHistoryEntryMock.mockReset();
    deleteViewHistoryEntryMock.mockResolvedValue(undefined);
    clearViewHistoryMock.mockReset();
    clearViewHistoryMock.mockResolvedValue(undefined);
  });

  it("shows a loading state instead of the empty state before history loads", () => {
    useViewHistoryStore.setState({
      userId: "user-1",
      entries: [],
      isLoading: true,
      hasLoaded: false,
    });

    render(
      <ViewHistoryPanel
        initialClips={clips}
        projectionClips={clips.map((clip) => ({ ...clip, aiStructuredTags: [], searchTokens: [] }))}
        projectionStatus="ready"
        lang="ko"
        tagI18n={{}}
        dict={koDict as never}
        onOpenQuickView={vi.fn()}
      />
    );

    expect(screen.getByText(koDict.common.loading)).toBeInTheDocument();
    expect(screen.queryByText(koDict.browse.historyEmpty)).not.toBeInTheDocument();
  });

  it("renders relative viewed times and removes a single entry", async () => {
    useViewHistoryStore.setState({
      userId: "user-1",
      entries: [
        { clipId: "clip-b", viewedAt: "2026-03-29T09:55:00.000Z" },
        { clipId: "clip-a", viewedAt: "2026-03-29T09:00:00.000Z" },
      ],
      isLoading: false,
      hasLoaded: true,
    });

    render(
      <ViewHistoryPanel
        initialClips={clips}
        projectionClips={clips.map((clip) => ({ ...clip, aiStructuredTags: [], searchTokens: [] }))}
        projectionStatus="ready"
        lang="ko"
        tagI18n={{}}
        dict={koDict as never}
        onOpenQuickView={vi.fn()}
      />
    );

    expect(screen.getByText("5분 전")).toBeInTheDocument();
    expect(screen.getByText("1시간 전")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Beta 기록 삭제"));
      await Promise.resolve();
    });

    expect(deleteViewHistoryEntryMock).toHaveBeenCalledWith("clip-b");
    expect(
      screen.getAllByTestId("history-clip-card").map((card) => card.getAttribute("data-clip-id"))
    ).toEqual(["clip-a"]);
  });
});
