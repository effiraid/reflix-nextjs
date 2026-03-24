"use client";

import { useMemo } from "react";
import { MasonryGrid } from "@/components/clip/MasonryGrid";
import { filterClips } from "@/lib/filter";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { CategoryTree, ClipIndex } from "@/lib/types";

interface SearchPageClientProps {
  initialClips: ClipIndex[];
  categories: CategoryTree;
  tagI18n?: Record<string, string>;
  query: string;
  dict: Pick<Dictionary, "browse" | "nav">;
}

export function SearchPageClient({
  initialClips,
  categories,
  tagI18n = {},
  query,
  dict,
}: SearchPageClientProps) {
  const trimmedQuery = query.trim();
  const results = useMemo(
    () =>
      filterClips(
        initialClips,
        {
          category: null,
          selectedFolders: [],
          selectedTags: [],
          searchQuery: trimmedQuery,
          sortBy: "newest",
          starFilter: null,
        },
        categories,
        tagI18n
      ),
    [categories, initialClips, tagI18n, trimmedQuery]
  );

  if (!trimmedQuery) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-muted">
        {dict.nav.searchPlaceholder}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-muted">
        {dict.browse.noResults}
      </div>
    );
  }

  return <MasonryGrid clips={results} />;
}
