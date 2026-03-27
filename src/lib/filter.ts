import type { CategoryTree, ContentMode, Locale, SortBy } from "./types";
import { collectDescendantIds } from "./categories";
import { getAllClipTags } from "./aiTags";
import { searchClips, type SearchableClipRecord } from "./clipSearch";

export interface FilterState {
  selectedFolders: string[];
  excludedFolders: string[];
  selectedTags: string[];
  excludedTags: string[];
  starFilter: number | null;
  searchQuery: string;
  sortBy: SortBy;
  category: string | null;
  contentMode: ContentMode | null;
}

/** True when any filter is active that makes feed mode inappropriate (excludes contentMode/sortBy). */
export function hasFeedBlockingFilters(state: FilterState): boolean {
  return (
    state.category !== null ||
    state.selectedFolders.length > 0 ||
    state.excludedFolders.length > 0 ||
    state.selectedTags.length > 0 ||
    state.excludedTags.length > 0 ||
    state.starFilter !== null ||
    state.searchQuery.length > 0
  );
}

const CONTENT_MODE_KEYWORD: Record<ContentMode, string> = {
  direction: "연출",
  game: "게임",
};

interface FilterableClipRecord extends SearchableClipRecord {
  category: string;
  folders?: string[];
  star: number;
}

export function filterClips<T extends FilterableClipRecord>(
  clips: T[],
  filters: FilterState,
  categories?: CategoryTree,
  tagI18n: Record<string, string> = {},
  lang: Locale = "ko"
): T[] {
  let result = clips;

  if (filters.category) {
    result = result.filter((c) => c.category === filters.category);
  }

  if (filters.contentMode) {
    const keyword = CONTENT_MODE_KEYWORD[filters.contentMode];
    result = result.filter((c) => c.name.includes(keyword));
  }

  if (filters.selectedFolders.length > 0) {
    const expandedIds = categories
      ? new Set(filters.selectedFolders.flatMap((id) => collectDescendantIds(id, categories)))
      : new Set(filters.selectedFolders);
    result = result.filter((c) =>
      (c.folders ?? []).some((f) => expandedIds.has(f))
    );
  }

  if (filters.excludedFolders.length > 0) {
    const expandedIds = categories
      ? new Set(filters.excludedFolders.flatMap((id) => collectDescendantIds(id, categories)))
      : new Set(filters.excludedFolders);
    result = result.filter((c) =>
      !(c.folders ?? []).some((f) => expandedIds.has(f))
    );
  }

  // Tag filter: AND logic — clip must have ALL selected tags
  if (filters.selectedTags.length > 0) {
    result = result.filter((c) =>
      filters.selectedTags.every((t) => getAllClipTags(c).includes(t))
    );
  }

  // Exclude filter: OR logic — clip with ANY excluded tag is hidden
  if (filters.excludedTags.length > 0) {
    result = result.filter((c) =>
      !filters.excludedTags.some((t) => getAllClipTags(c).includes(t))
    );
  }

  if (filters.starFilter !== null) {
    result = result.filter((c) => c.star >= filters.starFilter!);
  }

  if (filters.searchQuery) {
    return searchClips(result, {
      lang,
      query: filters.searchQuery,
      tagI18n,
    });
  }

  return sortClips(result, filters.sortBy);
}

export function shuffleClips<T>(items: T[], rng: () => number = Math.random): T[] {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function sortClips<T extends Pick<FilterableClipRecord, "name" | "star">>(
  clips: T[],
  sortBy: SortBy
): T[] {
  const sorted = [...clips];
  switch (sortBy) {
    case "newest":
      return sorted;
    case "rating":
      return sorted.sort((a, b) => b.star - a.star);
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }
}
