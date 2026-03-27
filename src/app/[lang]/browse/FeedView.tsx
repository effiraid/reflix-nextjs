"use client";

import { useMemo, useCallback } from "react";
import { buildLeafToTopMap, groupClipsByTopCategory, pickHeroAndSubs } from "@/lib/feedGrouping";
import { filterCategoriesByMode } from "@/lib/categories";
import { useFilterStore } from "@/stores/filterStore";
import { useFilterSync } from "@/hooks/useFilterSync";
import { useUIStore } from "@/stores/uiStore";
import { useClipData } from "./ClipDataProvider";
import { FeedCategorySection } from "./FeedCategorySection";
import type { BrowseClipRecord, CategoryTree, Locale } from "@/lib/types";

interface FeedViewProps {
  categories: CategoryTree;
  lang: Locale;
  onOpenQuickView: (clipId: string) => void;
}

export function FeedView({ categories, lang, onOpenQuickView }: FeedViewProps) {
  const clips = useClipData();
  const contentMode = useFilterStore((s) => s.contentMode);
  const { updateURL } = useFilterSync();
  const setViewMode = useUIStore((s) => s.setViewMode);

  const leafToTopMap = useMemo(
    () => buildLeafToTopMap(categories),
    [categories]
  );

  // Group clips by top-level category, respecting contentMode
  const sections = useMemo(() => {
    const visibleCategories = filterCategoriesByMode(categories, contentMode);
    const visibleTopSlugs = new Set(
      Object.values(visibleCategories).map((n) => n.slug)
    );

    const grouped = groupClipsByTopCategory(clips, leafToTopMap);

    // Build ordered sections: only visible categories with clips
    const result: {
      topSlug: string;
      topFolderId: string;
      title: string;
      clips: BrowseClipRecord[];
    }[] = [];

    // Iterate categories in their original order (Object.entries preserves insertion order)
    for (const [folderId, node] of Object.entries(categories)) {
      if (!visibleTopSlugs.has(node.slug)) continue;
      const bucket = grouped.get(node.slug);
      if (!bucket || bucket.length === 0) continue;
      result.push({
        topSlug: node.slug,
        topFolderId: folderId,
        title: node.i18n[lang] || node.slug,
        clips: bucket,
      });
    }

    return result;
  }, [clips, categories, leafToTopMap, contentMode, lang]);

  const handleViewAll = useCallback(
    (topFolderId: string) => {
      updateURL({ selectedFolders: [topFolderId], excludedFolders: [] });
      setViewMode("masonry");
    },
    [updateURL, setViewMode]
  );

  if (sections.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted">
        {lang === "ko" ? "표시할 카테고리가 없습니다" : "No categories to display"}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-5 py-6">
        {sections.map((section) => {
          const { hero, subs } = pickHeroAndSubs(section.clips);
          if (!hero) return null;
          return (
            <FeedCategorySection
              key={section.topSlug}
              title={section.title}
              clipCount={section.clips.length}
              hero={hero}
              subs={subs}
              lang={lang}
              onViewAll={() => handleViewAll(section.topFolderId)}
              onOpenQuickView={onOpenQuickView}
            />
          );
        })}
      </div>
    </div>
  );
}
