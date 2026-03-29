"use client";

import { ClipCard } from "@/components/clip/ClipCard";
import type { BrowseClipRecord, Locale } from "@/lib/types";

interface FeedCategorySectionProps {
  title: string;
  clipCount: number;
  hero: BrowseClipRecord;
  subs: BrowseClipRecord[];
  lang: Locale;
  lockedClipIds?: Set<string>;
  onViewAll: () => void;
  onOpenQuickView: (clipId: string) => void;
}

export function FeedCategorySection({
  title,
  clipCount,
  hero,
  subs,
  lang,
  lockedClipIds = new Set<string>(),
  onViewAll,
  onOpenQuickView,
}: FeedCategorySectionProps) {
  const viewAllLabel = lang === "ko" ? "전체 보기" : "View all";

  return (
    <section className="mb-10">
      {/* Category header */}
      <div className="flex items-baseline justify-between mb-4 pb-2 border-b border-border/50">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <span className="text-xs text-muted">
            {clipCount.toLocaleString()}
            {lang === "ko" ? "개 클립" : " clips"}
          </span>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs text-primary hover:underline"
        >
          {viewAllLabel} →
        </button>
      </div>

      {/* Hero card — viewport autoplay/pause handled by ClipCard's useIntersectionLoader.
         previewOnHover={false} → plays immediately when in viewport, pauses when out. */}
      <div className="mb-3">
        <ClipCard
          clip={hero}
          lang={lang}
          enablePreview
          previewOnHover={false}
          showInfo
          locked={lockedClipIds.has(hero.id)}
          prioritizeThumbnail
          onOpenQuickView={onOpenQuickView}
        />
      </div>

      {/* Sub clips — responsive 3-column grid */}
      {subs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {subs.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              lang={lang}
              enablePreview
              previewOnHover
              showInfo
              locked={lockedClipIds.has(clip.id)}
              onOpenQuickView={onOpenQuickView}
            />
          ))}
        </div>
      )}
    </section>
  );
}
