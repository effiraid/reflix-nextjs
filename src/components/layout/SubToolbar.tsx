"use client";

import {
  forwardRef,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import { usePathname } from "next/navigation";
import { useShallow } from "zustand/react/shallow";

import { updateFilterURL } from "@/hooks/useFilterSync";
import { MIN_THUMBNAIL_SIZE, MAX_THUMBNAIL_SIZE } from "@/lib/thumbnailSize";
import { getCategoryLabel } from "@/lib/categories";
import { hasFeedBlockingFilters } from "@/lib/filter";
import { getTagDisplayLabel } from "@/lib/tagDisplay";
import {
  BADGE_GAP_PX,
  getOverflowBadgeLabel,
  getVisibleBadgeCount,
} from "@/lib/toolbarFilterBadges";
import { hasProAccess } from "@/lib/accessPolicy";
import { useAuthStore } from "@/stores/authStore";
import { useFilterStore } from "@/stores/filterStore";
import { useUIStore } from "@/stores/uiStore";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { CategoryTree, Locale } from "@/lib/types";

interface SubToolbarProps {
  categories: CategoryTree;
  lang: Locale;
  dict: Pick<Dictionary, "clip">;
  tagI18n?: Record<string, string>;
}

export function SubToolbar({
  categories,
  lang,
  dict,
  tagI18n = {},
}: SubToolbarProps) {
  const {
    filterBarOpen,
    setFilterBarOpen,
    thumbnailSize,
    setThumbnailSize,
    activeFilterTab,
    setActiveFilterTab,
    reshuffleClips,
    viewMode,
    searchFocused,
    browseMode,
  } = useUIStore(
    useShallow((state) => ({
      filterBarOpen: state.filterBarOpen,
      setFilterBarOpen: state.setFilterBarOpen,
      thumbnailSize: state.thumbnailSize,
      setThumbnailSize: state.setThumbnailSize,
      activeFilterTab: state.activeFilterTab,
      setActiveFilterTab: state.setActiveFilterTab,
      reshuffleClips: state.reshuffleClips,
      viewMode: state.viewMode,
      searchFocused: state.searchFocused,
      browseMode: state.browseMode,
    }))
  );
  const { user, tier } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      tier: state.tier,
    }))
  );
  const { selectedFolders, excludedFolders, selectedTags, excludedTags } = useFilterStore(
    useShallow((state) => ({
      selectedFolders: state.selectedFolders,
      excludedFolders: state.excludedFolders,
      selectedTags: state.selectedTags,
      excludedTags: state.excludedTags,
    }))
  );
  const pathname = usePathname();

  const filterTabs = [{ id: "tags", label: dict.clip.tags, icon: TagIcon }] as const;
  const shuffleLabel = lang === "ko" ? "무작위로 섞기" : "Shuffle clips";
  const filterLabel = lang === "ko" ? "태그 필터" : "Tag filters";

  const isProUser = hasProAccess(user, tier);
  const filterBadges = useMemo(
    () =>
      buildFilterBadges({
        categories,
        excludedFolders,
        excludedTags,
        lang,
        selectedFolders,
        selectedTags,
        tagI18n,
      }),
    [categories, excludedFolders, excludedTags, lang, selectedFolders, selectedTags, tagI18n]
  );

  const badgeTrackRef = useRef<HTMLDivElement | null>(null);
  const overflowMeasureRef = useRef<HTMLElement | null>(null);
  const badgeMeasureRefs = useRef<(HTMLElement | null)[]>([]);
  const [visibleBadgeCount, setVisibleBadgeCount] = useState(filterBadges.length);
  const hiddenBadgeCount = Math.max(filterBadges.length - visibleBadgeCount, 0);
  const visibleBadges = filterBadges.slice(0, visibleBadgeCount);

  useLayoutEffect(() => {
    function measureOverflowBadgeWidth(nextHiddenBadgeCount: number) {
      const overflowMeasureEl = overflowMeasureRef.current;

      if (!overflowMeasureEl) {
        return 0;
      }

      overflowMeasureEl.textContent = getOverflowBadgeLabel(nextHiddenBadgeCount);
      return overflowMeasureEl.offsetWidth;
    }

    function recalculateVisibleBadgeCount() {
      const trackWidth = badgeTrackRef.current?.offsetWidth ?? 0;

      if (trackWidth <= 0) {
        setVisibleBadgeCount((currentCount) =>
          currentCount === filterBadges.length ? currentCount : filterBadges.length
        );
        return;
      }

      const badgeWidths = filterBadges.map(
        (_, index) => badgeMeasureRefs.current[index]?.offsetWidth ?? 0
      );
      const nextVisibleBadgeCount = getVisibleBadgeCount({
        badgeWidths,
        containerWidth: trackWidth,
        gapPx: BADGE_GAP_PX,
        getOverflowBadgeWidth: measureOverflowBadgeWidth,
      });

      setVisibleBadgeCount((currentCount) =>
        currentCount === nextVisibleBadgeCount
          ? currentCount
          : nextVisibleBadgeCount
      );
    }

    recalculateVisibleBadgeCount();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      recalculateVisibleBadgeCount();
    });

    if (badgeTrackRef.current) {
      resizeObserver.observe(badgeTrackRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [filterBadges, lang]);

  function handleFilterBadgeClick(badge: FilterBadgeData) {
    const state = useFilterStore.getState();

    switch (badge.kind) {
      case "selected-folder":
        updateFilterURL(pathname, {
          selectedFolders: state.selectedFolders.filter((id) => id !== badge.value),
        });
        return;
      case "excluded-folder":
        updateFilterURL(pathname, {
          excludedFolders: state.excludedFolders.filter((id) => id !== badge.value),
        });
        return;
      case "selected-tag":
        updateFilterURL(pathname, {
          selectedTags: state.selectedTags.filter((tag) => tag !== badge.value),
        });
        return;
      case "excluded-tag":
        updateFilterURL(pathname, {
          excludedTags: state.excludedTags.filter((tag) => tag !== badge.value),
        });
        return;
    }
  }

  function handleFilterToggle() {
    const nextOpen = !filterBarOpen;
    setFilterBarOpen(nextOpen);
    if (!nextOpen) setActiveFilterTab(null);
  }

  const feedBlocking = useFilterStore((s) => hasFeedBlockingFilters(s));
  if (viewMode === "feed" && !feedBlocking) return null;
  if (browseMode !== "grid") return null;

  return (
    <div className="shrink-0 border-b border-border">
      {/* Top toolbar row */}
      <div className="grid h-10 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3">
        {/* Left: Filter + Shuffle */}
        <div className="flex items-center gap-1 justify-self-start">
          <button
            type="button"
            aria-label={filterLabel}
            onClick={handleFilterToggle}
            className={`p-1.5 rounded ${
              filterBarOpen
                ? "bg-accent text-white"
                : "hover:bg-surface-hover text-muted"
            }`}
          >
            <FilterIcon />
          </button>
          {isProUser ? (
            <button
              type="button"
              aria-label={shuffleLabel}
              onClick={reshuffleClips}
              className="p-1.5 rounded hover:bg-surface-hover text-muted"
            >
              <RefreshIcon />
            </button>
          ) : null}
        </div>

        <div className="min-w-0 px-2">
          {filterBadges.length > 0 ? (
            <div className="relative">
              <div
                ref={badgeTrackRef}
                aria-label={lang === "ko" ? "현재 필터" : "Current filters"}
                data-testid="toolbar-filter-badges"
                className="overflow-hidden"
              >
                <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                  {visibleBadges.map((badge) => (
                    <FilterBadge
                      key={badge.key}
                      label={badge.label}
                      interactive
                      onClick={() => handleFilterBadgeClick(badge)}
                    />
                  ))}
                  {hiddenBadgeCount > 0 ? (
                    <FilterBadge
                      label={getOverflowBadgeLabel(hiddenBadgeCount)}
                    />
                  ) : null}
                </div>
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 -z-10 opacity-0"
              >
                <div className="flex w-max items-center gap-1.5 whitespace-nowrap">
                  {filterBadges.map((badge, index) => (
                    <FilterBadge
                      key={`measure-${badge.key}-${index}`}
                      label={badge.label}
                      interactive
                      ref={(node) => {
                        badgeMeasureRefs.current[index] = node;
                      }}
                    />
                  ))}
                  <FilterBadge
                    label={getOverflowBadgeLabel(filterBadges.length)}
                    ref={overflowMeasureRef}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right: Thumbnail size slider (hidden when search focused) */}
        <div className={`flex items-center gap-1.5 justify-self-end${searchFocused ? " invisible" : ""}`}>
          <button
            type="button"
            aria-label="-"
            onClick={() => setThumbnailSize(thumbnailSize - 1)}
            disabled={thumbnailSize <= MIN_THUMBNAIL_SIZE}
            className="p-1 rounded hover:bg-surface-hover text-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MinusIcon />
          </button>
          <input
            type="range"
            min={0}
            max={MAX_THUMBNAIL_SIZE}
            step={1}
            value={thumbnailSize}
            onChange={(e) => setThumbnailSize(Number(e.target.value))}
            aria-label="Thumbnail size"
            className="w-24 h-1 accent-muted"
          />
          <button
            type="button"
            aria-label="+"
            onClick={() => setThumbnailSize(thumbnailSize + 1)}
            disabled={thumbnailSize >= MAX_THUMBNAIL_SIZE}
            className="p-1 rounded hover:bg-surface-hover text-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      {/* Filter tabs row (toggled) */}
      {filterBarOpen && (
        <div data-filter-tabs className="h-9 flex items-center px-3 gap-1 border-t border-border bg-surface/50">
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeFilterTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() =>
                  setActiveFilterTab(isActive ? null : tab.id)
                }
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                  isActive
                    ? "bg-accent text-white"
                    : "hover:bg-surface-hover text-muted"
                }`}
              >
                <Icon />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type FilterBadgeData = {
  key: string;
  kind: "selected-folder" | "excluded-folder" | "selected-tag" | "excluded-tag";
  label: string;
  value: string;
};

function buildFilterBadges({
  categories,
  excludedFolders,
  excludedTags,
  lang,
  selectedFolders,
  selectedTags,
  tagI18n,
}: {
  categories: CategoryTree;
  excludedFolders: string[];
  excludedTags: string[];
  lang: Locale;
  selectedFolders: string[];
  selectedTags: string[];
  tagI18n: Record<string, string>;
}): FilterBadgeData[] {
  const badges: FilterBadgeData[] = [];

  if (selectedFolders.length > 0) {
    badges.push(
      ...selectedFolders.map((folderId) => ({
        key: `selected-folder:${folderId}`,
        kind: "selected-folder" as const,
        label: getCategoryLabel(folderId, categories, lang),
        value: folderId,
      }))
    );
  }

  if (selectedTags.length > 0) {
    badges.push(
      ...selectedTags.map((tag) => ({
        key: `selected-tag:${tag}`,
        kind: "selected-tag" as const,
        label: getTagDisplayLabel(tag, lang, tagI18n),
        value: tag,
      }))
    );
  }

  if (excludedFolders.length > 0) {
    badges.push(
      ...excludedFolders.map((folderId) => ({
        key: `excluded-folder:${folderId}`,
        kind: "excluded-folder" as const,
        label: `-${getCategoryLabel(folderId, categories, lang)}`,
        value: folderId,
      }))
    );
  }

  if (excludedTags.length > 0) {
    badges.push(
      ...excludedTags.map((tag) => ({
        key: `excluded-tag:${tag}`,
        kind: "excluded-tag" as const,
        label: `-${getTagDisplayLabel(tag, lang, tagI18n)}`,
        value: tag,
      }))
    );
  }

  return badges;
}

const FilterBadge = forwardRef<
  HTMLElement,
  { label: string; interactive?: boolean; onClick?: () => void }
>(function FilterBadge({ label, interactive = false, onClick }, ref) {
  const className =
    "inline-flex shrink-0 items-center rounded-full border border-border/70 bg-surface/80 px-2.5 py-1 text-[11px] leading-none text-muted";

  if (interactive) {
    return (
      <button
        type="button"
        ref={ref as Ref<HTMLButtonElement>}
        onClick={onClick}
        className={`${className} cursor-pointer appearance-none transition-colors hover:bg-surface-hover`}
      >
        {label}
      </button>
    );
  }

  return (
    <span
      ref={ref as Ref<HTMLSpanElement>}
      className={className}
    >
      {label}
    </span>
  );
});

/* --- Icons (14×14) --- */

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 7H11" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M7 3V11M3 7H11" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 6.5A4.5 4.5 0 0 0 3.17 4.5M2.5 7.5A4.5 4.5 0 0 0 10.83 9.5" />
      <path d="M11.5 3V6.5H8M2.5 11V7.5H6" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 3H12.5M3.5 7H10.5M5.5 11H8.5" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 2.5H6L12.5 9L8.5 13L2 6.5V2.5Z" />
      <circle cx="4.5" cy="4.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
