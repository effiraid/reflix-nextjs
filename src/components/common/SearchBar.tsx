"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, SearchIcon } from "lucide-react";
import {
  SearchSuggestions,
  getSuggestionCount,
} from "./SearchSuggestions";
import {
  matchTagsWithMeta,
  buildTagGroupLookup,
  buildClientAliasMap,
  diversifyPopularTags,
  type TagSuggestionItem,
} from "@/lib/tagSuggestions";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  migrateRecentSearches,
  removeRecentSearch,
} from "@/lib/recentSearches";
import type { TagAliasConfig } from "@/lib/data";
import type { Locale, TagGroupData } from "@/lib/types";
import { useUIStore } from "@/stores/uiStore";

interface SearchBarProps {
  initialQuery?: string;
  placeholder: string;
  onSearch: (query: string) => void;
  debounceMs?: number;
  isSearching?: boolean;
  statusText?: string;
  autoFocus?: boolean;
  /** All available tags for autocomplete suggestions */
  allTags?: string[];
  /** Popular tags shown when input is empty */
  popularTags?: string[];
  /** Per-tag clip counts */
  tagCounts?: Record<string, number>;
  /** Tag group data for color dots */
  tagGroups?: TagGroupData;
  /** Alias config for merge captions */
  aliasConfig?: TagAliasConfig | null;
  /** Locale for tag matching (choseong, fuzzy) */
  lang?: Locale;
  /** i18n labels */
  recentLabel?: string;
  popularLabel?: string;
  suggestionsLabel?: string;
  clearLabel?: string;
  onActivate?: () => void;
}

