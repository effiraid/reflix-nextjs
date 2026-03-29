"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MasonryGrid } from "@/components/clip/MasonryGrid";
import { useFilterSync } from "@/hooks/useFilterSync";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Shortcut } from "@/hooks/useKeyboardShortcuts";
import { filterClips, hasFeedBlockingFilters, shuffleClips, type FilterState } from "@/lib/filter";
import { useAuthStore } from "@/stores/authStore";
import { useBoardStore } from "@/stores/boardStore";
import { useClipStore } from "@/stores/clipStore";
import { useFilterStore } from "@/stores/filterStore";
import { useUIStore } from "@/stores/uiStore";
import { useBrowseData } from "./ClipDataProvider";
import { FeedView } from "./FeedView";
import { getColumnCountFromThumbnailSize } from "@/lib/thumbnailSize";
import { useShallow } from "zustand/react/shallow";
import type { BrowseClipRecord, CategoryTree, Locale, TagGroupData } from "@/lib/types";
import type { Dictionary } from "../dictionaries";
import { BrandSplash } from "@/components/splash/BrandSplash";
import { useSplashGate } from "@/components/splash/useSplashGate";
import { useTagGroups } from "@/hooks/useTagGroups";
import { TagDetailView } from "@/components/tags/TagDetailView";
import { BoardGalleryView } from "@/components/board/BoardGalleryView";
import { BoardContextBar } from "@/components/board/BoardContextBar";
import { ToastContainer } from "@/components/common/Toast";

const EMPTY_TAG_GROUPS: TagGroupData = { groups: [], parentGroups: [] };
import {
  FREE_MAX_FILTER_AXES,
  getBrowseVisibleResultsLimit,
  getViewerTier,
  hasProAccess,
} from "@/lib/accessPolicy";
import { clearGuestResumeParams, readGuestResume } from "@/lib/guestResume";

const QuickViewModal = dynamic(
  () =>
    import("@/components/clip/QuickViewModal").then((m) => m.QuickViewModal),
  { ssr: false }
);

const KeyboardHelpOverlay = dynamic(
  () =>
    import("@/components/layout/KeyboardHelpOverlay").then(
      (m) => m.KeyboardHelpOverlay
    ),
  { ssr: false }
);

