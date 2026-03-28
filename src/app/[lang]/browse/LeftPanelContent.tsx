"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, FoldVertical, UnfoldVertical } from "lucide-react";
import { FolderTree } from "@/components/filter/FolderTree";
import { useFilterStore } from "@/stores/filterStore";
import { useUIStore } from "@/stores/uiStore";
import { useFilterSync } from "@/hooks/useFilterSync";
import { useTagGroups } from "@/hooks/useTagGroups";
import { TagGroupList } from "@/components/tags/TagGroupList";
import { useBrowseData, useClipData } from "./ClipDataProvider";
import { collectExpandableFolderIds, filterCategoriesByMode, findNode } from "@/lib/categories";
import type { CategoryTree, ContentMode, Locale, TagGroupData } from "@/lib/types";
import type { Dictionary } from "../dictionaries";

const EMPTY_TAG_GROUPS: TagGroupData = { groups: [], parentGroups: [] };

interface LeftPanelContentProps {
  categories: CategoryTree;
  tagGroups?: TagGroupData;
  tagI18n?: Record<string, string>;
  lang: Locale;
  dict: Pick<Dictionary, "browse" | "clip">;
}

export function LeftPanelContent({
  categories,
  tagGroups = EMPTY_TAG_GROUPS,
  tagI18n = {},
  lang,
  dict,
}: LeftPanelContentProps) {
  const clips = useClipData();
  const { totalClipCount } = useBrowseData();
  const { updateURL } = useFilterSync();
  const contentMode = useFilterStore((s) => s.contentMode);
  const selectedFolders = useFilterStore((s) => s.selectedFolders);
  const { setFilterBarOpen, setActiveFilterTab, setViewMode, setBrowseMode } = useUIStore();
  const browseMode = useUIStore((s) => s.browseMode);
  const tagData = useTagGroups(tagGroups, lang, tagI18n);
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [expandedFolderIds, setExpandedFolderIds] = useState(() =>
    getDefaultExpandedFolderIds(categories)
  );
  const [pendingScrollFolderId, setPendingScrollFolderId] = useState<string | null>(null);
  const treeContainerRef = useRef<HTMLDivElement | null>(null);

  const visibleCategories = useMemo(
    () => filterCategoriesByMode(categories, contentMode),
    [categories, contentMode]
  );

  const totalTagCount = useMemo(
    () => new Set(clips.flatMap((c) => c.tags || [])).size,
    [clips]
  );

  const expandableFolderIds = useMemo(
    () => collectExpandableFolderIds(visibleCategories),
    [visibleCategories]
  );

  const allFoldersExpanded =
    expandableFolderIds.length > 0 &&
    expandableFolderIds.every((id) => expandedFolderIds.includes(id));
  const folderTreeActionLabel = allFoldersExpanded
    ? dict.browse.collapseAllFolders
    : dict.browse.expandAllFolders;

  // Pre-compute folder → clip IDs for unique counting across parent folders
  const folderClipIds = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const clip of clips) {
      if (clip.folders) {
        for (const folderId of clip.folders) {
          if (!map[folderId]) map[folderId] = [];
          map[folderId].push(clip.id);
        }
      }
    }
    return map;
  }, [clips]);

  function setAllFoldersExpanded(expanded: boolean) {
    setFoldersExpanded(true);
    setExpandedFolderIds(expanded ? expandableFolderIds : []);
  }

  useEffect(() => {
    const targetFolderId = selectedFolders.at(-1);

    if (!targetFolderId) {
      setPendingScrollFolderId(null);
      return;
    }

    setFoldersExpanded(true);

    const ancestorIds = collectAncestorFolderIds(targetFolderId, visibleCategories);
    if (ancestorIds.length > 0) {
      setExpandedFolderIds((current) => {
        const next = Array.from(new Set([...current, ...ancestorIds]));
        return next.length === current.length &&
          next.every((id, index) => id === current[index])
          ? current
          : next;
      });
    }

    setPendingScrollFolderId(targetFolderId);
  }, [selectedFolders, visibleCategories]);

  useEffect(() => {
    if (!pendingScrollFolderId || !foldersExpanded) {
      return;
    }

    const targetElement = Array.from(
      treeContainerRef.current?.querySelectorAll<HTMLElement>("[data-folder-id]") ?? []
    ).find((element) => element.dataset.folderId === pendingScrollFolderId);

    if (!targetElement) {
      return;
    }

    targetElement.scrollIntoView({ block: "center" });
    setPendingScrollFolderId((current) =>
      current === pendingScrollFolderId ? null : current
    );
  }, [expandedFolderIds, foldersExpanded, pendingScrollFolderId]);

  if (browseMode === "tags") {
    return <TagGroupList tagData={tagData} lang={lang} dict={dict} />;
  }

  return (
    <div className="p-3 space-y-4 text-sm">
      {/* Quick filters */}
      <div className="space-y-0.5">
        <button
          onClick={() => {
            updateURL({
              category: null,
              selectedTags: [],
              excludedTags: [],
              selectedFolders: [],
              excludedFolders: [],
              sortBy: "newest",
            });
            setViewMode("feed");
          }}
          className="flex items-center justify-between w-full text-left px-2 py-1.5 rounded hover:bg-surface-hover"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
            {dict.browse.all}
          </span>
          <span className="text-muted text-xs">{totalClipCount.toLocaleString()}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setBrowseMode("tags");
          }}
          className="flex items-center justify-between w-full text-left px-2 py-1.5 rounded hover:bg-surface-hover text-muted"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
            {dict.browse.allTags}
          </span>
          <span className="text-muted text-xs">{totalTagCount.toLocaleString()}</span>
        </button>

        <div className="border-t border-border my-1.5" />

        <button
          type="button"
          onClick={() => updateURL({ sortBy: "newest" })}
          className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-surface-hover text-muted"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {dict.browse.recentlyUsed}
        </button>
      </div>

      {/* Content mode toggle */}
      <ContentModeToggle
        contentMode={contentMode}
        onChange={(mode) => {
          updateURL({ contentMode: mode, selectedFolders: [], excludedFolders: [] });
        }}
        dict={dict.browse}
      />

      {/* Folder tree */}
      <div className="rounded-xl border border-border bg-surface/40 p-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-expanded={foldersExpanded}
            onClick={() => setFoldersExpanded((open) => !open)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold tracking-[0.14em] text-muted uppercase transition-colors hover:bg-background/80 hover:text-foreground"
          >
            <ChevronRight
              aria-hidden="true"
              size={14}
              strokeWidth={1.75}
              className={`shrink-0 text-muted transition-transform duration-150 ${foldersExpanded ? "rotate-90" : ""}`}
            />
            <span>{dict.clip.folders}</span>
          </button>
          <button
            type="button"
            aria-label={folderTreeActionLabel}
            title={folderTreeActionLabel}
            onClick={() => setAllFoldersExpanded(!allFoldersExpanded)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background/80 hover:text-foreground disabled:cursor-default disabled:opacity-50"
            disabled={expandableFolderIds.length === 0}
          >
            {allFoldersExpanded ? (
              <FoldVertical aria-hidden="true" size={15} strokeWidth={1.75} />
            ) : (
              <UnfoldVertical aria-hidden="true" size={15} strokeWidth={1.75} />
            )}
          </button>
        </div>
        {foldersExpanded ? (
          <div ref={treeContainerRef} className="pt-1">
            <FolderTree
              categories={visibleCategories}
              folderClipIds={folderClipIds}
              lang={lang}
              expandedFolderIds={expandedFolderIds}
              onFolderClick={({ folderId, metaKey, ctrlKey, altKey }) => {
                const usesMultiSelect = metaKey || ctrlKey;

                if (usesMultiSelect && altKey) {
                  setAllFoldersExpanded(!allFoldersExpanded);
                  return;
                }

                // 하위 폴더가 있으면 클릭 시 자동으로 펼치기
                const node = findNode(folderId, visibleCategories);
                const hasChildren = node?.children && Object.keys(node.children).length > 0;
                if (hasChildren) {
                  setExpandedFolderIds((current) =>
                    current.includes(folderId) ? current : [...current, folderId]
                  );
                }

                const current = useFilterStore.getState().selectedFolders;
                const next = usesMultiSelect
                  ? current.includes(folderId)
                    ? current.filter((f) => f !== folderId)
                    : [...current, folderId]
                  : current.length === 1 && current[0] === folderId
                    ? []
                    : [folderId];

                if (next.length > 0) {
                  setViewMode("masonry");
                }
                updateURL({ selectedFolders: next });
              }}
              onFolderExpandToggle={(folderId) => {
                setExpandedFolderIds((current) =>
                  current.includes(folderId)
                    ? current.filter((id) => id !== folderId)
                    : [...current, folderId]
                );
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getDefaultExpandedFolderIds(categories: CategoryTree): string[] {
  return Object.entries(categories)
    .filter(([, node]) => node.children && Object.keys(node.children).length > 0)
    .map(([id]) => id);
}

function collectAncestorFolderIds(
  targetId: string,
  tree: CategoryTree
): string[] {
  const path = findFolderPath(targetId, tree);
  return path ? path.slice(0, -1) : [];
}

function findFolderPath(
  targetId: string,
  tree: CategoryTree
): string[] | null {
  for (const [id, node] of Object.entries(tree)) {
    if (id === targetId) {
      return [id];
    }

    if (!node.children) {
      continue;
    }

    const childPath = findFolderPath(targetId, node.children);
    if (childPath) {
      return [id, ...childPath];
    }
  }

  return null;
}

const CONTENT_MODES: { value: ContentMode | null; dictKey: "modeAll" | "modeDirection" | "modeGame" }[] = [
  { value: null, dictKey: "modeAll" },
  { value: "direction", dictKey: "modeDirection" },
  { value: "game", dictKey: "modeGame" },
];

function ContentModeToggle({
  contentMode,
  onChange,
  dict,
}: {
  contentMode: ContentMode | null;
  onChange: (mode: ContentMode | null) => void;
  dict: { modeAll: string; modeDirection: string; modeGame: string };
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-surface/60 p-1 border border-border">
      {CONTENT_MODES.map(({ value, dictKey }) => {
        const active = contentMode === value;
        return (
          <button
            key={dictKey}
            type="button"
            onClick={() => onChange(value)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            {dict[dictKey]}
          </button>
        );
      })}
    </div>
  );
}
