"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
} from "@floating-ui/react";
import { CheckIcon, PlusIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FREE_BOARD_LIMIT, hasProAccess } from "@/lib/accessPolicy";
import {
  loadBoardIdsForClip,
  persistBoardClipMembership,
} from "@/lib/boardData";
import { getBoardLimitNotice } from "@/lib/boardLimitNotice";
import { useAuthStore } from "@/stores/authStore";
import { useBoardStore, type Board } from "@/stores/boardStore";
import { showToast } from "@/components/common/Toast";

interface BoardSavePopoverProps {
  clipId: string;
  referenceElement: HTMLElement | null;
  onClose: () => void;
}

export function BoardSavePopover({
  clipId,
  referenceElement,
  onClose,
}: BoardSavePopoverProps) {
  const { user, tier } = useAuthStore();
  const {
    boards,
    addBoard,
    addClipToBoard,
    removeClipFromBoard,
  } = useBoardStore();
  const [newBoardName, setNewBoardName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [boardClipMap, setBoardClipMap] = useState<Record<string, boolean>>({});
  const [isMembershipLoading, setIsMembershipLoading] = useState(true);
  const popoverRef = useRef<HTMLDivElement>(null);
  const boardClipMapRef = useRef<Record<string, boolean>>({});
  const syncBoardMembershipRef = useRef<
    (
      boardId: string,
      nextInBoard: boolean,
      options?: { showUndoToast?: boolean }
    ) => Promise<void>
  >(async () => {});

  const { refs, floatingStyles } = useFloating({
    elements: { reference: referenceElement },
    placement: "bottom-end",
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  // Load which boards contain this clip
  useEffect(() => {
    let cancelled = false;

    async function loadClipBoardMap() {
      setIsMembershipLoading(true);
      boardClipMapRef.current = {};
      setBoardClipMap({});

      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) {
          setIsMembershipLoading(false);
        }
        return;
      }

      const map: Record<string, boolean> = {};
      const boardIds = await loadBoardIdsForClip(supabase, clipId);

      if (cancelled) {
        return;
      }

      for (const boardId of boardIds) {
        map[boardId] = true;
      }

      boardClipMapRef.current = map;
      setBoardClipMap(map);
      setIsMembershipLoading(false);
    }

    void loadClipBoardMap();

    return () => {
      cancelled = true;
    };
  }, [clipId]);

  const syncBoardMembership = useCallback(
    async (
      boardId: string,
      nextInBoard: boolean,
      options?: { showUndoToast?: boolean }
    ) => {
      const supabase = createClient();
      if (!supabase) return;

      const currentInBoard = !!boardClipMapRef.current[boardId];
      if (currentInBoard === nextInBoard) {
        return;
      }

      boardClipMapRef.current = {
        ...boardClipMapRef.current,
        [boardId]: nextInBoard,
      };
      setBoardClipMap(boardClipMapRef.current);

      if (nextInBoard) {
        addClipToBoard(boardId, clipId);
      } else {
        removeClipFromBoard(boardId, clipId);
      }

      const { error } = await persistBoardClipMembership(
        supabase,
        boardId,
        clipId,
        nextInBoard
      );

      if (error) {
        boardClipMapRef.current = {
          ...boardClipMapRef.current,
          [boardId]: currentInBoard,
        };
        setBoardClipMap(boardClipMapRef.current);

        if (currentInBoard) {
          addClipToBoard(boardId, clipId);
        } else {
          removeClipFromBoard(boardId, clipId);
        }

        return;
      }

      if (options?.showUndoToast === false) {
        return;
      }

      const boardName = boards.find((b) => b.id === boardId)?.name ?? "";
      showToast(
        nextInBoard ? `${boardName}에 저장됨` : `${boardName}에서 제거됨`,
        () => {
          void syncBoardMembershipRef.current(boardId, !nextInBoard, {
            showUndoToast: false,
          });
        }
      );
    },
    [addClipToBoard, boards, clipId, removeClipFromBoard]
  );
  useEffect(() => {
    syncBoardMembershipRef.current = syncBoardMembership;
  }, [syncBoardMembership]);

  // Close on scroll (masonry grid compatibility)
  useEffect(() => {
    const scrollContainer = document.querySelector("[data-masonry-scroll]");
    if (!scrollContainer) return;

    const handleScroll = () => onClose();
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleToggleClip = useCallback(
    async (boardId: string) => {
      await syncBoardMembership(boardId, !boardClipMapRef.current[boardId]);
    },
    [syncBoardMembership]
  );

  const handleCreateBoard = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const name = newBoardName.trim();
      if (!name || isCreating) return;

      const supabase = createClient();
      if (!supabase || !user) return;

      setIsCreating(true);
      const { data, error } = await supabase
        .from("boards")
        .insert({ user_id: user.id, name })
        .select()
        .single();

      if (data && !error) {
        const board: Board = {
          id: data.id,
          name: data.name,
          clipCount: 0,
          coverClipIds: [],
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        addBoard(board);
        setNewBoardName("");

        // Auto-add clip to the new board
        await syncBoardMembership(board.id, true, { showUndoToast: false });
        showToast(`${name}에 저장됨`);
      }
      setIsCreating(false);
    },
    [newBoardName, isCreating, user, addBoard, syncBoardMembership]
  );

  const canCreateBoard =
    hasProAccess(user, tier) || boards.length < FREE_BOARD_LIMIT;

  return createPortal(
    <div
      ref={(node) => {
        refs.setFloating(node);
        (popoverRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      style={floatingStyles}
      className="z-50 w-56 rounded-lg border border-border bg-surface p-1.5 shadow-xl motion-safe:animate-[fadeIn_100ms_ease-out]"
      onClick={(e) => e.stopPropagation()}
    >
      {boards.length > 0 ? (
        <ul className="max-h-48 space-y-0.5 overflow-y-auto">
          {boards.map((board) => {
            const isInBoard = !!boardClipMap[board.id];
            return (
              <li key={board.id}>
                <button
                  type="button"
                  onClick={() => handleToggleClip(board.id)}
                  disabled={isMembershipLoading}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-surface-hover"
                >
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                      isInBoard
                        ? "border-accent bg-accent text-white"
                        : "border-border"
                    }`}
                  >
                    {isInBoard ? (
                      <CheckIcon className="size-3" strokeWidth={2.5} />
                    ) : null}
                  </span>
                  <span className="flex-1 truncate text-left">{board.name}</span>
                  <span className="text-muted">{board.clipCount}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {canCreateBoard ? (
        <form
          onSubmit={handleCreateBoard}
          className="mt-1 flex items-center gap-1 border-t border-border pt-1.5"
        >
          <PlusIcon className="size-3.5 shrink-0 text-muted" strokeWidth={2} />
          <input
            type="text"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value.slice(0, 50))}
            placeholder="새 보드"
            maxLength={50}
            className="min-w-0 flex-1 bg-transparent px-1 py-0.5 text-xs outline-none placeholder:text-muted"
            autoFocus
          />
          {newBoardName.trim() ? (
            <button
              type="submit"
              disabled={isCreating}
              className="shrink-0 rounded bg-accent px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-50"
            >
              만들기
            </button>
          ) : null}
        </form>
      ) : (
        <p className="mt-1 border-t border-border px-2 pt-1.5 text-[10px] text-muted">
          {getBoardLimitNotice({
            lang: "ko",
            boardCount: boards.length,
            limit: FREE_BOARD_LIMIT,
          }).split("\n")[0]}
        </p>
      )}
    </div>,
    document.body
  );
}
