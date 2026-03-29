"use client";

import { BookmarkIcon, XIcon } from "lucide-react";
import { useBoardStore } from "@/stores/boardStore";
import { useFilterStore } from "@/stores/filterStore";
import { updateFilterURL } from "@/hooks/useFilterSync";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/types";

interface BoardContextBarProps {
  lang: Locale;
}

export function BoardContextBar({ lang }: BoardContextBarProps) {
  const boardId = useFilterStore((s) => s.boardId);
  const boards = useBoardStore((s) => s.boards);
  const clearActiveBoardClipIds = useBoardStore((s) => s.clearActiveBoardClipIds);
  const pathname = usePathname();

  const board = boards.find((b) => b.id === boardId);
  if (!board) return null;

  const isKo = lang === "ko";
  const clipCountLabel = isKo ? `${board.clipCount}개 클립` : `${board.clipCount} clips`;

  return (
    <div className="flex items-center gap-3 border-b border-border bg-accent/5 px-4 py-2.5">
      <BookmarkIcon
        className="size-4 text-accent shrink-0"
        strokeWidth={1.75}
        fill="currentColor"
      />
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-sm font-semibold truncate">{board.name}</span>
        <span className="text-xs text-muted shrink-0">{clipCountLabel}</span>
      </div>
      <button
        type="button"
        onClick={() => {
          clearActiveBoardClipIds();
          updateFilterURL(pathname, { boardId: null });
        }}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"
      >
        <XIcon className="size-3.5" strokeWidth={1.75} />
        {isKo ? "보드 해제" : "Exit board"}
      </button>
    </div>
  );
}
