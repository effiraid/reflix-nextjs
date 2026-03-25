import type { CategoryTree, ClipIndex, Locale, SortBy } from "./types";
import { collectDescendantIds } from "./categories";
import { createMatcher } from "./search";

export interface FilterState {
  selectedFolders: string[];
  selectedTags: string[];
  starFilter: number | null;
  searchQuery: string;
  sortBy: SortBy;
  category: string | null;
}

export function filterClips(
  clips: ClipIndex[],
  filters: FilterState,
  categories?: CategoryTree,
  tagI18n: Record<string, string> = {},
  lang: Locale = "ko"
): ClipIndex[] {
  let result = clips;

  if (filters.category) {
    result = result.filter((c) => c.category === filters.category);
  }

  if (filters.selectedFolders.length > 0) {
    const expandedIds = categories
      ? new Set(filters.selectedFolders.flatMap((id) => collectDescendantIds(id, categories)))
      : new Set(filters.selectedFolders);
    result = result.filter((c) =>
      c.folders.some((f) => expandedIds.has(f))
    );
  }

  // Tag filter: AND logic — clip must have ALL selected tags
  if (filters.selectedTags.length > 0) {
    result = result.filter((c) =>
      filters.selectedTags.every((t) => c.tags.includes(t))
    );
  }

  if (filters.starFilter !== null) {
    result = result.filter((c) => c.star >= filters.starFilter!);
  }

  if (filters.searchQuery) {
    const match = createMatcher(lang, filters.searchQuery);

    result = result.filter(
      (c) =>
        match(c.name) ||
        c.tags.some((t) => {
          const translated = tagI18n[t] ?? "";
          return match(t) || (translated && match(translated));
        })
    );
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

function sortClips(clips: ClipIndex[], sortBy: SortBy): ClipIndex[] {
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
