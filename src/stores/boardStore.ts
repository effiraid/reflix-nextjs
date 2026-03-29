import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";

interface BoardClipRow {
  clip_id?: string | null;
  added_at?: string | null;
}

interface BoardClipMembershipRow extends BoardClipRow {
  board_id?: string | null;
}

function getCoverClipIds(boardClips: BoardClipRow[] | null | undefined): string[] {
  return [...(boardClips ?? [])]
    .filter((row): row is { clip_id: string; added_at?: string | null } =>
      typeof row?.clip_id === "string"
    )
    .sort(
      (a, b) =>
        new Date(b.added_at ?? 0).getTime() -
        new Date(a.added_at ?? 0).getTime()
    )
    .map((row) => row.clip_id)
    .slice(0, 3);
}

export interface Board {
  id: string;
  name: string;
  clipCount: number;
  coverClipIds: string[];
  created_at: string;
  updated_at: string;
}

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

export const useBoardStore = create<BoardState>()((set, get) => ({
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

    const { data } = await supabase
      .from("board_clips")
      .select("clip_id")
      .eq("board_id", boardId);

    if (data) {
      set({
        activeBoardId: boardId,
        activeBoardClipIds: new Set(
          data
            .map((row) => row.clip_id)
            .filter((clipId): clipId is string => typeof clipId === "string")
        ),
      });
    }
  },

  clearActiveBoardClipIds: () =>
    set({ activeBoardId: null, activeBoardClipIds: null }),

  fetchBoards: async () => {
    const supabase = createClient();
    if (!supabase) return;

    set({ isLoading: true });

    const { data: boardRows } = await supabase
      .from("boards")
      .select("id, name, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (boardRows) {
      const boardIds = boardRows
        .map((row) => row.id)
        .filter((boardId): boardId is string => typeof boardId === "string");
      const boardClipsByBoardId = new Map<string, BoardClipRow[]>();

      if (boardIds.length > 0) {
        const { data: boardClipRows } = await supabase
          .from("board_clips")
          .select("board_id, clip_id, added_at")
          .in("board_id", boardIds);

        for (const row of (boardClipRows ?? []) as BoardClipMembershipRow[]) {
          if (typeof row.board_id !== "string") continue;

          const boardClips = boardClipsByBoardId.get(row.board_id) ?? [];
          boardClips.push(row);
          boardClipsByBoardId.set(row.board_id, boardClips);
        }
      }

      const boards: Board[] = boardRows.map((row) => {
        const boardClips = boardClipsByBoardId.get(row.id) ?? [];
        return {
          id: row.id,
          name: row.name,
          created_at: row.created_at,
          updated_at: row.updated_at,
          clipCount: boardClips.length,
          coverClipIds: getCoverClipIds(boardClips),
        };
      });
      set({ boards });
    }

    set({ isLoading: false });
  },
}));
