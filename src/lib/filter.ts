import type { CategoryTree, ContentMode, Locale, SortBy } from "./types";
import { collectDescendantIds, filterCategoriesByMode } from "./categories";
import { getAllClipTags } from "./aiTags";
import { searchClips, type SearchableClipRecord } from "./clipSearch";

export interface FilterState {
  selectedFolders: string[];
  excludedFolders: string[];
  selectedTags: string[];
  excludedTags: string[];
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
    if (categories) {
      const modeTree = filterCategoriesByMode(categories, filters.contentMode);
      const modeFolderIds = new Set<string>();
      for (const id of Object.keys(modeTree)) {
        for (const fid of collectDescendantIds(id, modeTree)) {
          modeFolderIds.add(fid);
        }
      }
      result = result.filter((c) =>
        (c.folders ?? []).some((f) => modeFolderIds.has(f))
      );
    } else {
      const keyword = CONTENT_MODE_KEYWORD[filters.contentMode];
      result = result.filter((c) => c.name?.includes(keyword));
    }
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

  // Tag filter: AND (selected) + OR (excluded) — single pass with one getAllClipTags call per clip
  if (filters.selectedTags.length > 0 || filters.excludedTags.length > 0) {
    result = result.filter((c) => {
      const allTags = getAllClipTags(c);
      if (filters.selectedTags.length > 0 && !filters.selectedTags.every((t) => allTags.includes(t))) return false;
      if (filters.excludedTags.length > 0 && filters.excludedTags.some((t) => allTags.includes(t))) return false;
      return true;
    });
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

function sortClips<T extends Pick<FilterableClipRecord, "name">>(
  clips: T[],
  sortBy: SortBy
): T[] {
  const sorted = [...clips];
  switch (sortBy) {
    case "newest":
      return sorted;
    case "name":
      return sorted.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "ko"));
  }
}
