"use client";

import { X } from "lucide-react";
import type { TagSuggestionItem } from "@/lib/tagSuggestions";
import type { Locale } from "@/lib/types";

export interface SearchSuggestionsProps {
  recentSearches: string[];
  popularTags: string[];
  matchedTags: TagSuggestionItem[];
  query: string;
  highlightIndex: number | null;
  onSelect: (value: string) => void;
  onClearRecent: () => void;
  onRemoveRecent: (query: string) => void;
  recentLabel?: string;
  popularLabel?: string;
  suggestionsLabel?: string;
  clearLabel?: string;
  lang?: Locale;
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
  popularLabel = "추천 태그",
  suggestionsLabel = "태그 제안",
  clearLabel = "지우기",
  lang = "ko",
}: SearchSuggestionsProps) {
  const hasQuery = query.trim().length > 0;
  const showRecent = !hasQuery && recentSearches.length > 0;
  const showPopular = !hasQuery && popularTags.length > 0;
  const showMatched = hasQuery && matchedTags.length > 0;
  const showEmpty = hasQuery && matchedTags.length === 0;
  const formatCountLabel = (count: number) =>
    lang === "ko" ? `${count}개 클립` : `${count} clips`;
  const aliasSuffix = lang === "ko" ? "포함" : "included";
  const emptyMessage =
    lang === "ko"
      ? `‘${query.trim()}’와 일치하는 태그 없음`
      : `No tags match '${query.trim()}'`;

  if (!showRecent && !showPopular && !showMatched && !showEmpty) {
    return null;
  }

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
          {matchedTags.map((item) => {
            const idx = flatIndex++;
            return (
              <div
                key={`match-${item.tag}`}
                role="option"
                id={`suggestion-${idx}`}
                aria-selected={highlightIndex === idx}
                aria-label={`${item.tag} - ${formatCountLabel(item.count)}`}
                onClick={() => onSelect(item.tag)}
                className={`cursor-pointer px-3 py-2 ${
                  highlightIndex === idx ? "bg-accent/10" : "hover:bg-surface-hover"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.isAi ? (
                      <span
                        aria-hidden="true"
                        className="inline-flex shrink-0 items-center rounded px-1 py-px text-[10px] font-semibold leading-none text-accent/70 bg-accent/10"
                      >
                        AI
                      </span>
                    ) : item.groupColor ? (
                      <span
                        aria-hidden="true"
                        className="inline-block size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: item.groupColor }}
                      />
                    ) : null}
                    <span className="truncate text-sm font-medium">
                      {item.tag}
                    </span>
                  </div>
                  {item.count > 0 ? (
                    <span className="ml-2 shrink-0 text-xs tabular-nums text-muted">
                      {item.count}
                    </span>
                  ) : null}
                </div>
                {item.aliases ? (
                  <p className="mt-0.5 text-[11px] text-muted pl-4">
                    {item.aliases.join(", ")} {aliasSuffix}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {showEmpty ? (
        <div className="px-3 py-4 text-center text-sm text-muted">
          {emptyMessage}
        </div>
      ) : null}
    </div>
  );
}

/** Count total selectable items for keyboard navigation bounds */
export function getSuggestionCount(
  recentSearches: string[],
  popularTags: string[],
  matchedTags: TagSuggestionItem[],
  query: string
): number {
  const hasQuery = query.trim().length > 0;
  if (hasQuery) return matchedTags.length;
  return recentSearches.length + popularTags.length;
}