export function SearchBar({
  initialQuery = "",
  placeholder,
  onSearch,
  debounceMs = 150,
  isSearching = false,
  statusText,
  autoFocus = false,
  allTags = [],
  popularTags = [],
  tagCounts = {},
  tagGroups,
  aliasConfig = null,
  lang = "ko",
  recentLabel,
  popularLabel,
  suggestionsLabel,
  clearLabel,
  onActivate,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Precompute tag group lookup (stable across renders)
  const tagGroupLookup = useMemo(
    () => (tagGroups ? buildTagGroupLookup(tagGroups, lang) : undefined),
    [tagGroups, lang]
  );

  // Precompute alias map
  const aliasMap = useMemo(
    () => buildClientAliasMap(aliasConfig),
    [aliasConfig]
  );

  // Diversify popular tags: max 2 per parent group for variety
  const diversifiedPopularTags = useMemo(
    () =>
      tagGroups && tagGroupLookup
        ? diversifyPopularTags(popularTags, tagCounts, tagGroupLookup, tagGroups)
        : popularTags,
    [popularTags, tagCounts, tagGroupLookup, tagGroups]
  );

  // Sync external initialQuery
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // Load recent searches on mount + migrate aliases
  useEffect(() => {
    if (aliasConfig?.aliases) {
      migrateRecentSearches(aliasConfig.aliases, aliasConfig.version);
    }
    setRecentSearches(getRecentSearches());
  }, [aliasConfig]);

  // Debounced search
  useEffect(() => {
    if (query === initialQuery) {
      return;
    }

    timeoutRef.current = window.setTimeout(() => {
      startTransition(() => {
        onSearch(query.trim());
      });
    }, debounceMs);

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [debounceMs, initialQuery, onSearch, query]);

  // Outside click detection
  useEffect(() => {
    if (!open) return;

    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        useUIStore.getState().setSearchFocused(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  // Rich matched tags for autocomplete
  const matchedTags: TagSuggestionItem[] = useMemo(
    () =>
      allTags.length > 0
        ? matchTagsWithMeta(allTags, query, lang, {
            tagCounts,
            tagGroupLookup,
            aliasMap,
          })
        : [],
    [allTags, query, lang, tagCounts, tagGroupLookup, aliasMap]
  );

  const suggestionCount = useMemo(
    () => getSuggestionCount(recentSearches, diversifiedPopularTags, matchedTags, query),
    [recentSearches, diversifiedPopularTags, matchedTags, query]
  );

  const hasSuggestions = suggestionCount > 0;
  // Also show dropdown when query has input but no matches (empty state)
  const hasQuery = query.trim().length > 0;
  const showDropdown = open && (hasSuggestions || hasQuery);

  const executeSearch = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setQuery(trimmed);
      setOpen(false);
      setHighlightIndex(null);
      useUIStore.getState().setSearchFocused(false);
      inputRef.current?.blur();
      onSearch(trimmed);
      if (trimmed) {
        addRecentSearch(trimmed);
        setRecentSearches(getRecentSearches());
      }
    },
    [onSearch]
  );

  // Build flat items list for highlight resolution (tag strings only)
  const flatItems = useMemo(() => {
    const items: string[] = [];
    if (!hasQuery) {
      items.push(...recentSearches);
      items.push(...diversifiedPopularTags);
    } else {
      items.push(...matchedTags.map((t) => t.tag));
    }
    return items;
  }, [hasQuery, recentSearches, diversifiedPopularTags, matchedTags]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || !hasSuggestions) {
      if (e.key === "ArrowDown" && hasSuggestions) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
        setHighlightIndex(0);
        return;
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        setHighlightIndex((prev) =>
          prev === null || prev >= suggestionCount - 1 ? 0 : prev + 1
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        setHighlightIndex((prev) =>
          prev === null || prev <= 0 ? suggestionCount - 1 : prev - 1
        );
        break;
      case "Enter":
        if (highlightIndex !== null && flatItems[highlightIndex]) {
          e.preventDefault();
          e.stopPropagation();
          executeSearch(flatItems[highlightIndex]);
        } else {
          // No highlight — let form submit handle it
          setOpen(false);
          setHighlightIndex(null);
        }
        break;
      case "Escape":
        e.stopPropagation();
        setOpen(false);
        setHighlightIndex(null);
        useUIStore.getState().setSearchFocused(false);
        inputRef.current?.blur();
        break;
    }
  }

  function handleChange(value: string) {
    setQuery(value);
    setHighlightIndex(null);
    setOpen(true);
  }

  function handleFocus() {
    onActivate?.();
    setOpen(true);
    useUIStore.getState().setSearchFocused(true);
  }

  function handleClearRecent() {
    clearRecentSearches();
    setRecentSearches([]);
  }

  function handleRemoveRecent(q: string) {
    removeRecentSearch(q);
    setRecentSearches(getRecentSearches());
  }

  return (
    <form
      role="search"
      aria-label={placeholder}
      aria-busy={isSearching}
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        executeSearch(query);
      }}
    >
      <div ref={containerRef} className="relative">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
          strokeWidth={1.9}
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-activedescendant={
            highlightIndex !== null ? `suggestion-${highlightIndex}` : undefined
          }
          aria-autocomplete="list"
          autoFocus={autoFocus}
          className="h-10 w-full rounded-full border border-border bg-surface pl-11 pr-10 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-foreground/40"
        />
        {isSearching ? (
          <Loader2
            data-testid="search-spinner"
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted"
            strokeWidth={1.9}
          />
        ) : null}

        {showDropdown ? (
          <SearchSuggestions
            recentSearches={recentSearches}
            popularTags={diversifiedPopularTags}
            matchedTags={matchedTags}
            query={query}
            highlightIndex={highlightIndex}
            onSelect={executeSearch}
            onClearRecent={handleClearRecent}
            onRemoveRecent={handleRemoveRecent}
            recentLabel={recentLabel}
            popularLabel={popularLabel}
            suggestionsLabel={suggestionsLabel}
            clearLabel={clearLabel}
            lang={lang}
          />
        ) : null}
      </div>
      {statusText ? (
        <p className="px-3 pt-2 text-xs text-muted" aria-live="polite">
          {statusText}
        </p>
      ) : null}
    </form>
  );
}
