import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearViewHistory,
  deleteViewHistoryEntry,
  fetchViewHistoryEntries,
  recordViewHistoryBatch,
} from "./viewHistoryClient";

describe("viewHistoryClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty list when the viewer is not signed in", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchViewHistoryEntries()).resolves.toEqual([]);
  });

  it("returns timestamped entries from the account history endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        entries: [
          { clipId: "clip-3", viewedAt: "2026-03-29T10:00:00.000Z" },
          { clipId: "clip-1", viewedAt: "2026-03-29T09:00:00.000Z" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchViewHistoryEntries()).resolves.toEqual([
      { clipId: "clip-3", viewedAt: "2026-03-29T10:00:00.000Z" },
      { clipId: "clip-1", viewedAt: "2026-03-29T09:00:00.000Z" },
    ]);
  });

  it("records viewed clips through the batch history endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    await recordViewHistoryBatch(["clip-7", "clip-8"]);

    expect(fetchMock).toHaveBeenCalledWith("/api/view-history", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipIds: ["clip-7", "clip-8"] }),
    });
  });

  it("deletes a single account history entry", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    await deleteViewHistoryEntry("clip-7");

    expect(fetchMock).toHaveBeenCalledWith("/api/view-history?clipId=clip-7", {
      method: "DELETE",
    });
  });

  it("clears account history through the account history endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    await clearViewHistory();

    expect(fetchMock).toHaveBeenCalledWith("/api/view-history", {
      method: "DELETE",
    });
  });
});
