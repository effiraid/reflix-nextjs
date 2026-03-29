import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadBoardClipIds,
  loadBoardIdsForClip,
  loadBoardSummaries,
  persistBoardClipMembership,
  resetBoardStorageModeForTests,
} from "./boardData";

describe("boardData", () => {
  beforeEach(() => {
    resetBoardStorageModeForTests();
  });

  it("falls back to boards.clip_ids when the join table is unavailable", async () => {
    const boardOrderMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            id: "board-1",
            name: "Legacy",
            created_at: "2026-03-29T00:00:00.000Z",
            updated_at: "2026-03-29T00:00:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "board-1",
            name: "Legacy",
            clip_ids: ["clip-a", "clip-b"],
            created_at: "2026-03-29T00:00:00.000Z",
            updated_at: "2026-03-29T00:00:00.000Z",
          },
        ],
      });

    const selectBoardsMock = vi.fn(() => ({
      order: boardOrderMock,
    }));
    const selectBoardClipsMock = vi.fn(() => ({
      in: async () => ({
        data: null,
        error: { code: "PGRST205", message: "Could not find board_clips" },
      }),
    }));

    const client = {
      from: vi.fn((table: string) => {
        if (table === "boards") {
          return {
            select: selectBoardsMock,
          };
        }

        if (table === "board_clips") {
          return {
            select: selectBoardClipsMock,
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    await expect(loadBoardSummaries(client)).resolves.toEqual([
      {
        id: "board-1",
        name: "Legacy",
        clipCount: 2,
        coverClipIds: ["clip-b", "clip-a"],
        created_at: "2026-03-29T00:00:00.000Z",
        updated_at: "2026-03-29T00:00:00.000Z",
      },
    ]);
  });

  it("loads board membership from legacy clip_ids rows", async () => {
    const selectBoardClipsMock = vi.fn(() => ({
      eq: async () => ({
        data: null,
        error: { code: "PGRST205", message: "board_clips missing" },
      }),
    }));
    const selectBoardsMock = vi.fn((columns: string) => {
      if (columns === "clip_ids") {
        return {
          eq: () => ({
            single: async () => ({ data: { clip_ids: ["clip-a", "clip-b"] } }),
          }),
        };
      }

      return {
        order: async () => ({ data: [] }),
      };
    });

    const client = {
      from: vi.fn((table: string) => {
        if (table === "board_clips") {
          return { select: selectBoardClipsMock };
        }

        if (table === "boards") {
          return { select: selectBoardsMock };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    await expect(loadBoardClipIds(client, "board-1")).resolves.toEqual([
      "clip-a",
      "clip-b",
    ]);
  });

  it("finds clip membership and writes clip_ids directly in legacy mode", async () => {
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: updateEqMock }));
    const selectBoardsMock = vi.fn((columns: string) => {
      if (columns === "clip_ids") {
        return {
          eq: () => ({
            single: async () => ({ data: { clip_ids: ["clip-a"] } }),
          }),
        };
      }

      if (columns === "id, clip_ids") {
        return Promise.resolve({
          data: [{ id: "board-1", clip_ids: ["clip-a"] }],
          error: null,
        });
      }

      return {
        order: async () => ({ data: [] }),
      };
    });
    const selectBoardClipsMock = vi.fn(() => ({
      eq: async () => ({
        data: null,
        error: { code: "PGRST205", message: "board_clips missing" },
      }),
    }));
    const rpcMock = vi.fn();

    const client = {
      from: vi.fn((table: string) => {
        if (table === "boards") {
          return {
            select: selectBoardsMock,
            update: updateMock,
          };
        }

        if (table === "board_clips") {
          return { select: selectBoardClipsMock };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
      rpc: rpcMock,
    };

    await expect(loadBoardIdsForClip(client, "clip-a")).resolves.toEqual([
      "board-1",
    ]);

    await expect(
      persistBoardClipMembership(client, "board-1", "clip-b", true)
    ).resolves.toEqual({ error: null });

    expect(rpcMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith({ clip_ids: ["clip-a", "clip-b"] });
    expect(updateEqMock).toHaveBeenCalledWith("id", "board-1");
  });
});
