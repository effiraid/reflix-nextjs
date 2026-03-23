"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { FolderTree } from "@/components/filter/FolderTree";
import { useFilterStore } from "@/stores/filterStore";
import { useUIStore } from "@/stores/uiStore";
import { useFilterSync } from "@/hooks/useFilterSync";
import { collectExpandableFolderIds, countCategoryNodes } from "@/lib/categories";
import type { CategoryTree, ClipIndex, Locale } from "@/lib/types";

interface LeftPanelContentProps {
  categories: CategoryTree;
  clips: ClipIndex[];
  lang: Locale;
  dict: {
    browse: {
      all: string;
      recentlyUsed: string;
      random: string;
      allTags: string;
      community: string;
      items: string;
    };
    clip: {
      folders: string;
    };
  };
}

export function LeftPanelContent({
  categories,
  clips,
  lang,
  dict,
}: LeftPanelContentProps) {
  const { updateURL } = useFilterSync();
  const { reshuffleClips, setFilterBarOpen, setActiveFilterTab } = useUIStore();
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [expandedFolderIds, setExpandedFolderIds] = useState(() =>
    getDefaultExpandedFolderIds(categories)
  );

  const totalFolderCount = countCategoryNodes(categories);
  const totalTagCount = new Set(clips.flatMap((c) => c.tags || [])).size;
  const expandableFolderIds = collectExpandableFolderIds(categories);

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
          <span className="text-muted text-xs">{clips.length.toLocaleString()}</span>
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

      {/* Folder tree */}
      <div className="rounded-xl border border-border bg-surface/40 p-1.5">
        <button
          type="button"
          aria-expanded={foldersExpanded}
          onClick={() => setFoldersExpanded((open) => !open)}
          className="flex items-center justify-between w-full rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold tracking-[0.14em] text-muted uppercase transition-colors hover:bg-background/80 hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <ChevronRight
              aria-hidden="true"
              size={14}
              strokeWidth={1.75}
              className={`shrink-0 text-muted transition-transform duration-150 ${foldersExpanded ? "rotate-90" : ""}`}
            />
            <span>{dict.clip.folders}</span>
          </span>
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-muted">
            {formatItemCount(totalFolderCount, dict.browse.items, lang)}
          </span>
        </button>
        {foldersExpanded && (
          <div className="pt-1">
            <FolderTree
              categories={categories}
              clips={clips}
              lang={lang}
              expandedFolderIds={expandedFolderIds}
              onFolderClick={({ folderId, metaKey, ctrlKey, altKey }) => {
                const usesMultiSelect = metaKey || ctrlKey;

                if (usesMultiSelect && altKey) {
                  setExpandedFolderIds((current) =>
                    expandableFolderIds.every((id) => current.includes(id))
                      ? []
                      : expandableFolderIds
                  );
                  return;
                }

                const current = useFilterStore.getState().selectedFolders;
                const next = usesMultiSelect
                  ? current.includes(folderId)
                    ? current.filter((f) => f !== folderId)
                    : [...current, folderId]
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

function formatItemCount(count: number, suffix: string, lang: Locale) {
  return lang === "en"
    ? `${count.toLocaleString()} ${suffix}`
    : `${count.toLocaleString()}${suffix}`;
}
