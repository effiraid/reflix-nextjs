import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetViewHistoryStoreForTests,
  useViewHistoryStore,
  VIEW_HISTORY_WRITE_DELAY_MS,
} from "./viewHistoryStore";

const {
  fetchViewHistoryMock,
  recordViewHistoryBatchMock,
  deleteViewHistoryEntryMock,
  clearViewHistoryMock,
} = vi.hoisted(() => ({
  fetchViewHistoryMock: vi.fn(),
  recordViewHistoryBatchMock: vi.fn(),
  deleteViewHistoryEntryMock: vi.fn(),
  clearViewHistoryMock: vi.fn(),
}));

vi.mock("@/lib/viewHistoryClient", () => ({
  fetchViewHistoryEntries: fetchViewHistoryMock,
  recordViewHistoryBatch: recordViewHistoryBatchMock,
  deleteViewHistoryEntry: deleteViewHistoryEntryMock,
  clearViewHistory: clearViewHistoryMock,
}));

describe("viewHistoryStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetViewHistoryStoreForTests();
    fetchViewHistoryMock.mockReset();
    fetchViewHistoryMock.mockResolvedValue([]);
    recordViewHistoryBatchMock.mockReset();
    recordViewHistoryBatchMock.mockResolvedValue(undefined);
    deleteViewHistoryEntryMock.mockReset();
    deleteViewHistoryEntryMock.mockResolvedValue(undefined);
    clearViewHistoryMock.mockReset();
    clearViewHistoryMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads history once for a signed-in user", async () => {
    fetchViewHistoryMock.mockResolvedValue([
      { clipId: "clip-b", viewedAt: "2026-03-29T10:00:00.000Z" },
      { clipId: "clip-a", viewedAt: "2026-03-29T09:00:00.000Z" },
    ]);

    await Promise.all([
      useViewHistoryStore.getState().syncForUser("user-1"),
      useViewHistoryStore.getState().syncForUser("user-1"),
    ]);

    expect(fetchViewHistoryMock).toHaveBeenCalledTimes(1);
    expect(useViewHistoryStore.getState().entries).toEqual([
      { clipId: "clip-b", viewedAt: "2026-03-29T10:00:00.000Z" },
      { clipId: "clip-a", viewedAt: "2026-03-29T09:00:00.000Z" },
    ]);
  });

  it("optimistically updates the list and batches writes", async () => {
    await useViewHistoryStore.getState().syncForUser("user-1");

    useViewHistoryStore.getState().queueClipView("user-1", "clip-a");
    useViewHistoryStore.getState().queueClipView("user-1", "clip-b");

    expect(useViewHistoryStore.getState().entries.map((entry) => entry.clipId)).toEqual([
      "clip-b",
      "clip-a",
    ]);

    await vi.advanceTimersByTimeAsync(VIEW_HISTORY_WRITE_DELAY_MS);

    expect(recordViewHistoryBatchMock).toHaveBeenCalledTimes(1);
    expect(recordViewHistoryBatchMock).toHaveBeenCalledWith(["clip-a", "clip-b"]);
  });

  it("deduplicates repeated views inside the same batch while keeping the latest order", async () => {
    await useViewHistoryStore.getState().syncForUser("user-1");

    useViewHistoryStore.getState().queueClipView("user-1", "clip-a");
    useViewHistoryStore.getState().queueClipView("user-1", "clip-b");
    useViewHistoryStore.getState().queueClipView("user-1", "clip-a");

    expect(useViewHistoryStore.getState().entries.map((entry) => entry.clipId)).toEqual([
      "clip-a",
      "clip-b",
    ]);

    await vi.advanceTimersByTimeAsync(VIEW_HISTORY_WRITE_DELAY_MS);

    expect(recordViewHistoryBatchMock).toHaveBeenCalledWith(["clip-b", "clip-a"]);
  });

  it("removes a single entry optimistically and persists the delete", async () => {
    fetchViewHistoryMock.mockResolvedValue([
      { clipId: "clip-b", viewedAt: "2026-03-29T10:00:00.000Z" },
      { clipId: "clip-a", viewedAt: "2026-03-29T09:00:00.000Z" },
    ]);

    await useViewHistoryStore.getState().syncForUser("user-1");
    await useViewHistoryStore.getState().removeEntry("user-1", "clip-b");

    expect(useViewHistoryStore.getState().entries).toEqual([
      { clipId: "clip-a", viewedAt: "2026-03-29T09:00:00.000Z" },
    ]);
    expect(deleteViewHistoryEntryMock).toHaveBeenCalledWith("clip-b");
  });

  it("clears all entries optimistically and persists the clear", async () => {
    fetchViewHistoryMock.mockResolvedValue([
      { clipId: "clip-b", viewedAt: "2026-03-29T10:00:00.000Z" },
      { clipId: "clip-a", viewedAt: "2026-03-29T09:00:00.000Z" },
    ]);

    await useViewHistoryStore.getState().syncForUser("user-1");
    await useViewHistoryStore.getState().clearEntries("user-1");

    expect(useViewHistoryStore.getState().entries).toEqual([]);
    expect(clearViewHistoryMock).toHaveBeenCalledTimes(1);
  });
});
