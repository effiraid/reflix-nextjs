"use client";

import { useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { MasonryGrid } from "@/components/clip/MasonryGrid";
import { useFilterSync } from "@/hooks/useFilterSync";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Shortcut } from "@/hooks/useKeyboardShortcuts";
import { filterClips, shuffleClips, type FilterState } from "@/lib/filter";
import { useAuthStore } from "@/stores/authStore";
import { useClipStore } from "@/stores/clipStore";
import { useFilterStore } from "@/stores/filterStore";
import { useUIStore } from "@/stores/uiStore";
import { useBrowseData } from "./ClipDataProvider";
import { FeedView } from "./FeedView";
import { getColumnCountFromThumbnailSize } from "@/lib/thumbnailSize";
import { useShallow } from "zustand/react/shallow";
import type { BrowseClipRecord, CategoryTree, Locale } from "@/lib/types";
import type { Dictionary } from "../dictionaries";

const QuickViewModal = dynamic(
  () =>
    import("@/components/clip/QuickViewModal").then((m) => m.QuickViewModal),
  { ssr: false }
);

function scrollToClip(clipId: string) {
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-clip-id="${clipId}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

const FREE_SEARCH_LIMIT = 5;

function countActiveFilterAxes(filters: FilterState): number {
  return [
    filters.category !== null,
    filters.contentMode !== null,
    filters.selectedFolders.length > 0,
    filters.selectedTags.length > 0 || filters.excludedTags.length > 0,
    filters.starFilter !== null,
  ].filter(Boolean).length;
}

function limitFiltersToSingleAxis(filters: FilterState): FilterState {
  const limitedFilters: FilterState = {
    ...filters,
    category: null,
    contentMode: null,
    selectedFolders: [],
    selectedTags: [],
    excludedTags: [],
    starFilter: null,
  };

  if (filters.category !== null) {
    limitedFilters.category = filters.category;
    return limitedFilters;
  }

  if (filters.contentMode !== null) {
    limitedFilters.contentMode = filters.contentMode;
    return limitedFilters;
  }

  if (filters.selectedFolders.length > 0) {
    limitedFilters.selectedFolders = filters.selectedFolders;
    return limitedFilters;
  }

  if (filters.selectedTags.length > 0 || filters.excludedTags.length > 0) {
    limitedFilters.selectedTags = filters.selectedTags;
    limitedFilters.excludedTags = filters.excludedTags;
    return limitedFilters;
  }

  if (filters.starFilter !== null) {
    limitedFilters.starFilter = filters.starFilter;
  }

  return limitedFilters;
}

interface BrowseClientProps {
  categories: CategoryTree;
  tagI18n?: Record<string, string>;
  lang: Locale;
  dict: Dictionary;
}

export function BrowseClient({
  categories,
  tagI18n = {},
  lang,
  dict,
}: BrowseClientProps) {
  const {
    initialClips,
    projectionClips,
    projectionStatus,
    initialTotalCount,
  } = useBrowseData();
  const { selectedClipId, setSelectedClipId } = useClipStore();
  const filters = useFilterStore(
    useShallow((s) => ({
      selectedFolders: s.selectedFolders,
      selectedTags: s.selectedTags,
      excludedTags: s.excludedTags,
      starFilter: s.starFilter,
      searchQuery: s.searchQuery,
      sortBy: s.sortBy,
      category: s.category,
      contentMode: s.contentMode,
    }))
  );
  const { user, tier } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      tier: s.tier,
    }))
  );
  const {
    quickViewOpen,
    setQuickViewOpen,
    stepThumbnailSize,
    shuffleSeed,
    thumbnailSize,
    viewMode,
  } = useUIStore(
    useShallow((s) => ({
      quickViewOpen: s.quickViewOpen,
      setQuickViewOpen: s.setQuickViewOpen,
      stepThumbnailSize: s.stepThumbnailSize,
      shuffleSeed: s.shuffleSeed,
      thumbnailSize: s.thumbnailSize,
      viewMode: s.viewMode,
    }))
  );
  const columnCount = getColumnCountFromThumbnailSize(thumbnailSize);
  const isProUser = Boolean(user) && tier === "pro";
  const activeFilterAxes = countActiveFilterAxes(filters);
  const isFilterCombinationLimited = activeFilterAxes > 1 && !isProUser;
  const effectiveFilters = useMemo(
    () => (isFilterCombinationLimited ? limitFiltersToSingleAxis(filters) : filters),
    [filters, isFilterCombinationLimited]
  );

  // Sync URL → Zustand filters
  useFilterSync();

  // Tab → jump to SearchBar; block all other Tab focus cycling
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      e.preventDefault();
      const input = document.querySelector<HTMLInputElement>(
        '[data-testid="navbar-search"] input'
      );
      if (input && document.activeElement !== input) {
        input.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const hasActiveBrowseFilters =
    filters.category !== null ||
    filters.contentMode !== null ||
    filters.selectedFolders.length > 0 ||
    filters.selectedTags.length > 0 ||
    filters.excludedTags.length > 0 ||
    filters.starFilter !== null ||
    filters.searchQuery.length > 0 ||
    filters.sortBy !== "newest";

  // Feed-specific filter check: exclude contentMode and sortBy
  const hasFeedBlockingFilters =
    filters.category !== null ||
    filters.selectedFolders.length > 0 ||
    filters.selectedTags.length > 0 ||
    filters.excludedTags.length > 0 ||
    filters.starFilter !== null ||
    filters.searchQuery.length > 0;

  const showFeed = viewMode === "feed" && !hasFeedBlockingFilters;
  const hasSearchOrFilter = filters.searchQuery.length > 0 || activeFilterAxes > 0;
  const initialDisplayClips = useMemo(() => {
    if (!projectionClips || projectionStatus !== "ready" || (columnCount > 3 && !showFeed)) {
      return initialClips;
    }

    const projectionById = new Map(
      projectionClips.map((clip) => [clip.id, clip] as const)
    );

    return initialClips.map((clip) => projectionById.get(clip.id) ?? clip);
  }, [columnCount, initialClips, projectionClips, projectionStatus, showFeed]);

  // Apply filters only after projection preload is ready.
  const browseResults = useMemo(
    () => {
      if (!projectionClips || projectionStatus !== "ready" || !hasActiveBrowseFilters) {
        return {
          clips:
            shuffleSeed === 0
              ? initialDisplayClips
              : shuffleClips(initialDisplayClips),
          totalResultCount: initialTotalCount,
          lockedClipIds: new Set<string>(),
        };
      }

      const allResults = filterClips(
        projectionClips,
        effectiveFilters,
        categories,
        tagI18n,
        lang
      );
      const isLimited = hasSearchOrFilter && !isProUser;
      const orderedResults =
        shuffleSeed === 0 ? allResults : shuffleClips(allResults);
      const lockedClipIds = isLimited
        ? new Set(orderedResults.slice(FREE_SEARCH_LIMIT).map((clip) => clip.id))
        : new Set<string>();

      return {
        clips: orderedResults,
        totalResultCount: allResults.length,
        lockedClipIds,
      };
    },
    [
      initialDisplayClips,
      initialTotalCount,
      projectionClips,
      projectionStatus,
      hasActiveBrowseFilters,
      effectiveFilters,
      hasSearchOrFilter,
      isProUser,
      categories,
      tagI18n,
      shuffleSeed,
      lang,
    ]
  );

  const filtered = browseResults.clips;
  const lockedClipIds = browseResults.lockedClipIds;
  const lockedCount = lockedClipIds.size;

  const indexMap = useMemo(
    () => new Map(filtered.map((c, i) => [c.id, i])),
    [filtered]
  );

  const selectedIndex = selectedClipId ? (indexMap.get(selectedClipId) ?? -1) : -1;
  const selectedClip: BrowseClipRecord | null =
    selectedIndex >= 0 ? filtered[selectedIndex] : null;
  const selectedClipLocked = selectedClip
    ? lockedClipIds.has(selectedClip.id)
    : false;
  const visibleResultCount =
    projectionClips && projectionStatus === "ready" && hasActiveBrowseFilters
      ? browseResults.totalResultCount
      : initialTotalCount;
  const resultCountLabel =
    lang === "ko" ? `${visibleResultCount}개 클립` : `${visibleResultCount} clips`;
  const emptyStateLabel = filters.searchQuery
    ? lang === "ko"
      ? `'${filters.searchQuery}'에 대한 결과가 없습니다`
      : `No results for "${filters.searchQuery}"`
    : dict.browse.noResults;

  const navigateGrid = useCallback(
    (direction: "up" | "down" | "left" | "right" | "home" | "end" | "top" | "bottom") => {
      if (filtered.length === 0) return;

      if (selectedIndex < 0) {
        setSelectedClipId(filtered[0].id);
        scrollToClip(filtered[0].id);
        return;
      }

      let nextIndex: number;
      switch (direction) {
        case "up":
          nextIndex = selectedIndex - columnCount;
          if (nextIndex < 0) return;
          break;
        case "down":
          nextIndex = selectedIndex + columnCount;
          if (nextIndex >= filtered.length) return;
          break;
        case "left":
          if (selectedIndex % columnCount === 0) return;
          nextIndex = selectedIndex - 1;
          break;
        case "right":
          if ((selectedIndex + 1) % columnCount === 0) return;
          nextIndex = selectedIndex + 1;
          if (nextIndex >= filtered.length) return;
          break;
        case "home":
          nextIndex = Math.floor(selectedIndex / columnCount) * columnCount;
          break;
        case "end":
          nextIndex = Math.min(
            Math.floor(selectedIndex / columnCount) * columnCount + columnCount - 1,
            filtered.length - 1
          );
          break;
        case "top":
          nextIndex = 0;
          break;
        case "bottom":
          nextIndex = filtered.length - 1;
          break;
      }

      if (nextIndex === selectedIndex) return;
      setSelectedClipId(filtered[nextIndex].id);
      scrollToClip(filtered[nextIndex].id);
    },
    [filtered, selectedIndex, columnCount, setSelectedClipId]
  );

  const shortcuts = useMemo<Shortcut[]>(
    () => [
      {
        key: "Escape",
        action: () => setSelectedClipId(null),
        enabled: !quickViewOpen && selectedIndex >= 0,
      },
      {
        key: "Enter",
        action: () => setQuickViewOpen(true),
        enabled: !!selectedClip && !selectedClipLocked && !quickViewOpen,
      },
      {
        key: " ",
        action: () => setQuickViewOpen(true),
        enabled: !!selectedClip && !selectedClipLocked && !quickViewOpen,
      },
      // Cmd/Ctrl + Arrow: jump to top/bottom
      {
        key: "ArrowUp",
        action: () => navigateGrid("top"),
        enabled: !quickViewOpen,
        requireModifier: "ctrl",
      },
      {
        key: "ArrowDown",
        action: () => navigateGrid("bottom"),
        enabled: !quickViewOpen,
        requireModifier: "ctrl",
      },
      // Plain arrows: grid navigation
      {
        key: "ArrowUp",
        action: () => navigateGrid("up"),
        enabled: !quickViewOpen,
        allowRepeat: true,
      },
      {
        key: "ArrowDown",
        action: () => navigateGrid("down"),
        enabled: !quickViewOpen,
        allowRepeat: true,
      },
      {
        key: "ArrowLeft",
        action: () => navigateGrid("left"),
        enabled: !quickViewOpen,
        allowRepeat: true,
      },
      {
        key: "ArrowRight",
        action: () => navigateGrid("right"),
        enabled: !quickViewOpen,
        allowRepeat: true,
      },
      // Home/End: first/last in row
      {
        key: "Home",
        action: () => navigateGrid("home"),
        enabled: !quickViewOpen,
      },
      {
        key: "End",
        action: () => navigateGrid("end"),
        enabled: !quickViewOpen,
      },
      {
        key: "-",
        action: () => stepThumbnailSize(-1),
        allowRepeat: true,
        enabled: !quickViewOpen,
      },
      {
        key: "+",
        action: () => stepThumbnailSize(1),
        allowRepeat: true,
        enabled: !quickViewOpen,
      },
      {
        key: "=",
        action: () => stepThumbnailSize(1),
        allowRepeat: true,
        enabled: !quickViewOpen,
      },
    ],
    [
      quickViewOpen,
      selectedClip,
      selectedClipLocked,
      selectedIndex,
      setSelectedClipId,
      setQuickViewOpen,
      stepThumbnailSize,
      navigateGrid,
    ]
  );
  useKeyboardShortcuts(shortcuts);

  const handleCloseQuickView = useCallback(
    () => setQuickViewOpen(false),
    [setQuickViewOpen]
  );

  const openQuickViewForClip = useCallback(
    (clipId: string) => {
      if (lockedClipIds.has(clipId)) {
        return;
      }

      setSelectedClipId(clipId);
      setQuickViewOpen(true);
    },
    [lockedClipIds, setSelectedClipId, setQuickViewOpen]
  );

  if (filtered.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted">
        {emptyStateLabel}
      </div>
    );
  }

  if (showFeed) {
    return (
      <>
        <FeedView
          clips={initialDisplayClips}
          categories={categories}
          lang={lang}
          onOpenQuickView={openQuickViewForClip}
        />
        {quickViewOpen && selectedClip ? (
          <QuickViewModal
            clip={selectedClip}
            lang={lang}
            tagI18n={tagI18n}
            dict={dict}
            onClose={handleCloseQuickView}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      {hasSearchOrFilter || lockedCount > 0 || isFilterCombinationLimited ? (
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <p className="text-xs text-muted" aria-live="polite">
            {hasSearchOrFilter ? resultCountLabel : null}
            {hasSearchOrFilter && lockedCount > 0 ? " · " : null}
            {lockedCount > 0
              ? lang === "ko"
                ? `${lockedCount}개 결과는 Pro 전용`
                : `${lockedCount} results require Pro`
              : null}
            {isFilterCombinationLimited
              ? lang === "ko"
                ? "필터 조합은 Pro 전용입니다"
                : "Filter combinations require Pro"
              : null}
          </p>
          {(lockedCount > 0 || isFilterCombinationLimited) ? (
            <a
              href={`/${lang}/pricing`}
              className="text-xs font-medium text-primary hover:underline"
            >
              {lang === "ko" ? "Pro로 잠금 해제" : "Unlock with Pro"}
            </a>
          ) : null}
        </div>
      ) : null}
      <MasonryGrid
        clips={filtered}
        lang={lang}
        tagI18n={tagI18n}
        lockedClipIds={lockedClipIds}
        onOpenQuickView={openQuickViewForClip}
      />
      {quickViewOpen && selectedClip ? (
        <QuickViewModal
          clip={selectedClip}
          lang={lang}
          tagI18n={tagI18n}
          dict={dict}
          onClose={handleCloseQuickView}
        />
      ) : null}
    </>
  );
}
