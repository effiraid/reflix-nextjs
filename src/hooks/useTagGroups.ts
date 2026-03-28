import { useMemo, useCallback } from "react";
import { useClipData } from "@/app/[lang]/browse/ClipDataProvider";
import { useUIStore } from "@/stores/uiStore";
import { AI_PARENT_GROUP_ID, buildAiTagGroups, getAllClipTags } from "@/lib/aiTags";
import { createMatcher } from "@/lib/search";
import { getTagDisplayLabel } from "@/lib/tagDisplay";
import type { TagGroupData, TagGroup, ParentTagGroup, Locale } from "@/lib/types";

export interface UseTagGroupsResult {
  mergedGroups: TagGroup[];
  mergedParentGroups: ParentTagGroup[];
  tagCounts: Record<string, number>;
  groupTagCounts: Record<string, number>;
  totalTagCount: number;
  ungroupedTags: string[];
  filteredGroups: TagGroup[];
  matchTag: ((tag: string) => boolean) | null;
  allTags: string[];
}

export function useTagGroups(
  tagGroups: TagGroupData,
  lang: Locale,
  tagI18n: Record<string, string>
): UseTagGroupsResult {
  const clips = useClipData();
  const tagSearchQuery = useUIStore((s) => s.tagSearchQuery);

  const aiTagData = useMemo(() => buildAiTagGroups(clips), [clips]);

  const mergedGroups = useMemo(
    () => [...tagGroups.groups, ...aiTagData.groups],
    [tagGroups.groups, aiTagData.groups]
  );

  const mergedParentGroups = useMemo(
    () =>
      aiTagData.hasAiField
        ? [...tagGroups.parentGroups, aiTagData.parentGroup]
        : tagGroups.parentGroups,
    [tagGroups.parentGroups, aiTagData.hasAiField, aiTagData.parentGroup]
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const group of mergedGroups) {
      for (const tag of group.tags) set.add(tag);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
  }, [mergedGroups]);

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const clip of clips) {
      for (const tag of getAllClipTags(clip)) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    return counts;
  }, [clips]);

  const getDisplayTag = useCallback(
    (tag: string) => getTagDisplayLabel(tag, lang, tagI18n),
    [lang, tagI18n]
  );

  const matchTag = useMemo(() => {
    if (!tagSearchQuery) return null;
    const match = createMatcher(lang, tagSearchQuery);
    return (t: string) => match(getDisplayTag(t));
  }, [tagSearchQuery, lang, getDisplayTag]);

  const filteredGroups = useMemo(() => {
    if (!matchTag) return mergedGroups;
    return mergedGroups
      .map((g) => ({ ...g, tags: g.tags.filter(matchTag) }))
      .filter((g) => g.tags.length > 0);
  }, [mergedGroups, matchTag]);

  const { groupTagCounts, totalTagCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    const groups = matchTag ? filteredGroups : mergedGroups;
    for (const group of groups) {
      counts[group.id] = group.tags.length;
    }
    const total = matchTag
      ? allTags.filter(matchTag).length
      : allTags.length;
    return { groupTagCounts: counts, totalTagCount: total };
  }, [mergedGroups, filteredGroups, allTags, matchTag]);

  const ungroupedTags = useMemo(() => {
    const groupedSet = new Set<string>();
    for (const group of mergedGroups) {
      for (const tag of group.tags) groupedSet.add(tag);
    }
    const allClipTags = new Set<string>();
    for (const clip of clips) {
      for (const tag of getAllClipTags(clip)) {
        allClipTags.add(tag);
      }
    }
    return Array.from(allClipTags)
      .filter((t) => !groupedSet.has(t))
      .sort((a, b) => a.localeCompare(b, "ko"));
  }, [mergedGroups, clips]);

  return {
    mergedGroups,
    mergedParentGroups,
    tagCounts,
    groupTagCounts,
    totalTagCount,
    ungroupedTags,
    filteredGroups,
    matchTag,
    allTags,
  };
}
