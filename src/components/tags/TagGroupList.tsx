"use client";

import { useRef, useState } from "react";
import { useUIStore } from "@/stores/uiStore";
import { AI_PARENT_GROUP_ID } from "@/lib/aiTags";
import type { UseTagGroupsResult } from "@/hooks/useTagGroups";
import type { Locale } from "@/lib/types";
import type { Dictionary } from "@/app/[lang]/dictionaries";

interface TagGroupListProps {
  tagData: UseTagGroupsResult;
  lang: Locale;
  dict: Pick<Dictionary, "browse">;
}

export function TagGroupList({ tagData, lang, dict }: TagGroupListProps) {
  const {
    mergedParentGroups,
    filteredGroups,
    groupTagCounts,
    totalTagCount,
    ungroupedTags,
    matchTag,
  } = tagData;

  const {
    selectedTagGroupId,
    setSelectedTagGroupId,
    setBrowseMode,
    tagSearchQuery,
    setTagSearchQuery,
  } = useUIStore();

  const [localSearch, setLocalSearch] = useState(tagSearchQuery);
  const isComposingRef = useRef(false);

  const ungroupedCount = matchTag
    ? ungroupedTags.filter(matchTag).length
    : ungroupedTags.length;

  return (
    <div className="flex h-full flex-col text-sm">
      {/* Header: back + search */}
      <div className="border-b border-border px-3 py-3">
        <button
          type="button"
          onClick={() => {
            setBrowseMode("grid");
            setSelectedTagGroupId(null);
            setTagSearchQuery("");
          }}
          className="flex items-center gap-1.5 text-muted hover:text-foreground transition-colors text-[13px]"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
            <path d="M11 2L5 8l6 6" />
          </svg>
          {dict.browse.backToFolders}
        </button>
        <div className="mt-2">
          <input
            type="text"
            placeholder={dict.browse.tagSearchPlaceholder}
            value={localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value);
              if (!isComposingRef.current) {
                setTagSearchQuery(e.target.value);
              }
            }}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={(e) => {
              isComposingRef.current = false;
              setTagSearchQuery(e.currentTarget.value);
            }}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
      </div>

      {/* Group list */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* "전부" */}
        <button
          type="button"
          onClick={() => setSelectedTagGroupId(null)}
          className={`flex w-full items-center justify-between px-4 py-1.5 text-[13px] hover:bg-surface-hover ${
            selectedTagGroupId === null ? "bg-surface-active font-medium" : ""
          }`}
        >
          <span className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-muted">
              <rect x="2" y="2" width="5" height="5" rx="1" />
              <rect x="9" y="2" width="5" height="5" rx="1" />
              <rect x="2" y="9" width="5" height="5" rx="1" />
              <rect x="9" y="9" width="5" height="5" rx="1" />
            </svg>
            {dict.browse.allTagsTitle}
          </span>
          <span className="text-xs text-muted tabular-nums">{totalTagCount}</span>
        </button>

        {/* "분류되지 않음" */}
        {ungroupedCount > 0 && (
          <button
            type="button"
            onClick={() => setSelectedTagGroupId("__ungrouped__")}
            className={`flex w-full items-center justify-between px-4 py-1.5 text-[13px] hover:bg-surface-hover ${
              selectedTagGroupId === "__ungrouped__" ? "bg-surface-active font-medium" : ""
            }`}
          >
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-muted">
                <rect x="2" y="2" width="12" height="12" rx="2" />
                <path d="M5 8h6M8 5v6" />
              </svg>
              {dict.browse.uncategorized}
            </span>
            <span className="text-xs text-muted tabular-nums">{ungroupedCount}</span>
          </button>
        )}

        <div className="mx-4 my-1.5 border-t border-border" />

        {/* Parent groups → child groups */}
        {mergedParentGroups.map((parent) => {
          const childGroups = filteredGroups.filter((g) => g.parent === parent.id);
          if (childGroups.length === 0) return null;

          return (
            <div key={parent.id}>
              <div className="px-4 pb-0.5 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
                {parent.name[lang]}
              </div>
              {childGroups.map((group) => {
                const isSelected = selectedTagGroupId === group.id;
                const color = group.color;
                const isAi = group.parent === AI_PARENT_GROUP_ID;

                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setSelectedTagGroupId(group.id)}
                    className={`flex w-full items-center justify-between py-1.5 pl-6 pr-4 text-[13px] transition-colors hover:bg-surface-hover ${
                      isSelected ? "font-medium" : ""
                    }`}
                    style={
                      isSelected
                        ? {
                            borderLeft: `3px solid ${color || "var(--color-accent)"}`,
                            backgroundColor: color
                              ? `color-mix(in srgb, ${color} 12%, transparent)`
                              : undefined,
                            paddingLeft: "21px",
                          }
                        : { borderLeft: "3px solid transparent", paddingLeft: "21px" }
                    }
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-[2px]"
                        style={{ background: color || (isAi ? "#64748b" : "var(--color-muted)") }}
                      />
                      {group.name[lang]}
                    </span>
                    <span className="text-xs text-muted tabular-nums">
                      {groupTagCounts[group.id] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
