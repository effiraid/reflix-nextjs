"use client";

import { useState, useMemo } from "react";
import { ChevronRight, FoldVertical, UnfoldVertical } from "lucide-react";
import { FolderTree } from "@/components/filter/FolderTree";
import { useFilterStore } from "@/stores/filterStore";
import { useUIStore } from "@/stores/uiStore";
import { useFilterSync } from "@/hooks/useFilterSync";
import { useBrowseData, useClipData } from "./ClipDataProvider";
import { collectExpandableFolderIds, filterCategoriesByMode, findNode } from "@/lib/categories";
import type { CategoryTree, ContentMode, Locale } from "@/lib/types";

interface LeftPanelContentProps {
  categories: CategoryTree;
  lang: Locale;
  dict: {
    browse: {
      all: string;
      recentlyUsed: string;
      random: string;
      allTags: string;
      community: string;
      expandAllFolders: string;
      collapseAllFolders: string;
      modeAll: string;
      modeDirection: string;
      modeGame: string;
    };
    clip: {
      folders: string;
    };
  };
}

export function LeftPanelContent({
  categories,
  lang,
  dict,
}: LeftPanelContentProps) {
  const clips = useClipData();
  const { initialTotalCount } = useBrowseData();
  const { updateURL } = useFilterSync();
  const contentMode = useFilterStore((s) => s.contentMode);
  const { reshuffleClips, setFilterBarOpen, setActiveFilterTab } = useUIStore();
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [expandedFolderIds, setExpandedFolderIds] = useState(() =>
    getDefaultExpandedFolderIds(categories)
  );

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

  // Pre-compute folder counts: folderId → number of clips in that folder
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const clip of clips) {
      if (clip.folders) {
        for (const folderId of clip.folders) {
          counts[folderId] = (counts[folderId] || 0) + 1;
        }
      }
    }
    return counts;
  }, [clips]);

  function setAllFoldersExpanded(expanded: boolean) {
    setFoldersExpanded(true);
    setExpandedFolderIds(expanded ? expandableFolderIds : []);
  }

  return (
    <div className="p-3 space-y-4 text-sm">
      {/* Quick filters */}
      <div className="space-y-0.5">
        <button
          onClick={() => updateURL({ category: null, selectedTags: [], selectedFolders: [], starFilter: null, sortBy: "newest" })}
          className="flex items-center justify-between w-full text-left px-2 py-1.5 rounded hover:bg-surface-hover"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
            {dict.browse.all}
          </span>
          <span className="text-muted text-xs">{initialTotalCount.toLocaleString()}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterBarOpen(true);
            setActiveFilterTab("tags");
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
        <button
          type="button"
          onClick={reshuffleClips}
          className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-surface-hover text-muted"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" /></svg>
          {dict.browse.random}
        </button>
      </div>

      {/* Content mode toggle */}
      <ContentModeToggle
        contentMode={contentMode}
        onChange={(mode) => {
          updateURL({ contentMode: mode, selectedFolders: [] });
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
        {foldersExpanded && (
          <div className="pt-1">
            <FolderTree
              categories={visibleCategories}
              folderCounts={folderCounts}
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
        )}
      </div>
    </div>
  );
}

function getDefaultExpandedFolderIds(categories: CategoryTree): string[] {
  return Object.entries(categories)
    .filter(([, node]) => node.children && Object.keys(node.children).length > 0)
    .map(([id]) => id);
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
