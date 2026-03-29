"use client";

import { useMemo } from "react";
import { XIcon } from "lucide-react";
import { ClipCard } from "@/components/clip/ClipCard";
import { formatViewedAt } from "@/lib/viewHistoryFormat";
import { useAuthStore } from "@/stores/authStore";
import { useViewHistoryStore } from "@/stores/viewHistoryStore";
import type { BrowseClipRecord, Locale } from "@/lib/types";
import type { Dictionary } from "@/app/[lang]/dictionaries";

interface ViewHistoryPanelProps {
  initialClips: BrowseClipRecord[];
  projectionClips: BrowseClipRecord[] | null;
  projectionStatus: string;
  lang: Locale;
  tagI18n: Record<string, string>;
  dict: Dictionary;
  onOpenQuickView: (clipId: string) => void;
}

export function ViewHistoryPanel({
  initialClips,
  projectionClips,
  projectionStatus,
  lang,
  tagI18n,
  dict,
  onOpenQuickView,
}: ViewHistoryPanelProps) {
  const user = useAuthStore((s) => s.user);
  const entries = useViewHistoryStore((s) => s.entries);
  const isLoading = useViewHistoryStore((s) => s.isLoading);
  const hasLoaded = useViewHistoryStore((s) => s.hasLoaded);
  const removeEntry = useViewHistoryStore((s) => s.removeEntry);
  const clearEntries = useViewHistoryStore((s) => s.clearEntries);

  const clips = useMemo(() => {
    const sourceClips =
      projectionClips && projectionStatus === "ready" ? projectionClips : initialClips;
    const clipMap = new Map(sourceClips.map((clip) => [clip.id, clip] as const));

    if (projectionClips && projectionStatus === "ready") {
      const summaryById = new Map(initialClips.map((clip) => [clip.id, clip] as const));
      for (const [id, clip] of clipMap) {
        const summary = summaryById.get(id);
        if (summary) {
          clipMap.set(id, { ...summary, ...clip });
        }
      }
    }

    return entries
      .map((entry) => {
        const clip = clipMap.get(entry.clipId);
        return clip ? { clip, viewedAt: entry.viewedAt } : null;
      })
      .filter((entry): entry is { clip: BrowseClipRecord; viewedAt: string } => entry !== null);
  }, [entries, initialClips, projectionClips, projectionStatus]);

  if (isLoading && !hasLoaded) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <p className="text-sm text-muted">{dict.common.loading}</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-xl border border-border bg-surface/40"
            >
              <div className="aspect-video animate-pulse bg-foreground/8" />
              <div className="flex items-center justify-between px-3 py-2">
                <div className="h-3 w-20 animate-pulse rounded bg-foreground/8" />
                <div className="h-7 w-7 animate-pulse rounded-full bg-foreground/8" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted">
        {dict.browse.historyEmpty}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <p className="text-xs text-muted">
          {lang === "ko" ? `${clips.length}개 클립` : `${clips.length} clips`}
        </p>
        <button
          type="button"
          onClick={() => {
            void clearEntries(user?.id ?? null);
          }}
          className="text-xs text-muted transition-colors hover:text-foreground"
        >
          {dict.browse.clearHistory}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
        {clips.map(({ clip, viewedAt }) => (
          <article
            key={clip.id}
            data-testid="feed-clip-card"
            data-clip-id={clip.id}
            className="overflow-hidden rounded-xl border border-border bg-background/80"
          >
            <div className="p-2">
              <ClipCard
                clip={clip}
                lang={lang}
                tagI18n={tagI18n}
                enablePreview
                previewOnHover
                showInfo
                onOpenQuickView={onOpenQuickView}
              />
            </div>
            <div className="flex items-center justify-between gap-3 px-3 pb-3">
              <p className="text-xs text-muted">{formatViewedAt(viewedAt, lang)}</p>
              <button
                type="button"
                onClick={() => {
                  void removeEntry(user?.id ?? null, clip.id);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                aria-label={lang === "ko" ? `${clip.name} 기록 삭제` : `Remove ${clip.name} from history`}
                title={lang === "ko" ? "기록에서 제거" : "Remove from history"}
              >
                <XIcon size={14} strokeWidth={2} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
