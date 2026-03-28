"use client";

import { useMemo, useCallback } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useFilterStore } from "@/stores/filterStore";
import { useFilterSync } from "@/hooks/useFilterSync";
import { getTagDisplayLabel } from "@/lib/tagDisplay";
import type { UseTagGroupsResult } from "@/hooks/useTagGroups";
import type { Locale } from "@/lib/types";
import type { Dictionary } from "@/app/[lang]/dictionaries";

interface TagDetailViewProps {
  tagData: UseTagGroupsResult;
  lang: Locale;
  tagI18n: Record<string, string>;
  dict: Pick<Dictionary, "browse">;
}

export function TagDetailView({
  tagData,
  lang,
  tagI18n,
  dict,
}: TagDetailViewProps) {
  const {
    mergedGroups,
    mergedParentGroups,
    filteredGroups,
    tagCounts,
    ungroupedTags,
    matchTag,
  } = tagData;

  const selectedTagGroupId = useUIStore((s) => s.selectedTagGroupId);
  const setBrowseMode = useUIStore((s) => s.setBrowseMode);
  const tagSearchQuery = useUIStore((s) => s.tagSearchQuery);
  const { updateURL } = useFilterSync();

  const getDisplayTag = useCallback(
    (tag: string) => getTagDisplayLabel(tag, lang, tagI18n),
    [lang, tagI18n]
  );

  const handleTagClick = useCallback(
    (tag: string) => {
      const state = useFilterStore.getState();
      const alreadySelected = state.selectedTags.includes(tag);
      if (!alreadySelected) {
        updateURL({ selectedTags: [...state.selectedTags, tag] });
      }
      setBrowseMode("grid");
    },
    [updateURL, setBrowseMode]
  );

  // Determine which group is selected
  const selectedGroup = useMemo(
    () =>
      selectedTagGroupId && selectedTagGroupId !== "__ungrouped__"
        ? mergedGroups.find((g) => g.id === selectedTagGroupId) ?? null
        : null,
    [selectedTagGroupId, mergedGroups]
  );

  // Find parent of selected group
  const selectedParent = useMemo(
    () =>
      selectedGroup
        ? mergedParentGroups.find((p) => p.id === selectedGroup.parent) ?? null
        : null,
    [selectedGroup, mergedParentGroups]
  );

  // Tags to display in single group mode
  const singleGroupTags = useMemo(() => {
    if (selectedTagGroupId === "__ungrouped__") {
      return matchTag ? ungroupedTags.filter(matchTag) : ungroupedTags;
    }
    if (!selectedGroup) return [];
    const filtered = filteredGroups.find((g) => g.id === selectedGroup.id);
    return filtered?.tags ?? selectedGroup.tags;
  }, [selectedTagGroupId, selectedGroup, filteredGroups, ungroupedTags, matchTag]);

  // "전부" mode
  if (selectedTagGroupId === null) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Breadcrumb bar */}
        <div className="flex h-10 items-center border-b border-border px-4 text-xs text-muted">
          {dict.browse.allTagsTitle}
        </div>

        {/* Header */}
        <div className="border-b border-border px-8 pb-4 pt-5">
          <h2 className="text-base font-semibold">
            {dict.browse.allTagsTitle}{" "}
            <span className="font-normal text-muted">
              ({tagData.totalTagCount})
            </span>
          </h2>
        </div>

        {/* Content: sections per group */}
        <div className="flex-1 overflow-y-auto px-8 py-5">
          {tagSearchQuery && filteredGroups.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted">
              &apos;{tagSearchQuery}&apos;{dict.browse.noSearchResults}
            </div>
          ) : (
            mergedParentGroups.map((parent) => {
              const childGroups = filteredGroups.filter(
                (g) => g.parent === parent.id
              );
              if (childGroups.length === 0) return null;

              return childGroups.map((group) => (
                <div key={group.id} className="mb-5">
                  <div className="mb-1 flex items-center gap-1.5 border-b border-border pb-2 text-[13px] font-medium text-muted">
                    <span
                      className="h-2 w-2 rounded-[2px]"
                      style={{
                        background: group.color || "#64748b",
                      }}
                    />
                    {group.name[lang]}
                    {lang === "ko" && group.name.en ? (
                      <span className="text-muted/60"> · {group.name.en}</span>
                    ) : null}
                  </div>
                  <TagGrid
                    tags={group.tags}
                    tagCounts={tagCounts}
                    getDisplayTag={getDisplayTag}
                    onTagClick={handleTagClick}
                  />
                </div>
              ));
            })
          )}
        </div>
      </div>
    );
  }

  // Single group or ungrouped mode
  const isUngrouped = selectedTagGroupId === "__ungrouped__";
  const groupName = isUngrouped
    ? dict.browse.uncategorized
    : selectedGroup?.name[lang] ?? "";
  const groupNameEn = isUngrouped ? "" : selectedGroup?.name.en ?? "";
  const groupColor = isUngrouped ? undefined : selectedGroup?.color;
  const parentName = selectedParent?.name[lang] ?? "";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Breadcrumb bar */}
      <div className="flex h-10 items-center gap-1 border-b border-border px-4 text-xs text-muted">
        <button
          type="button"
          onClick={() => useUIStore.getState().setSelectedTagGroupId(null)}
          className="opacity-50 hover:opacity-100 transition-opacity"
        >
          {dict.browse.allTagsTitle}
        </button>
        <span className="text-muted/50">›</span>
        <span>{groupName}</span>
      </div>

      {/* Header */}
      <div className="border-b border-border px-8 pb-4 pt-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {groupColor && (
            <span
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{ background: groupColor }}
            />
          )}
          {groupName}
          {lang === "ko" && groupNameEn ? (
            <span className="text-sm font-normal text-muted">{groupNameEn}</span>
          ) : null}
          <span className="font-normal text-muted">
            ({singleGroupTags.length})
          </span>
        </h2>
        {parentName && (
          <p className="mt-1 text-[13px] text-muted">
            {parentName} {dict.browse.groups}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-5">
        {singleGroupTags.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted">
            {tagSearchQuery
              ? `'${tagSearchQuery}'${dict.browse.noSearchResults}`
              : dict.browse.noTagsInGroup}
          </div>
        ) : (
          <TagGrid
            tags={singleGroupTags}
            tagCounts={tagCounts}
            getDisplayTag={getDisplayTag}
            onTagClick={handleTagClick}
          />
        )}
      </div>
    </div>
  );
}

function TagGrid({
  tags,
  tagCounts,
  getDisplayTag,
  onTagClick,
}: {
  tags: string[];
  tagCounts: Record<string, number>;
  getDisplayTag: (tag: string) => string;
  onTagClick: (tag: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onTagClick(tag)}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors hover:bg-surface-hover"
        >
          <span className="text-[8px] text-muted">●</span>
          <span className="flex-1 text-left">{getDisplayTag(tag)}</span>
          <span className="text-xs text-muted tabular-nums">
            {(tagCounts[tag] || 0).toLocaleString()}
          </span>
        </button>
      ))}
    </div>
  );
}
