import type { BrowseSummaryRecord, CategoryNode, CategoryTree } from "./types";

export interface TopCategoryInfo {
  topSlug: string;
  topFolderId: string;
  topI18n: { ko: string; en: string };
}

function walkDescendants(
  node: CategoryNode,
  visitor: (child: CategoryNode) => void
): void {
  if (!node.children) return;
  for (const child of Object.values(node.children)) {
    visitor(child);
    walkDescendants(child, visitor);
  }
}

/**
 * Build a map from every slug (leaf + top-level) to its top-level parent info.
 * categories.json has ~10 top-level × ~5 children = ~50 entries. Cheap.
 */
export function buildLeafToTopMap(
  categories: CategoryTree
): Map<string, TopCategoryInfo> {
  const map = new Map<string, TopCategoryInfo>();
  for (const [folderId, node] of Object.entries(categories)) {
    const topInfo: TopCategoryInfo = {
      topSlug: node.slug,
      topFolderId: folderId,
      topI18n: node.i18n,
    };
    map.set(node.slug, topInfo);
    walkDescendants(node, (child) => map.set(child.slug, topInfo));
  }
  return map;
}

/**
 * Single-pass grouping: iterate all clips once, bucket by top-level slug.
 * O(n) where n = total clip count.
 */
export function groupClipsByTopCategory(
  clips: BrowseSummaryRecord[],
  leafToTopMap: Map<string, TopCategoryInfo>
): Map<string, BrowseSummaryRecord[]> {
  const grouped = new Map<string, BrowseSummaryRecord[]>();
  for (const clip of clips) {
    const topInfo = leafToTopMap.get(clip.category);
    const key = topInfo?.topSlug ?? "uncategorized";
    let bucket = grouped.get(key);
    if (!bucket) {
      bucket = [];
      grouped.set(key, bucket);
    }
    bucket.push(clip);
  }
  return grouped;
}

const MAX_SUBS = 3;

/**
 * Pick the first clip as hero, next 3 as subs.
 * Preserves original array order (newest-first).
 */
export function pickHeroAndSubs(clips: BrowseSummaryRecord[]): {
  hero: BrowseSummaryRecord | null;
  subs: BrowseSummaryRecord[];
} {
  if (clips.length === 0) return { hero: null, subs: [] };

  const hero = clips[0];
  const subs = clips.slice(1, 1 + MAX_SUBS);
  return { hero, subs };
}
