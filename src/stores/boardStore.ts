import { create } from "zustand";

export interface Board {
  id: string;
  name: string;
  clip_ids: string[];
  created_at: string;
  updated_at: string;
}

interface BoardState {
  boards: Board[];
  isLoading: boolean;

  setBoards: (boards: Board[]) => void;
  setLoading: (loading: boolean) => void;
  addBoard: (board: Board) => void;
  removeBoard: (boardId: string) => void;
  updateBoard: (boardId: string, updates: Partial<Board>) => void;
  addClipToBoard: (boardId: string, clipId: string) => void;
  removeClipFromBoard: (boardId: string, clipId: string) => void;
}

export const useBoardStore = create<BoardState>()((set) => ({
  boards: [],
  isLoading: false,

  setBoards: (boards) => set({ boards }),
  setLoading: (isLoading) => set({ isLoading }),

  addBoard: (board) =>
    set((state) => ({ boards: [...state.boards, board] })),

  removeBoard: (boardId) =>
    set((state) => ({
      boards: state.boards.filter((b) => b.id !== boardId),
    })),

  updateBoard: (boardId, updates) =>
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId ? { ...b, ...updates } : b
      ),
    })),

  addClipToBoard: (boardId, clipId) =>
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId && !b.clip_ids.includes(clipId)
          ? { ...b, clip_ids: [...b.clip_ids, clipId] }
          : b
      ),
    })),

  removeClipFromBoard: (boardId, clipId) =>
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId
          ? { ...b, clip_ids: b.clip_ids.filter((id) => id !== clipId) }
          : b
      ),
    })),
}));
