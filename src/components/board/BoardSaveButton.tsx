"use client";

import { useCallback, useRef, useState } from "react";
import { BookmarkIcon } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { useBoardStore } from "@/stores/boardStore";
import { buildGuestResumeNextPath } from "@/lib/guestResume";
import { BoardSavePopover } from "./BoardSavePopover";

interface BoardSaveButtonProps {
  clipId: string;
  isVisible: boolean;
}

export function BoardSaveButton({ clipId, isVisible }: BoardSaveButtonProps) {
  const user = useAuthStore((s) => s.user);
  const openPricingModal = useUIStore((s) => s.openPricingModal);
  const boards = useBoardStore((s) => s.boards);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Check if clip is in any board (quick check from loaded boards)
  const activeBoardClipIds = useBoardStore((s) => s.activeBoardClipIds);
  const isBookmarked = activeBoardClipIds?.has(clipId) ?? false;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (!user) {
        openPricingModal({
          kind: "locked-clip",
          viewerTier: "guest",
          clipId,
          nextPath: buildGuestResumeNextPath(
            window.location.pathname,
            window.location.search,
            clipId
          ),
        });
        return;
      }

      setPopoverOpen((prev) => !prev);
    },
    [user, clipId, openPricingModal]
  );

  const handleClose = useCallback(() => {
    setPopoverOpen(false);
  }, []);

  if (!isVisible && !popoverOpen) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        className={`absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full border backdrop-blur-sm transition-opacity ${
          isBookmarked
            ? "border-accent/40 bg-accent/80 text-white"
            : "border-white/20 bg-black/40 text-white/80 hover:bg-black/60 hover:text-white"
        } ${isVisible || popoverOpen ? "opacity-100" : "opacity-0"}`}
        aria-label="보드에 저장"
      >
        <BookmarkIcon
          className="size-3.5"
          strokeWidth={2}
          fill={isBookmarked ? "currentColor" : "none"}
        />
      </button>
      {popoverOpen ? (
        <BoardSavePopover
          clipId={clipId}
          referenceElement={buttonRef.current}
          onClose={handleClose}
        />
      ) : null}
    </>
  );
}
