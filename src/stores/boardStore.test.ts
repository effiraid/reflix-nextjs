import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardStore } from "./boardStore";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: createClientMock,
}));

describe("boardStore", () => {
  beforeEach(() => {
    useBoardStore.setState({
      boards: [],
      isLoading: false,
      activeBoardClipIds: null,
      activeBoardId: null,
    });
    createClientMock.mockReset();
  });

  it("loads boards and derives clip counts and covers from board_clips rows", async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: "board-1",
          name: "Favorites",
          created_at: "2026-03-29T00:00:00.000Z",
          updated_at: "2026-03-29T00:00:00.000Z",
          board_clips: [
            {
              clip_id: "clip-a",
              added_at: "2026-03-29T01:00:00.000Z",
            },
            {
              clip_id: "clip-b",
              added_at: "2026-03-29T02:00:00.000Z",
            },
          ],
        },
        {
          id: "board-2",
          name: "Combat",
          created_at: "2026-03-28T00:00:00.000Z",
          updated_at: "2026-03-28T00:00:00.000Z",
          board_clips: [
            {
              clip_id: "clip-c",
              added_at: "2026-03-28T01:00:00.000Z",
            },
            {
              clip_id: "clip-d",
              added_at: "2026-03-28T02:00:00.000Z",
            },
            {
              clip_id: "clip-e",
              added_at: "2026-03-28T03:00:00.000Z",
            },
            {
              clip_id: "clip-f",
              added_at: "2026-03-28T04:00:00.000Z",
            },
          ],
        },
      ],
    });
    const selectBoardsMock = vi.fn(() => ({
      order: orderMock,
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "boards") {
          return {
            select: selectBoardsMock,
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await useBoardStore.getState().fetchBoards();

    expect(selectBoardsMock).toHaveBeenCalledWith(
      "id, name, created_at, updated_at, board_clips(clip_id, added_at)"
    );
    expect(useBoardStore.getState().boards).toEqual([
      {
        id: "board-1",
        name: "Favorites",
        clipCount: 2,
        coverClipIds: ["clip-b", "clip-a"],
        created_at: "2026-03-29T00:00:00.000Z",
        updated_at: "2026-03-29T00:00:00.000Z",
      },
      {
        id: "board-2",
        name: "Combat",
        clipCount: 4,
        coverClipIds: ["clip-f", "clip-e", "clip-d"],
        created_at: "2026-03-28T00:00:00.000Z",
        updated_at: "2026-03-28T00:00:00.000Z",
      },
    ]);
    expect(useBoardStore.getState().isLoading).toBe(false);
  });

  it("loads active board clip ids from the board_clips table", async () => {
    const eqMock = vi.fn().mockResolvedValue({
      data: [{ clip_id: "clip-a" }, { clip_id: "clip-b" }],
    });
    const selectBoardClipsMock = vi.fn(() => ({
      eq: eqMock,
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "board_clips") {
          return {
            select: selectBoardClipsMock,
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await useBoardStore.getState().loadBoardClipIds("board-1");

    expect(selectBoardClipsMock).toHaveBeenCalledWith("clip_id");
    expect(eqMock).toHaveBeenCalledWith("board_id", "board-1");
    expect(useBoardStore.getState().activeBoardId).toBe("board-1");
    expect(Array.from(useBoardStore.getState().activeBoardClipIds ?? [])).toEqual([
      "clip-a",
      "clip-b",
    ]);
  });
});
