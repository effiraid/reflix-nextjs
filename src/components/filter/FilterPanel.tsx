"use client";

import { useUIStore } from "@/stores/uiStore";
import { useFilterSync } from "@/hooks/useFilterSync";
import { TagFilterPanel } from "./TagFilterPanel";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { TagGroupData, Locale } from "@/lib/types";

interface FilterPanelProps {
  tagGroups: TagGroupData;
  lang: Locale;
  tagI18n: Record<string, string>;
  dict: Pick<Dictionary, "browse" | "clip" | "common">;
}

export function FilterPanel({
  tagGroups,
  lang,
  tagI18n,
  dict,
}: FilterPanelProps) {
  const { activeFilterTab, filterBarOpen } = useUIStore();
  const { updateURL } = useFilterSync();

  if (!filterBarOpen || !activeFilterTab) return null;

  if (activeFilterTab === "tags") {
    return (
      <TagFilterPanel
        tagGroups={tagGroups}
        lang={lang}
        tagI18n={tagI18n}
        dict={dict}
        updateURL={updateURL}
      />
    );
  }

  return null;
}
