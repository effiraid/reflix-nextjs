"use client";

import { useCallback, useEffect, useState } from "react";
import { PlusIcon, TrashIcon, FolderIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useBoardStore, type Board } from "@/stores/boardStore";
import type { Locale } from "@/lib/types";

interface BoardPanelProps {
  lang: Locale;
  selectedClipId?: string | null;
}

const BOARD_LIMIT_FREE = 1;

export function BoardPanel({ lang, selectedClipId }: BoardPanelProps) {
  const { user, tier } = useAuthStore();
  const { boards, setBoards, addBoard, removeBoard, addClipToBoard, removeClipFromBoard } =
    useBoardStore();
  const [newBoardName, setNewBoardName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const isKo = lang === "ko";

  const loadBoards = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    if (!supabase) return;
    const { data } = await supabase
      .from("boards")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setBoards(data as Board[]);
  }, [user, setBoards]);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  if (!user) {
    return (
      <div className="p-4 text-center text-xs text-muted">
        {isKo ? "보드를 사용하려면 로그인하세요" : "Sign in to use boards"}
      </div>
    );
  }

  const canCreateBoard =
    tier === "pro" || boards.length < BOARD_LIMIT_FREE;

  async function handleCreateBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!newBoardName.trim() || !canCreateBoard) return;

    setIsCreating(true);
    const supabase = createClient();
    if (!supabase) {
      setIsCreating(false);
      return;
    }
    const { data, error } = await supabase
      .from("boards")
      .insert({ user_id: user!.id, name: newBoardName.trim() })
      .select()
      .single();

    if (data && !error) {
      addBoard(data as Board);
      setNewBoardName("");
    }
    setIsCreating(false);
  }

  async function handleDeleteBoard(boardId: string) {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.from("boards").delete().eq("id", boardId);
    removeBoard(boardId);
  }

  async function handleToggleClip(boardId: string) {
    if (!selectedClipId) return;

    const board = boards.find((b) => b.id === boardId);
    if (!board) return;

    const supabase = createClient();
    if (!supabase) return;
    const hasClip = board.clip_ids.includes(selectedClipId);

    if (hasClip) {
      const newIds = board.clip_ids.filter((id) => id !== selectedClipId);
      await supabase
        .from("boards")
        .update({ clip_ids: newIds })
        .eq("id", boardId);
      removeClipFromBoard(boardId, selectedClipId);
    } else {
      const newIds = [...board.clip_ids, selectedClipId];
      await supabase
        .from("boards")
        .update({ clip_ids: newIds })
        .eq("id", boardId);
      addClipToBoard(boardId, selectedClipId);
    }
  }

  return (
    <div className="space-y-3 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
        {isKo ? "보드" : "Boards"}
      </h3>

      {boards.length === 0 ? (
        <p className="text-xs text-muted">
          {isKo
            ? "아직 보드가 없어요. 첫 보드를 만들어보세요"
            : "No boards yet. Create your first board"}
        </p>
      ) : (
        <ul className="space-y-1">
          {boards.map((board) => {
            const hasClip = selectedClipId
              ? board.clip_ids.includes(selectedClipId)
              : false;
            return (
              <li
                key={board.id}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-surface-hover"
              >
                <FolderIcon className="size-3.5 shrink-0 text-muted" strokeWidth={1.75} />
                <span className="flex-1 truncate">{board.name}</span>
                <span className="text-muted">{board.clip_ids.length}</span>
                {selectedClipId ? (
                  <button
                    type="button"
                    onClick={() => handleToggleClip(board.id)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      hasClip
                        ? "bg-accent/20 text-accent"
                        : "bg-foreground/5 text-muted hover:bg-foreground/10"
                    }`}
                  >
                    {hasClip
                      ? isKo ? "제거" : "Remove"
                      : isKo ? "추가" : "Add"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleDeleteBoard(board.id)}
                  className="p-0.5 rounded text-muted hover:text-red-500"
                  aria-label={isKo ? "보드 삭제" : "Delete board"}
                >
                  <TrashIcon className="size-3" strokeWidth={1.75} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {canCreateBoard ? (
        <form onSubmit={handleCreateBoard} className="flex gap-1.5">
          <input
            type="text"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            placeholder={isKo ? "새 보드 이름" : "New board name"}
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={isCreating || !newBoardName.trim()}
            className="rounded bg-foreground/10 p-1 hover:bg-foreground/20 disabled:opacity-40"
            aria-label={isKo ? "보드 만들기" : "Create board"}
          >
            <PlusIcon className="size-3.5" strokeWidth={2} />
          </button>
        </form>
      ) : (
        <p className="text-xs text-muted">
          {isKo
            ? "무료 계정은 보드 1개까지. Pro로 업그레이드하세요."
            : "Free accounts are limited to 1 board. Upgrade to Pro."}
        </p>
      )}
    </div>
  );
}
