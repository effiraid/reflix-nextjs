"use client";

import { MIN_THUMBNAIL_SIZE, MAX_THUMBNAIL_SIZE } from "@/lib/thumbnailSize";
import { getCategoryLabel } from "@/lib/categories";
import { getTagDisplayLabel } from "@/lib/tagDisplay";
import { useFilterStore } from "@/stores/filterStore";
import { useUIStore } from "@/stores/uiStore";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { CategoryTree, Locale } from "@/lib/types";
import { useShallow } from "zustand/react/shallow";

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
  } = useUIStore(
    useShallow((state) => ({
      filterBarOpen: state.filterBarOpen,
      setFilterBarOpen: state.setFilterBarOpen,
      thumbnailSize: state.thumbnailSize,
      setThumbnailSize: state.setThumbnailSize,
      activeFilterTab: state.activeFilterTab,
      setActiveFilterTab: state.setActiveFilterTab,
      reshuffleClips: state.reshuffleClips,
    }))
  );
  const { selectedFolders, selectedTags, excludedTags } = useFilterStore(
    useShallow((state) => ({
      selectedFolders: state.selectedFolders,
      selectedTags: state.selectedTags,
      excludedTags: state.excludedTags,
    }))
  );
  const filterTabs = [{ id: "tags", label: dict.clip.tags, icon: TagIcon }] as const;
  const shuffleLabel = lang === "ko" ? "무작위로 섞기" : "Shuffle clips";
  const filterLabel = lang === "ko" ? "태그 필터" : "Tag filters";
  const filterSummary = buildFilterSummary({
    categories,
    excludedTags,
    lang,
    selectedFolders,
    selectedTags,
    tagI18n,
  });

  function handleFilterToggle() {
    const nextOpen = !filterBarOpen;
    setFilterBarOpen(nextOpen);
    if (!nextOpen) setActiveFilterTab(null);
  }

  return (
    <div className="shrink-0 border-b border-border">
      {/* Top toolbar row */}
      <div className="grid h-10 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3">
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
          <button
            type="button"
            aria-label={shuffleLabel}
            onClick={reshuffleClips}
            className="p-1.5 rounded hover:bg-surface-hover text-muted"
          >
            <RefreshIcon />
          </button>
        </div>

        <div className="min-w-0 justify-self-center px-2 text-center text-xs text-muted">
          {filterSummary ? (
            <span
              aria-live="polite"
              className="block max-w-56 truncate md:max-w-80"
              title={filterSummary}
            >
              {filterSummary}
            </span>
          ) : null}
        </div>

        {/* Right: Thumbnail size slider */}
        <div className="flex items-center gap-1.5 justify-self-end">
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

function buildFilterSummary({
  categories,
  excludedTags,
  lang,
  selectedFolders,
  selectedTags,
  tagI18n,
}: {
  categories: CategoryTree;
  excludedTags: string[];
  lang: Locale;
  selectedFolders: string[];
  selectedTags: string[];
  tagI18n: Record<string, string>;
}): string | null {
  const parts: string[] = [];

  if (selectedFolders.length > 0) {
    parts.push(
      summarizeFilterValues(
        lang === "ko" ? "폴더" : "Folder",
        selectedFolders.map((folderId) => getCategoryLabel(folderId, categories, lang)),
        lang
      )
    );
  }

  if (selectedTags.length > 0) {
    parts.push(
      summarizeFilterValues(
        lang === "ko" ? "태그" : "Tag",
        selectedTags.map((tag) => getTagDisplayLabel(tag, lang, tagI18n)),
        lang
      )
    );
  }

  if (excludedTags.length > 0) {
    parts.push(
      summarizeFilterValues(
        lang === "ko" ? "제외" : "Exclude",
        excludedTags.map((tag) => getTagDisplayLabel(tag, lang, tagI18n)),
        lang
      )
    );
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

function summarizeFilterValues(
  label: string,
  values: string[],
  lang: Locale
): string {
  const [firstValue, ...restValues] = values;

  if (!firstValue) {
    return label;
  }

  if (restValues.length === 0) {
    return `${label}: ${firstValue}`;
  }

  if (lang === "ko") {
    return `${label}: ${firstValue} 외 ${restValues.length}개`;
  }

  return `${label}: ${firstValue} +${restValues.length}`;
}

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
