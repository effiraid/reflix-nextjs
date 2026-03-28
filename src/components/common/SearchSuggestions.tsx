"use client";

import { X } from "lucide-react";

export interface SearchSuggestionsProps {
  recentSearches: string[];
  popularTags: string[];
  matchedTags: string[];
  query: string;
  highlightIndex: number | null;
  onSelect: (value: string) => void;
  onClearRecent: () => void;
  onRemoveRecent: (query: string) => void;
  recentLabel?: string;
  popularLabel?: string;
  suggestionsLabel?: string;
  clearLabel?: string;
}

export function SearchSuggestions({
  recentSearches,
  popularTags,
  matchedTags,
  query,
  highlightIndex,
  onSelect,
  onClearRecent,
  onRemoveRecent,
  recentLabel = "최근 검색어",
  popularLabel = "인기 태그",
  suggestionsLabel = "태그 제안",
  clearLabel = "지우기",
}: SearchSuggestionsProps) {
  const hasQuery = query.trim().length > 0;
  const showRecent = !hasQuery && recentSearches.length > 0;
  const showPopular = !hasQuery && popularTags.length > 0;
  const showMatched = hasQuery && matchedTags.length > 0;

  if (!showRecent && !showPopular && !showMatched) {
    return null;
  }

  // Build flat list of selectable items for highlight index mapping
  const items: string[] = [];
  if (showRecent) items.push(...recentSearches);
  if (showPopular) items.push(...popularTags);
  if (showMatched) items.push(...matchedTags);

  let flatIndex = 0;

  return (
    <div
      role="listbox"
      aria-label={suggestionsLabel}
      className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[320px] overflow-y-auto rounded-lg border border-border bg-surface shadow-xl"
    >
      {showRecent ? (
        <div>
          <div className="flex items-center justify-between px-3 pb-1 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {recentLabel}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClearRecent();
              }}
              className="text-xs text-muted hover:text-foreground"
            >
              {clearLabel}
            </button>
          </div>
          {recentSearches.map((item) => {
            const idx = flatIndex++;
            return (
              <div
                key={`recent-${item}`}
                role="option"
                id={`suggestion-${idx}`}
                aria-selected={highlightIndex === idx}
                onClick={() => onSelect(item)}
                className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                  highlightIndex === idx ? "bg-accent/10" : "hover:bg-surface-hover"
                }`}
              >
                <span className="truncate">{item}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveRecent(item);
                  }}
                  className="ml-2 shrink-0 text-muted hover:text-foreground"
                  aria-label={`Remove ${item}`}
                >
                  <X className="size-3.5" strokeWidth={1.75} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {showPopular ? (
        <div>
          <div className="px-3 pb-1 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {popularLabel}
            </span>
          </div>
          <div
            role="group"
            aria-label={popularLabel}
            className="flex flex-wrap gap-1.5 px-3 pb-2"
          >
            {popularTags.map((tag) => {
              const idx = flatIndex++;
              return (
                <button
                  key={`popular-${tag}`}
                  type="button"
                  role="option"
                  id={`suggestion-${idx}`}
                  aria-selected={highlightIndex === idx}
                  onClick={() => onSelect(tag)}
                  className={`cursor-pointer rounded-full px-2 py-1 text-xs ${
                    highlightIndex === idx
                      ? "bg-accent/10 text-foreground"
                      : "bg-surface-hover text-foreground hover:bg-accent/10"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {showMatched ? (
        <div>
          <div className="px-3 pb-1 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {suggestionsLabel}
            </span>
          </div>
          {matchedTags.map((tag) => {
            const idx = flatIndex++;
            return (
              <div
                key={`match-${tag}`}
                role="option"
                id={`suggestion-${idx}`}
                aria-selected={highlightIndex === idx}
                onClick={() => onSelect(tag)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  highlightIndex === idx ? "bg-accent/10" : "hover:bg-surface-hover"
                }`}
              >
                {tag}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Count total selectable items for keyboard navigation bounds */
export function getSuggestionCount(
  recentSearches: string[],
  popularTags: string[],
  matchedTags: string[],
  query: string
): number {
  const hasQuery = query.trim().length > 0;
  if (hasQuery) return matchedTags.length;
  return recentSearches.length + popularTags.length;
}