function scrollToClip(clipId: string) {
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-clip-id="${clipId}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

function countActiveFilterAxes(filters: FilterState): number {
  return [
    filters.category !== null,
    filters.contentMode !== null,
    filters.selectedFolders.length > 0 || filters.excludedFolders.length > 0,
    filters.selectedTags.length > 0 || filters.excludedTags.length > 0,
  ].filter(Boolean).length;
}

function limitFiltersToSingleAxis(filters: FilterState): FilterState {
  const limitedFilters: FilterState = {
    ...filters,
    category: null,
    contentMode: null,
    selectedFolders: [],
    excludedFolders: [],
    selectedTags: [],
    excludedTags: [],
    // boardId is preserved — not subject to filter axis limits
  };

  if (filters.category !== null) {
    limitedFilters.category = filters.category;
    return limitedFilters;
  }

  if (filters.contentMode !== null) {
    limitedFilters.contentMode = filters.contentMode;
    return limitedFilters;
  }

  if (filters.selectedFolders.length > 0 || filters.excludedFolders.length > 0) {
    limitedFilters.selectedFolders = filters.selectedFolders;
    limitedFilters.excludedFolders = filters.excludedFolders;
    return limitedFilters;
  }

  if (filters.selectedTags.length > 0 || filters.excludedTags.length > 0) {
    limitedFilters.selectedTags = filters.selectedTags;
    limitedFilters.excludedTags = filters.excludedTags;
    return limitedFilters;
  }

  return limitedFilters;
}

interface BrowseClientProps {
  categories: CategoryTree;
  tagGroups?: TagGroupData;
  tagI18n?: Record<string, string>;
  lang: Locale;
  dict: Dictionary;
  initialBoardClipIds?: Set<string> | null;
}

export function BrowseClient({
  categories,
  tagGroups = EMPTY_TAG_GROUPS,
  tagI18n = {},
  lang,
  dict,
  initialBoardClipIds = null,
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
      excludedFolders: s.excludedFolders,
      selectedTags: s.selectedTags,
      excludedTags: s.excludedTags,
      searchQuery: s.searchQuery,
      sortBy: s.sortBy,
      category: s.category,
      contentMode: s.contentMode,
      boardId: s.boardId,
    }))
  );
  const storedBoardClipIds = useBoardStore((s) => s.activeBoardClipIds);
  const activeBoardClipIds = storedBoardClipIds ?? initialBoardClipIds;
  const { user, tier, isLoading: authLoading } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      tier: s.tier,
      isLoading: s.isLoading,
    }))
  );
  const {
    quickViewOpen,
    setQuickViewOpen,
    stepThumbnailSize,
    shuffleSeed,
    thumbnailSize,
    viewMode,
    openPricingModal,
    keyboardHelpOpen,
    toggleKeyboardHelp,
    toggleLeftPanel,
    toggleRightPanel,
  } = useUIStore(
    useShallow((s) => ({
      quickViewOpen: s.quickViewOpen,
      setQuickViewOpen: s.setQuickViewOpen,
      stepThumbnailSize: s.stepThumbnailSize,
      shuffleSeed: s.shuffleSeed,
      thumbnailSize: s.thumbnailSize,
      viewMode: s.viewMode,
      openPricingModal: s.openPricingModal,
      keyboardHelpOpen: s.keyboardHelpOpen,
      toggleKeyboardHelp: s.toggleKeyboardHelp,
      toggleLeftPanel: s.toggleLeftPanel,
      toggleRightPanel: s.toggleRightPanel,
    }))
  );
  const columnCount = getColumnCountFromThumbnailSize(thumbnailSize);
  const viewerTier = getViewerTier(user, tier);
  const isProUser = hasProAccess(user, tier);
  const browseVisibleResultsLimit = getBrowseVisibleResultsLimit(viewerTier);
  const activeFilterAxes = countActiveFilterAxes(filters);
  const isFilterCombinationLimited =
    activeFilterAxes > FREE_MAX_FILTER_AXES && !isProUser;
  const effectiveFilters = useMemo(
    () => (isFilterCombinationLimited ? limitFiltersToSingleAxis(filters) : filters),
    [filters, isFilterCombinationLimited]
  );

  const {
    shouldShow: shouldShowSplash,
    markComplete: markSplashComplete,
  } = useSplashGate("intro");
  const browseMode = useUIStore((s) => s.browseMode);
  const tagData = useTagGroups(tagGroups, lang, tagI18n);
  const splashDismissed = useRef(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

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
    filters.excludedFolders.length > 0 ||
    filters.selectedTags.length > 0 ||
    filters.excludedTags.length > 0 ||
    filters.searchQuery.length > 0 ||
    filters.sortBy !== "newest" ||
    filters.boardId !== null;

  // 전체 탭(contentMode === null)에서 무료 유저는 5개까지만 노출
  const isAllTabLimited = filters.contentMode === null && !isProUser;

  const showFeed = viewMode === "feed" && !hasFeedBlockingFilters(filters);
  const hasSearchOrFilter =
    filters.searchQuery.length > 0 ||
    activeFilterAxes > 0 ||
    filters.boardId !== null;
  const initialDisplayClips = useMemo(() => {
    if (!projectionClips || projectionStatus !== "ready" || columnCount > 3) {
      return initialClips;
    }

    const projectionById = new Map(
      projectionClips.map((clip) => [clip.id, clip] as const)
    );

    return initialClips.map((clip) => {
      const projection = projectionById.get(clip.id);
      return projection ? { ...clip, ...projection } : clip;
    });
  }, [columnCount, initialClips, projectionClips, projectionStatus]);

  // Apply filters only after projection preload is ready.
  const browseResults = useMemo(
    () => {
      if (!projectionClips || projectionStatus !== "ready" || !hasActiveBrowseFilters) {
        let clips = initialDisplayClips;
        // Apply board filter even before projection is ready
        if (filters.boardId && activeBoardClipIds) {
          clips = clips.filter((c) => activeBoardClipIds.has(c.id));
        }
        clips = shuffleSeed === 0 ? clips : shuffleClips(clips);
        const totalResultCount = filters.boardId && activeBoardClipIds
          ? clips.length
          : initialTotalCount;
        const lockedClipIds = isAllTabLimited
          ? new Set(clips.slice(browseVisibleResultsLimit).map((c) => c.id))
          : new Set<string>();
        return {
          clips,
          totalResultCount,
          lockedClipIds,
        };
      }

      // Merge initial media fields (thumbnailUrl, lqipBase64, etc.) into
      // projection records, since filter-index omits them for payload size.
      const summaryById = new Map(
        initialClips.map((clip) => [clip.id, clip] as const)
      );
      const mergedProjection = projectionClips.map((clip) => {
        const summary = summaryById.get(clip.id);
        return summary ? { ...summary, ...clip } : clip;
      });
      const allResults = filterClips(
        mergedProjection,
        effectiveFilters,
        categories,
        tagI18n,
        lang,
        activeBoardClipIds
      );
      const isLimited = (hasSearchOrFilter || isAllTabLimited) && !isProUser;
      const orderedResults =
        shuffleSeed === 0 ? allResults : shuffleClips(allResults);
      const lockedClipIds = isLimited
        ? new Set(orderedResults.slice(browseVisibleResultsLimit).map((clip) => clip.id))
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
      filters.boardId,
      hasSearchOrFilter,
      isProUser,
      isAllTabLimited,
      categories,
      browseVisibleResultsLimit,
      tagI18n,
      shuffleSeed,
      lang,
      activeBoardClipIds,
    ]
  );

  const filtered = browseResults.clips;
  const lockedClipIds = browseResults.lockedClipIds;
  const lockedCount = lockedClipIds.size;

  const indexMap = useMemo(
    () => new Map(filtered.map((c, i) => [c.id, i])),
    [filtered]
  );

  const projectionMap = useMemo(
    () => projectionClips ? new Map(projectionClips.map((c) => [c.id, c])) : null,
    [projectionClips]
  );

  const selectedIndex = selectedClipId ? (indexMap.get(selectedClipId) ?? -1) : -1;
  // In feed mode, clip may not be in `filtered` (limited to initial page).
  // Fall back to projectionMap for O(1) quick-view lookup.
  const selectedClip: BrowseClipRecord | null =
    selectedIndex >= 0
      ? filtered[selectedIndex]
      : selectedClipId && projectionMap
        ? (projectionMap.get(selectedClipId) as BrowseClipRecord | undefined) ?? null
        : null;
  const selectedClipLocked = selectedClip
    ? lockedClipIds.has(selectedClip.id)
    : false;
  const hasHandledResumeRef = useRef(false);
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
    (direction: "up" | "down" | "left" | "right" | "home" | "end") => {
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
      {
        key: "[",
        action: () => toggleLeftPanel(),
        enabled: !quickViewOpen,
      },
      {
        key: "]",
        action: () => toggleRightPanel(),
        enabled: !quickViewOpen,
      },
      {
        key: "?",
        action: () => toggleKeyboardHelp(),
        enabled: !quickViewOpen && !keyboardHelpOpen,
      },
    ],
    [
      quickViewOpen,
      keyboardHelpOpen,
      selectedClip,
      selectedClipLocked,
      selectedIndex,
      setSelectedClipId,
      setQuickViewOpen,
      stepThumbnailSize,
      navigateGrid,
      toggleLeftPanel,
      toggleRightPanel,
      toggleKeyboardHelp,
    ]
  );
  useKeyboardShortcuts(shortcuts);

  const handleCloseQuickView = useCallback(
    () => setQuickViewOpen(false),
    [setQuickViewOpen]
  );

  useEffect(() => {
    if (authLoading || !user || hasHandledResumeRef.current) {
      return;
    }

    if (!projectionClips || projectionStatus !== "ready") {
      return;
    }

    const { clipId, shouldOpen } = readGuestResume(window.location.search);
    if (!clipId) {
      hasHandledResumeRef.current = true;
      return;
    }

    const cleanedUrl = clearGuestResumeParams(
      window.location.pathname,
      window.location.search
    );
    window.history.replaceState(null, "", cleanedUrl);
    hasHandledResumeRef.current = true;

    setSelectedClipId(clipId);

    if (lockedClipIds.has(clipId)) {
      openPricingModal({
        kind: "locked-clip",
        viewerTier,
        clipId,
      });
      return;
    }

    if (shouldOpen) {
      setQuickViewOpen(true);
    }
  }, [
    authLoading,
    lockedClipIds,
    openPricingModal,
    projectionClips,
    projectionStatus,
    setQuickViewOpen,
    setSelectedClipId,
    user,
    viewerTier,
  ]);

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

  const splashOverlay =
    hasHydrated && shouldShowSplash && !splashDismissed.current ? (
      <BrandSplash
        onComplete={() => {
          splashDismissed.current = true;
          markSplashComplete();
        }}
      />
    ) : null;

  if (browseMode === "tags") {
    return (
      <>
        {splashOverlay}
        <TagDetailView tagData={tagData} lang={lang} tagI18n={tagI18n} dict={dict} />
        <KeyboardHelpOverlay dict={dict} />
        <ToastContainer />
      </>
    );
  }

  if (browseMode === "boards") {
    return (
      <>
        {splashOverlay}
        <BoardGalleryView lang={lang} dict={dict} />
        <KeyboardHelpOverlay dict={dict} />
        <ToastContainer />
      </>
    );
  }

  // Board filter loading: boardId is set but clip IDs haven't loaded yet
  if (filters.boardId && !activeBoardClipIds) {
    return (
      <>
        {splashOverlay}
        <BoardContextBar lang={lang} />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="size-5 animate-spin rounded-full border-2 border-muted border-t-accent" />
        </div>
        <KeyboardHelpOverlay dict={dict} />
        <ToastContainer />
      </>
    );
  }

  if (filtered.length === 0) {
    return (
      <>
        {splashOverlay}
        {filters.boardId ? <BoardContextBar lang={lang} /> : null}
        <div className="flex flex-1 items-center justify-center p-8 text-muted">
          {emptyStateLabel}
        </div>
        <KeyboardHelpOverlay dict={dict} />
        <ToastContainer />
      </>
    );
  }

  if (showFeed) {
    return (
      <>
        {splashOverlay}
        <FeedView
          categories={categories}
          lang={lang}
          onOpenQuickView={openQuickViewForClip}
        />
        {quickViewOpen && selectedClip ? (
          <QuickViewModal
            clip={selectedClip}
            categories={categories}
            lang={lang}
            tagI18n={tagI18n}
            dict={dict}
            onClose={handleCloseQuickView}
          />
        ) : null}
        <KeyboardHelpOverlay dict={dict} />
        <ToastContainer />
      </>
    );
  }

  return (
    <>
      {splashOverlay}
      {filters.boardId ? (
        <BoardContextBar lang={lang} />
      ) : null}
      {hasSearchOrFilter || lockedCount > 0 || isFilterCombinationLimited ? (
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <p className="text-xs text-muted" aria-live="polite">
            {hasSearchOrFilter || lockedCount > 0 ? resultCountLabel : null}
            {lockedCount > 0 ? " · " : null}
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
            <button
              type="button"
              onClick={() => openPricingModal()}
              className="text-xs font-medium text-primary hover:underline"
            >
              {lang === "ko" ? "Pro로 잠금 해제" : "Unlock with Pro"}
            </button>
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
          categories={categories}
          lang={lang}
          tagI18n={tagI18n}
          dict={dict}
          onClose={handleCloseQuickView}
        />
      ) : null}
      <KeyboardHelpOverlay dict={dict} />
      <ToastContainer />
    </>
  );
}
