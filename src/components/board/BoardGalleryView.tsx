"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  BookmarkIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FREE_BOARD_LIMIT, hasProAccess } from "@/lib/accessPolicy";
import { getBoardLimitNotice } from "@/lib/boardLimitNotice";
import { getMediaUrl } from "@/lib/mediaUrl";
import { useAuthStore } from "@/stores/authStore";
import { useBoardStore, type Board } from "@/stores/boardStore";
import { useFilterStore } from "@/stores/filterStore";
import { useUIStore } from "@/stores/uiStore";
import { updateFilterURL } from "@/hooks/useFilterSync";
import { useBrowseData, useClipData } from "@/app/[lang]/browse/ClipDataProvider";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/types";
import type { Dictionary } from "@/app/[lang]/dictionaries";

interface BoardGalleryViewProps {
  lang: Locale;
  dict: Pick<Dictionary, "browse" | "board">;
}

export function BoardGalleryView({ lang, dict }: BoardGalleryViewProps) {
  const { user, tier } = useAuthStore();
  const { boards, fetchBoards, addBoard, removeBoard, updateBoard } =
    useBoardStore();
  const { loadBoardClipIds, clearActiveBoardClipIds } = useBoardStore();
  const boardId = useFilterStore((s) => s.boardId);
  const setBrowseMode = useUIStore((s) => s.setBrowseMode);
  const pathname = usePathname();
  const { requestDetailedIndex } = useBrowseData();
  const clips = useClipData();
  const isKo = lang === "ko";

  const [newBoardName, setNewBoardName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    if (user) {
      fetchBoards();
      requestDetailedIndex();
    }
  }, [fetchBoards, requestDetailedIndex, user]);

  // Build a map from clipId → thumbnailUrl for cover images
  const clipThumbnailMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const clip of clips) {
      if (clip.thumbnailUrl) {
        map.set(clip.id, getMediaUrl(clip.thumbnailUrl));
      }
    }
    return map;
  }, [clips]);

  const handleBoardClick = useCallback(
    (boardId: string) => {
      setBrowseMode("grid");
      loadBoardClipIds(boardId);
      updateFilterURL(pathname, { boardId });
    },
    [setBrowseMode, loadBoardClipIds, pathname]
  );

  const handleBack = useCallback(() => {
    clearActiveBoardClipIds();
    updateFilterURL(pathname, { boardId: null });
    setBrowseMode("grid");
  }, [clearActiveBoardClipIds, pathname, setBrowseMode]);

  const handleDeleteBoard = useCallback(
    async (deleteBoardId: string) => {
      const supabase = createClient();
      if (!supabase) return;

      const { error } = await supabase
        .from("boards")
        .delete()
        .eq("id", deleteBoardId);
      if (error) {
        return;
      }

      removeBoard(deleteBoardId);
      if (boardId === deleteBoardId) {
        clearActiveBoardClipIds();
        updateFilterURL(pathname, { boardId: null });
      }
    },
    [boardId, clearActiveBoardClipIds, pathname, removeBoard]
  );

  const handleStartRename = useCallback(
    (renameBoardId: string) => {
      const board = boards.find((entry) => entry.id === renameBoardId);
      if (!board) return;
      setRenamingBoardId(renameBoardId);
      setRenameValue(board.name);
    },
    [boards]
  );

  const handleRenameSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!renamingBoardId || !renameValue.trim()) return;

      const supabase = createClient();
      if (!supabase) return;

      const nextName = renameValue.trim();
      const { error } = await supabase
        .from("boards")
        .update({ name: nextName })
        .eq("id", renamingBoardId);
      if (error) {
        return;
      }

      updateBoard(renamingBoardId, { name: nextName });
      setRenamingBoardId(null);
    },
    [renameValue, renamingBoardId, updateBoard]
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
      }
      setIsCreating(false);
    },
    [newBoardName, isCreating, user, addBoard]
  );

  const canCreateBoard =
    user && (hasProAccess(user, tier) || boards.length < FREE_BOARD_LIMIT);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-accent/5 px-4 py-3">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          <ArrowLeftIcon className="size-3.5" strokeWidth={1.75} />
          {dict.browse.all}
        </button>
        <div className="flex items-center gap-2">
          <BookmarkIcon className="size-4 text-accent" strokeWidth={1.75} fill="currentColor" />
          <h2 className="text-sm font-semibold">{dict.browse.myBoards}</h2>
          {boards.length > 0 ? (
            <span className="text-xs text-muted">{boards.length}</span>
          ) : null}
        </div>
      </div>

      <div className="flex-1 p-4">
        {/* Not logged in */}
        {!user ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <BookmarkIcon className="size-10 text-muted" strokeWidth={1} />
            <p className="text-sm text-muted">{dict.board.signInNotice}</p>
          </div>
        ) : boards.length === 0 ? (
          /* Empty state — centered create form */
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <BookmarkIcon className="size-10 text-muted" strokeWidth={1} />
            <p className="text-sm text-muted">{dict.board.galleryEmpty}</p>
            {canCreateBoard ? (
              <form onSubmit={handleCreateBoard} className="flex gap-2">
                <input
                  type="text"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value.slice(0, 50))}
                  placeholder={isKo ? "보드 이름" : "Board name"}
                  maxLength={50}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  type="submit"
                  disabled={!newBoardName.trim() || isCreating}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {dict.board.create}
                </button>
              </form>
            ) : null}
          </div>
        ) : (
          /* Board grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {boards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                clipThumbnailMap={clipThumbnailMap}
                onClick={() => handleBoardClick(board.id)}
                onRename={() => handleStartRename(board.id)}
                onDelete={() => handleDeleteBoard(board.id)}
                isRenaming={renamingBoardId === board.id}
                renameValue={renameValue}
                onRenameChange={setRenameValue}
                onRenameSubmit={handleRenameSubmit}
                onRenameCancel={() => setRenamingBoardId(null)}
                lang={lang}
              />
            ))}

            {/* New board card */}
            {canCreateBoard ? (
              <NewBoardCard
                newBoardName={newBoardName}
                setNewBoardName={setNewBoardName}
                isCreating={isCreating}
                onSubmit={handleCreateBoard}
                dict={dict}
              />
            ) : (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-border aspect-[4/3] p-4">
                <p className="text-[10px] text-muted text-center leading-relaxed">
                  {getBoardLimitNotice({
                    lang,
                    boardCount: boards.length,
                    limit: FREE_BOARD_LIMIT,
                  }).split("\n").map((line, i) => (
                    <span key={i}>{i > 0 ? <br /> : null}{line}</span>
                  ))}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BoardCard({
  board,
  clipThumbnailMap,
  onClick,
  onRename,
  onDelete,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  lang,
}: {
  board: Board;
  clipThumbnailMap: Map<string, string>;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
  isRenaming: boolean;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onRenameSubmit: (e: React.FormEvent) => void;
  onRenameCancel: () => void;
  lang: Locale;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const covers = board.coverClipIds
    .map((id) => clipThumbnailMap.get(id))
    .filter((url): url is string => !!url);

  const clipCountLabel =
    lang === "ko" ? `${board.clipCount}개 클립` : `${board.clipCount} clips`;
  const isKo = lang === "ko";

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const coverContent = covers.length === 0 ? (
    <div className="flex items-center justify-center h-full bg-surface">
      <BookmarkIcon className="size-8 text-muted/40" strokeWidth={1} />
    </div>
  ) : covers.length === 1 ? (
    <img src={covers[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
  ) : covers.length === 2 ? (
    <div className="flex h-full gap-0.5">
      <img src={covers[0]} alt="" className="w-2/3 h-full object-cover" loading="lazy" />
      <img src={covers[1]} alt="" className="w-1/3 h-full object-cover" loading="lazy" />
    </div>
  ) : (
    <div className="flex h-full gap-0.5">
      <img src={covers[0]} alt="" className="w-2/3 h-full object-cover" loading="lazy" />
      <div className="flex w-1/3 flex-col gap-0.5">
        <img src={covers[1]} alt="" className="h-1/2 w-full object-cover" loading="lazy" />
        <img src={covers[2]} alt="" className="h-1/2 w-full object-cover" loading="lazy" />
      </div>
    </div>
  );

  return (
    <div className="group/card relative text-left rounded-xl border border-border bg-surface/40 overflow-hidden hover:border-accent/40 transition-colors">
      <button type="button" onClick={onClick} className="w-full text-left">
        <div className="aspect-[4/3] bg-surface overflow-hidden">{coverContent}</div>
        <div className="px-3 py-2.5">
          {isRenaming ? (
            <form onSubmit={onRenameSubmit} onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => onRenameChange(e.target.value.slice(0, 50))}
                maxLength={50}
                autoFocus
                className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-accent"
                onKeyDown={(e) => { if (e.key === "Escape") onRenameCancel(); }}
                onBlur={onRenameSubmit}
              />
            </form>
          ) : (
            <>
              <p className="text-sm font-medium truncate group-hover/card:text-accent transition-colors">
                {board.name}
              </p>
              <p className="text-xs text-muted mt-0.5">{clipCountLabel}</p>
            </>
          )}
        </div>
      </button>

      {/* More menu trigger */}
      {!isRenaming ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="absolute right-1.5 top-1.5 rounded-md bg-black/40 p-1 text-white opacity-0 hover:bg-black/60 group-hover/card:opacity-100 transition-opacity"
        >
          <MoreHorizontalIcon className="size-4" strokeWidth={1.75} />
        </button>
      ) : null}

      {menuOpen ? (
        <div
          ref={menuRef}
          className="absolute right-1.5 top-9 z-20 w-28 rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          <button
            type="button"
            onClick={() => { setMenuOpen(false); onRename(); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-hover"
          >
            <PencilIcon className="size-3" strokeWidth={1.75} />
            {isKo ? "이름 변경" : "Rename"}
          </button>
          <button
            type="button"
            onClick={() => { setMenuOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-surface-hover"
          >
            <TrashIcon className="size-3" strokeWidth={1.75} />
            {isKo ? "삭제" : "Delete"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NewBoardCard({
  newBoardName,
  setNewBoardName,
  isCreating,
  onSubmit,
  dict,
}: {
  newBoardName: string;
  setNewBoardName: (name: string) => void;
  isCreating: boolean;
  onSubmit: (e: React.FormEvent) => void;
  dict: Pick<Dictionary, "board">;
}) {
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-accent/40 bg-accent/5 aspect-[4/3] p-4">
        <form onSubmit={onSubmit} className="w-full space-y-2">
          <input
            type="text"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value.slice(0, 50))}
            placeholder={dict.board.newBoardPlaceholder}
            maxLength={50}
            autoFocus
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-accent"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setShowForm(false);
                setNewBoardName("");
              }
            }}
          />
          <button
            type="submit"
            disabled={!newBoardName.trim() || isCreating}
            className="w-full rounded bg-accent px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {dict.board.create}
          </button>
        </form>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShowForm(true)}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border aspect-[4/3] hover:border-accent/40 hover:bg-accent/5 transition-colors"
    >
      <PlusIcon className="size-6 text-muted" strokeWidth={1.5} />
      <span className="text-xs text-muted">{dict.board.galleryNewBoard}</span>
    </button>
  );
}
