import type { CategoryNode, CategoryTree, Locale } from "./types";

/** Collect a folder ID and all its descendant IDs from the category tree. */
export function collectDescendantIds(
  id: string,
  tree: CategoryTree
): string[] {
  const node = findNode(id, tree);
  if (!node) return [id];
  const ids: string[] = [id];
  walkChildren(node, ids);
  return ids;
}

export function getCategoryLabel(
  id: string,
  tree: CategoryTree,
  lang: Locale
): string {
  const node = findNode(id, tree);
  return node?.i18n[lang] ?? id;
}

export function collectExpandableFolderIds(tree: CategoryTree): string[] {
  const ids: string[] = [];

  for (const [id, node] of Object.entries(tree)) {
    if (!node.children || Object.keys(node.children).length === 0) {
      continue;
    }

    ids.push(id, ...collectExpandableFolderIds(node.children));
  }

  return ids;
}

export function findNode(
  id: string,
  tree: Record<string, CategoryNode>
): CategoryNode | null {
  for (const [nodeId, node] of Object.entries(tree)) {
    if (nodeId === id) return node;
    if (node.children) {
      const found = findNode(id, node.children);
      if (found) return found;
    }
  }
  return null;
}

function walkChildren(node: CategoryNode, ids: string[]) {
  if (!node.children) return;
  for (const [childId, child] of Object.entries(node.children)) {
    ids.push(childId);
    walkChildren(child, ids);
  }
}
