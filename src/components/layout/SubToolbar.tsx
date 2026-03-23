"use client";

import { MAX_THUMBNAIL_SIZE } from "@/lib/thumbnailSize";
import { useFilterSync } from "@/hooks/useFilterSync";
import { useFilterStore } from "@/stores/filterStore";
import { useUIStore } from "@/stores/uiStore";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/types";

interface SubToolbarProps {
  lang: Locale;
  dict: Pick<Dictionary, "browse" | "clip" | "nav">;
}

export function SubToolbar({ lang, dict }: SubToolbarProps) {
  const {
    filterBarOpen,
    setFilterBarOpen,
    thumbnailSize,
    setThumbnailSize,
    activeFilterTab,
    setActiveFilterTab,
    reshuffleClips,
  } = useUIStore();
  const searchQuery = useFilterStore((state) => state.searchQuery);
  const { updateURL } = useFilterSync();

  const filterTabs = [{ id: "tags", label: dict.clip.tags, icon: TagIcon }] as const;
  const shuffleLabel = lang === "ko" ? "무작위로 섞기" : "Shuffle clips";
  const filterLabel = lang === "ko" ? "태그 필터" : "Tag filters";

  function handleFilterToggle() {
    const nextOpen = !filterBarOpen;
    setFilterBarOpen(nextOpen);
    setActiveFilterTab(nextOpen ? "tags" : null);
  }

  return (
    <div className="shrink-0 border-b border-border">
      {/* Top toolbar row */}
      <div className="h-10 flex items-center px-3 gap-2">
        {/* Spacer */}
        <div className="flex-1" />

        {/* Thumbnail size slider */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setThumbnailSize(thumbnailSize - 1)}
            className="p-1 rounded hover:bg-surface-hover text-muted"
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
            className="w-24 h-1 accent-muted"
          />
          <button
            onClick={() => setThumbnailSize(thumbnailSize + 1)}
            className="p-1 rounded hover:bg-surface-hover text-muted"
          >
            <PlusIcon />
          </button>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          aria-label={shuffleLabel}
          onClick={reshuffleClips}
          className="p-1.5 rounded hover:bg-surface-hover text-muted"
        >
          <RefreshIcon />
        </button>

        {/* Filter toggle */}
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

        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => updateURL({ searchQuery: e.target.value })}
            placeholder={dict.nav.searchPlaceholder}
            aria-label={dict.nav.search}
            className="w-40 h-7 pl-7 pr-2 text-sm rounded border border-border bg-background focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Filter tabs row (toggled) */}
      {filterBarOpen && (
        <div className="h-9 flex items-center px-3 gap-1 border-t border-border bg-surface/50">
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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="6" cy="6" r="4" />
      <path d="M9 9L12.5 12.5" />
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
