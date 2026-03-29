import { createMatcher } from "./search";
import type { Locale, TagGroupData } from "./types";

const MAX_SUGGESTIONS = 8;

export interface TagSuggestionItem {
  tag: string;
  groupName?: string;
  groupColor?: string;
  count: number;
  aliases?: string[];
  isAi?: boolean;
}

interface RankedTagSuggestionItem extends TagSuggestionItem {
  matchTier: number;
}

/** Filter allTags by query using locale-aware matching (choseong, qwerty→hangul, fuzzy) */
export function matchTags(
  allTags: string[],
  query: string,
  lang: Locale
): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const match = createMatcher(lang, trimmed);
  return allTags.filter((tag) => match(tag)).slice(0, MAX_SUGGESTIONS);
}

/**
 * Relevance tier for sorting: exact > prefix > contains.
 * Lower number = higher priority.
 */
function getMatchTier(tag: string, query: string): number {
  const lowerTag = tag.toLowerCase();
  const lowerQuery = query.toLowerCase();
  if (lowerTag === lowerQuery) return 0; // exact
  if (lowerTag.startsWith(lowerQuery)) return 1; // prefix
  return 2; // contains / fuzzy
}

/** Default colors for parent groups when child group has no color */
const PARENT_GROUP_COLORS: Record<string, string> = {
  emotion: "#8b5cf6",
  action: "#3b82f6",
  attribute: "#6b7280",
  game: "#ef4444",
  meta: "#8b5cf6",
};

/**
 * Build a lookup: tag → { groupName, groupColor }.
 * Precompute once per session, not per keystroke.
 */
export function buildTagGroupLookup(
  tagGroups: TagGroupData,
  lang: Locale
): Map<string, { groupName: string; groupColor?: string }> {
  const lookup = new Map<string, { groupName: string; groupColor?: string }>();
  for (const group of tagGroups.groups) {
    const groupName = group.name[lang] || group.name.ko;
    const groupColor = group.color || PARENT_GROUP_COLORS[group.parent ?? ""] || "#6b7280";
    for (const tag of group.tags) {
      // First group wins (tags can appear in multiple groups)
      if (!lookup.has(tag)) {
        lookup.set(tag, { groupName, groupColor });
      }
    }
  }
  return lookup;
}

const MAX_PER_PARENT_GROUP = 2;
const MAX_POPULAR = 8;

/**
 * Diversify popular tags: max 2 per parentGroup, then fill with remaining.
 * Ensures different tag categories are represented.
 */
export function diversifyPopularTags(
  tags: string[],
  tagCounts: Record<string, number>,
  _tagGroupLookup: Map<string, { groupName: string; groupColor?: string }>,
  tagGroups: TagGroupData
): string[] {
  // Build tag → parentGroup lookup
  const tagToParent = new Map<string, string>();
  for (const group of tagGroups.groups) {
    for (const tag of group.tags) {
      if (!tagToParent.has(tag)) {
        tagToParent.set(tag, group.parent ?? "ungrouped");
      }
    }
  }

  // Sort all candidates by count desc
  const sorted = [...tags].sort(
    (a, b) => (tagCounts[b] ?? 0) - (tagCounts[a] ?? 0)
  );

  const result: string[] = [];
  const parentCounts = new Map<string, number>();
  const skipped: string[] = [];

  for (const tag of sorted) {
    if (result.length >= MAX_POPULAR) break;
    const parent = tagToParent.get(tag) ?? "ungrouped";
    const current = parentCounts.get(parent) ?? 0;
    if (current < MAX_PER_PARENT_GROUP) {
      result.push(tag);
      parentCounts.set(parent, current + 1);
    } else {
      skipped.push(tag);
    }
  }

  // Fill remaining slots with skipped tags (by count)
  for (const tag of skipped) {
    if (result.length >= MAX_POPULAR) break;
    result.push(tag);
  }

  return result;
}

/**
 * Build a reverse alias lookup from tag-aliases config.
 * Returns Map<canonical, string[]>.
 */
export function buildClientAliasMap(
  aliasConfig: { aliases: Record<string, string[]> } | null
): Map<string, string[]> {
  if (!aliasConfig?.aliases) return new Map();
  return new Map(Object.entries(aliasConfig.aliases));
}

/**
 * Rich tag matching with group metadata, counts, and alias info.
 * Filters out alias tags so only canonical tags appear in suggestions.
 * Falls back gracefully when optional data is missing.
 */
export function matchTagsWithMeta(
  allTags: string[],
  query: string,
  lang: Locale,
  opts: {
    tagCounts?: Record<string, number>;
    tagGroupLookup?: Map<string, { groupName: string; groupColor?: string }>;
    aliasMap?: Map<string, string[]>;
  } = {}
): TagSuggestionItem[] {
  const { tagCounts = {}, tagGroupLookup, aliasMap } = opts;
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];
  const match = createMatcher(lang, trimmedQuery);

  // Build set of alias tags to exclude from suggestions
  const aliasSet = new Set<string>();
  if (aliasMap) {
    for (const aliases of aliasMap.values()) {
      for (const alias of aliases) aliasSet.add(alias);
    }
  }

  // Filter allTags to exclude aliases before matching
  const filteredTags = aliasSet.size > 0
    ? allTags.filter((t) => !aliasSet.has(t))
    : allTags;

  const items: RankedTagSuggestionItem[] = [];
  for (const tag of filteredTags) {
      const aliases = aliasMap?.get(tag) ?? [];
      if (!match(tag) && !aliases.some((alias) => match(alias))) {
        continue;
      }

      const groupInfo = tagGroupLookup?.get(tag);
      const isAi = tagGroupLookup ? !groupInfo : undefined;
      const matchTier = [tag, ...aliases].reduce((bestTier, candidate) => {
        if (!match(candidate)) {
          return bestTier;
        }
        return Math.min(bestTier, getMatchTier(candidate, trimmedQuery));
      }, Number.POSITIVE_INFINITY);

      items.push({
        tag,
        groupName: groupInfo?.groupName,
        groupColor: groupInfo?.groupColor,
        count: tagCounts[tag] ?? 0,
        aliases: aliases.length > 0 ? aliases : undefined,
        isAi: isAi || undefined,
        matchTier,
      });
    }

  // Sort: exact > prefix > contains, then count desc, then grouped > AI
  items.sort((a, b) => {
    if (a.matchTier !== b.matchTier) return a.matchTier - b.matchTier;
    if (a.count !== b.count) return b.count - a.count;
    // Grouped tags before AI tags
    if (a.isAi !== b.isAi) return a.isAi ? 1 : -1;
    return 0;
  });

  return items.slice(0, MAX_SUGGESTIONS).map(({ matchTier, ...item }) => item);
}
