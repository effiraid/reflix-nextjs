"use client";

import { useUIStore } from "@/stores/uiStore";
import { useFilterSync } from "@/hooks/useFilterSync";
import { TagFilterPanel } from "./TagFilterPanel";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { TagGroupData, ClipIndex, Locale } from "@/lib/types";

interface FilterPanelProps {
  tagGroups: TagGroupData;
  clips: ClipIndex[];
  lang: Locale;
  tagI18n: Record<string, string>;
  dict: Pick<Dictionary, "browse" | "clip" | "common">;
}

export function FilterPanel({
  tagGroups,
  clips,
  lang,
  tagI18n,
  dict,
}: FilterPanelProps) {
  const { activeFilterTab, filterBarOpen } = useUIStore();
  const { updateURL } = useFilterSync();

  // filterBarOpen이 false면 어떤 패널도 표시하지 않음
  if (!filterBarOpen || !activeFilterTab) return null;

  if (activeFilterTab === "tags") {
    return (
      <TagFilterPanel
        tagGroups={tagGroups}
        clips={clips}
        lang={lang}
        tagI18n={tagI18n}
        dict={dict}
        updateURL={updateURL}
      />
    );
  }

  // 다른 필터 탭들은 추후 구현
  return null;
}
