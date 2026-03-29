"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookmarkIcon,
  MoreHorizontalIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FREE_BOARD_LIMIT, hasProAccess } from "@/lib/accessPolicy";
import { getBoardLimitNotice } from "@/lib/boardLimitNotice";
import { useAuthStore } from "@/stores/authStore";
import { useBoardStore } from "@/stores/boardStore";
import { useFilterStore } from "@/stores/filterStore";
import { updateFilterURL } from "@/hooks/useFilterSync";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/types";

interface BoardSectionProps {
  lang: Locale;
}

export function BoardSection({ lang }: BoardSectionProps) {
  const { user, tier } = useAuthStore();
  const {
    boards,
    fetchBoards,
    addBoard,
    removeBoard,
    updateBoard,
    loadBoardClipIds,
    clearActiveBoardClipIds,
  } = useBoardStore();
  const boardId = useFilterStore((s) => s.boardId);
  const pathname = usePathname();
  const [newBoardName, setNewBoardName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showNewBoardForm, setShowNewBoardForm] = useState(false);
  const [menuBoardId, setMenuBoardId] = useState<string | null>(null);
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const isKo = lang === "ko";

  useEffect(() => {
    if (user) {
      fetchBoards();
    }
  }, [user, fetchBoards]);

  // Load clip IDs when board filter is set from URL
  useEffect(() => {
    if (boardId) {
      loadBoardClipIds(boardId);
    }
  }, [boardId, loadBoardClipIds]);

  const handleBoardClick = useCallback(
    (clickedBoardId: string) => {
      if (boardId === clickedBoardId) {
        // Deactivate board filter
        clearActiveBoardClipIds();
        updateFilterURL(pathname, { boardId: null });
      } else {
        // Activate board filter
        loadBoardClipIds(clickedBoardId);
        updateFilterURL(pathname, { boardId: clickedBoardId });
      }
    },
    [boardId, pathname, loadBoardClipIds, clearActiveBoardClipIds]
  );

  const handleCreateBoard = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const name = newBoardName.trim();
      if (!name || isCreating || !user) return;

      const supabase = createClient();
      if (!supabase) return;

      setIsCreating(true);
      const { data, error } = await supabase
        .from("boards")
        .insert({ user_id: user.id, name })
        .select()
        .single();

      if (data && !error) {
        addBoard({
          id: data.id,
          name: data.name,
          clipCount: 0,
          coverClipIds: [],
          created_at: data.created_at,
          updated_at: data.updated_at,
        });
        setNewBoardName("");
        setShowNewBoardForm(false);
      }
      setIsCreating(false);
    },
    [newBoardName, isCreating, user, addBoard]
  );

  const handleDeleteBoard = useCallback(
    async (deleteBoardId: string) => {
      const supabase = createClient();
      if (!supabase) return;

      await supabase.from("boards").delete().eq("id", deleteBoardId);
      removeBoard(deleteBoardId);
      setMenuBoardId(null);

      // If the deleted board was active, clear the filter
      if (boardId === deleteBoardId) {
        clearActiveBoardClipIds();
        updateFilterURL(pathname, { boardId: null });
      }
    },
    [boardId, pathname, removeBoard, clearActiveBoardClipIds]
  );

  const handleStartRename = useCallback(
    (rBoardId: string) => {
      const board = boards.find((b) => b.id === rBoardId);
      if (!board) return;
      setRenamingBoardId(rBoardId);
      setRenameValue(board.name);
      setMenuBoardId(null);
    },
    [boards]
  );

  const handleRenameSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!renamingBoardId || !renameValue.trim()) return;

      const supabase = createClient();
      if (!supabase) return;

      await supabase
        .from("boards")
        .update({ name: renameValue.trim() })
        .eq("id", renamingBoardId);
      updateBoard(renamingBoardId, { name: renameValue.trim() });
      setRenamingBoardId(null);
    },
    [renamingBoardId, renameValue, updateBoard]
  );

  if (!user) {
    return (
      <div className="p-3">
        <h3 className="flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          <BookmarkIcon className="size-3.5" strokeWidth={1.75} />
          {isKo ? "내 보드" : "My Boards"}
        </h3>
        <p className="mt-2 px-2 text-xs text-muted">
          {isKo ? "로그인하세요" : "Sign in to use boards"}
        </p>
      </div>
    );
  }

  const canCreateBoard =
    hasProAccess(user, tier) || boards.length < FREE_BOARD_LIMIT;

  return (
    <div className="p-3 space-y-1">
      <div className="flex items-center justify-between px-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          <BookmarkIcon className="size-3.5" strokeWidth={1.75} />
          {isKo ? "내 보드" : "My Boards"}
        </h3>
        {canCreateBoard ? (
          <button
            type="button"
            onClick={() => setShowNewBoardForm((prev) => !prev)}
            className="rounded p-0.5 text-muted hover:text-foreground"
            aria-label={isKo ? "새 보드" : "New board"}
          >
            <PlusIcon className="size-3.5" strokeWidth={2} />
          </button>
        ) : null}
      </div>

      {showNewBoardForm && canCreateBoard ? (
        <form onSubmit={handleCreateBoard} className="px-2">
          <input
            type="text"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value.slice(0, 50))}
            placeholder={isKo ? "보드 이름" : "Board name"}
            maxLength={50}
            autoFocus
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-accent"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setShowNewBoardForm(false);
                setNewBoardName("");
              }
            }}
          />
        </form>
      ) : null}

      {boards.length === 0 ? (
        <p className="px-2 text-xs text-muted">
          {isKo
            ? "보드를 만들어 클립을 저장하세요"
            : "Create a board to save clips"}
        </p>
      ) : (
        <ul className="space-y-0.5">
          {boards.map((board) => {
            const isActive = boardId === board.id;
            const isRenaming = renamingBoardId === board.id;

            if (isRenaming) {
              return (
                <li key={board.id} className="px-2">
                  <form onSubmit={handleRenameSubmit}>
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) =>
                        setRenameValue(e.target.value.slice(0, 50))
                      }
                      maxLength={50}
                      autoFocus
                      className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-accent"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setRenamingBoardId(null);
                      }}
                      onBlur={handleRenameSubmit}
                    />
                  </form>
                </li>
              );
            }

            return (
              <li key={board.id} className="group/board relative">
                <button
                  type="button"
                  onClick={() => handleBoardClick(board.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                    isActive
                      ? "bg-accent/10 text-accent"
                      : "text-foreground hover:bg-surface-hover"
                  }`}
                >
                  <BookmarkIcon
                    className="size-3.5 shrink-0"
                    strokeWidth={1.75}
                    fill={isActive ? "currentColor" : "none"}
                  />
                  <span className="flex-1 truncate text-left">{board.name}</span>
                  <span className="text-muted text-[10px]">{board.clipCount}</span>
                </button>

                {/* Context menu trigger */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuBoardId(
                      menuBoardId === board.id ? null : board.id
                    );
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted opacity-0 hover:text-foreground group-hover/board:opacity-100"
                  aria-label="옵션"
                >
                  <MoreHorizontalIcon className="size-3.5" strokeWidth={1.75} />
                </button>

                {/* Inline context menu */}
                {menuBoardId === board.id ? (
                  <BoardContextMenu
                    onRename={() => handleStartRename(board.id)}
                    onDelete={() => handleDeleteBoard(board.id)}
                    onClose={() => setMenuBoardId(null)}
                    isKo={isKo}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {!canCreateBoard ? (
        <p className="px-2 text-[10px] text-muted">
          {getBoardLimitNotice({
            lang: isKo ? "ko" : "en",
            boardCount: boards.length,
            limit: FREE_BOARD_LIMIT,
          }).split("\n")[0]}
        </p>
      ) : null}
    </div>
  );
}

function BoardContextMenu({
  onRename,
  onDelete,
  onClose,
  isKo,
}: {
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
  isKo: boolean;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full z-20 mt-0.5 w-32 rounded-md border border-border bg-surface py-1 shadow-lg"
    >
      <button
        type="button"
        onClick={onRename}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-hover"
      >
        <PencilIcon className="size-3" strokeWidth={1.75} />
        {isKo ? "이름 변경" : "Rename"}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-surface-hover"
      >
        <TrashIcon className="size-3" strokeWidth={1.75} />
        {isKo ? "삭제" : "Delete"}
      </button>
    </div>
  );
}
