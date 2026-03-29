import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import {
  loadBoardClipIds as loadBoardClipIdsFromStorage,
  loadBoardSummaries,
  type BoardSummary,
} from "@/lib/boardData";

export type Board = BoardSummary;

interface BoardState {
  boards: Board[];
  isLoading: boolean;
  /** Clip IDs for the currently active board filter (lazy-loaded) */
  activeBoardClipIds: Set<string> | null;
  activeBoardId: string | null;

  setBoards: (boards: Board[]) => void;
  setLoading: (loading: boolean) => void;
  addBoard: (board: Board) => void;
  removeBoard: (boardId: string) => void;
  updateBoard: (boardId: string, updates: Partial<Board>) => void;

  // Join-table based clip operations
  addClipToBoard: (boardId: string, clipId: string) => void;
  removeClipFromBoard: (boardId: string, clipId: string) => void;

  // Lazy load clip IDs for board filtering
  loadBoardClipIds: (boardId: string) => Promise<void>;
  clearActiveBoardClipIds: () => void;

  // Fetch boards from Supabase
  fetchBoards: () => Promise<void>;
}

export const useBoardStore = create<BoardState>()((set) => ({
  boards: [],
  isLoading: false,
  activeBoardClipIds: null,
  activeBoardId: null,

  setBoards: (boards) => set({ boards }),
  setLoading: (isLoading) => set({ isLoading }),

  addBoard: (board) =>
    set((state) => ({ boards: [...state.boards, board] })),

  removeBoard: (boardId) =>
    set((state) => ({
      boards: state.boards.filter((b) => b.id !== boardId),
      // Clear active board if it was deleted
      ...(state.activeBoardId === boardId
        ? { activeBoardId: null, activeBoardClipIds: null }
        : {}),
    })),

  updateBoard: (boardId, updates) =>
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId ? { ...b, ...updates } : b
      ),
    })),

  addClipToBoard: (boardId, clipId) =>
    set((state) => {
      const boards = state.boards.map((b) => {
        if (b.id !== boardId) return b;
        const coverClipIds =
          b.coverClipIds.includes(clipId)
            ? b.coverClipIds
            : [clipId, ...b.coverClipIds].slice(0, 3);
        return { ...b, clipCount: b.clipCount + 1, coverClipIds };
      });
      // Update active set if this is the active board
      const activeBoardClipIds =
        state.activeBoardId === boardId && state.activeBoardClipIds
          ? new Set([...state.activeBoardClipIds, clipId])
          : state.activeBoardClipIds;
      return { boards, activeBoardClipIds };
    }),

  removeClipFromBoard: (boardId, clipId) =>
    set((state) => {
      const boards = state.boards.map((b) =>
        b.id === boardId
          ? {
              ...b,
              clipCount: Math.max(0, b.clipCount - 1),
              coverClipIds: b.coverClipIds.filter((id) => id !== clipId),
            }
          : b
      );
      const activeBoardClipIds =
        state.activeBoardId === boardId && state.activeBoardClipIds
          ? (() => {
              const next = new Set(state.activeBoardClipIds);
              next.delete(clipId);
              return next;
            })()
          : state.activeBoardClipIds;
      return { boards, activeBoardClipIds };
    }),

  loadBoardClipIds: async (boardId: string) => {
    const supabase = createClient();
    if (!supabase) return;

    const clipIds = await loadBoardClipIdsFromStorage(supabase, boardId);
    set({
      activeBoardId: boardId,
      activeBoardClipIds: new Set(clipIds),
    });
  },

  clearActiveBoardClipIds: () =>
    set({ activeBoardId: null, activeBoardClipIds: null }),

  fetchBoards: async () => {
    const supabase = createClient();
    if (!supabase) return;

    set({ isLoading: true });
    const boards = await loadBoardSummaries(supabase);
    set({ boards });

    set({ isLoading: false });
  },
}));
