"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useFilterStore } from "@/stores/filterStore";
import { useUIStore } from "@/stores/uiStore";
import { useBrowseData, useClipData } from "@/app/[lang]/browse/ClipDataProvider";
import { AI_PARENT_GROUP_ID, buildAiTagGroups, getAllClipTags } from "@/lib/aiTags";
import { createMatcher } from "@/lib/search";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { TagGroupData, Locale } from "@/lib/types";

interface TagFilterPanelProps {
  tagGroups: TagGroupData;
  lang: Locale;
  tagI18n: Record<string, string>;
  dict: Pick<Dictionary, "browse" | "clip" | "common">;
  updateURL: (updates: { selectedTags?: string[]; excludedTags?: string[] }) => void;
}

export function TagFilterPanel({
  tagGroups,
  lang,
  tagI18n,
  dict,
  updateURL,
}: TagFilterPanelProps) {
  const clips = useClipData();
  const { projectionStatus } = useBrowseData();
  const aiTagData = useMemo(() => buildAiTagGroups(clips), [clips]);
  const mergedTagGroups = useMemo(
    () => [...tagGroups.groups, ...aiTagData.groups],
    [aiTagData.groups, tagGroups.groups]
  );
  const mergedParentGroups = useMemo(
    () =>
      aiTagData.hasAiField
        ? [...tagGroups.parentGroups, aiTagData.parentGroup]
        : tagGroups.parentGroups,
    [aiTagData.hasAiField, aiTagData.parentGroup, tagGroups.parentGroups]
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [localTagSearch, setLocalTagSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const { selectedTags, excludedTags } = useFilterStore();
  const { setActiveFilterTab } = useUIStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const getDisplayTag = useCallback(
    (tag: string) => (lang === "en" ? tagI18n[tag] ?? tag : tag),
    [lang, tagI18n]
  );

  // 태그별 클립 사용 횟수 계산
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const clip of clips) {
      for (const tag of getAllClipTags(clip)) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    return counts;
  }, [clips]);

  // 전체 태그 (모든 그룹의 태그 합집합)
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const group of mergedTagGroups) {
      for (const tag of group.tags) set.add(tag);
    }
    return Array.from(set).sort();
  }, [mergedTagGroups]);

  // Matcher for tag search (shared across memos)
  const matchTag = useMemo(() => {
    if (!searchQuery) return null;
    const match = createMatcher(lang, searchQuery);
    return (t: string) => match(getDisplayTag(t));
  }, [searchQuery, lang, getDisplayTag]);

  // 현재 선택된 그룹의 태그 목록
  const currentTags = useMemo(() => {
    const baseTags = selectedGroupId
      ? mergedTagGroups.find((g) => g.id === selectedGroupId)?.tags ?? []
      : allTags;

    return matchTag ? baseTags.filter(matchTag) : baseTags;
  }, [selectedGroupId, mergedTagGroups, allTags, matchTag]);

  // 그룹별 태그 수 + 전체 태그 수 (검색 반영, 한 번에 계산)
  const { groupTagCounts, totalTagCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const group of mergedTagGroups) {
      counts[group.id] = matchTag
        ? group.tags.filter(matchTag).length
        : group.tags.length;
    }
    const total = matchTag ? allTags.filter(matchTag).length : allTags.length;
    return { groupTagCounts: counts, totalTagCount: total };
  }, [mergedTagGroups, allTags, matchTag]);

  // 태그 좌클릭 핸들러 (3-상태: unselected→included, included→unselected, excluded→included)
  const handleTagToggle = useCallback(
    (tag: string) => {
      const state = useFilterStore.getState();
      const isExcluded = state.excludedTags.includes(tag);
      if (isExcluded) {
        // excluded → included
        updateURL({
          selectedTags: [...state.selectedTags, tag],
          excludedTags: state.excludedTags.filter((t) => t !== tag),
        });
        return;
      }
      const isIncluded = state.selectedTags.includes(tag);
      if (isIncluded) {
        // included → unselected
        updateURL({ selectedTags: state.selectedTags.filter((t) => t !== tag) });
      } else {
        // unselected → included
        updateURL({ selectedTags: [...state.selectedTags, tag] });
      }
    },
    [updateURL]
  );

  // 태그 우클릭 핸들러 (3-상태: unselected→excluded, included→excluded, excluded→unselected)
  const handleTagContextMenu = useCallback(
    (e: React.MouseEvent, tag: string) => {
      e.preventDefault();
      const state = useFilterStore.getState();
      const isExcluded = state.excludedTags.includes(tag);
      if (isExcluded) {
        // excluded → unselected
        updateURL({ excludedTags: state.excludedTags.filter((t) => t !== tag) });
        return;
      }
      const isIncluded = state.selectedTags.includes(tag);
      if (isIncluded) {
        // included → excluded
        updateURL({
          selectedTags: state.selectedTags.filter((t) => t !== tag),
          excludedTags: [...state.excludedTags, tag],
        });
      } else {
        // unselected → excluded
        updateURL({ excludedTags: [...state.excludedTags, tag] });
      }
    },
    [updateURL]
  );

  // ESC 키로 패널 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveFilterTab(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveFilterTab]);

  // 바깥 클릭으로 패널 닫기 (필터 탭 바 클릭은 제외 — 탭 자체 토글에 맡김)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        !target.closest("[data-filter-tabs]")
      ) {
        setActiveFilterTab(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setActiveFilterTab]);

  // 태그가 속한 그룹의 색상 (북마크 아이콘용)
  const tagColorMap = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const group of mergedTagGroups) {
      for (const tag of group.tags) {
        map[tag] = group.color;
      }
    }
    return map;
  }, [mergedTagGroups]);

  if (projectionStatus !== "ready") {
    return (
      <div
        ref={panelRef}
        className="absolute top-full left-0 right-0 h-80 border border-border rounded-b-lg bg-background shadow-lg flex items-center justify-center"
      >
        <div className="text-sm text-muted">{dict.common.loading}</div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="absolute top-full left-0 right-0 h-80 border border-border rounded-b-lg bg-background shadow-lg flex flex-col"
    >
      {/* 상단: 검색바 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-muted">{dict.clip.tags}</span>
        <input
          type="text"
          placeholder={dict.browse.tagSearchPlaceholder}
          value={localTagSearch}
          onChange={(e) => {
            setLocalTagSearch(e.target.value);
            if (!isComposingRef.current) {
              setSearchQuery(e.target.value);
            }
          }}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={(e) => {
            isComposingRef.current = false;
            setSearchQuery(e.currentTarget.value);
          }}
          autoFocus
          className="flex-1 h-7 px-2 text-sm rounded border border-border bg-surface outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>

      {/* 본문: 2컬럼 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 좌측: 그룹 목록 */}
        <div className="w-52 shrink-0 border-r border-border overflow-y-auto">
          {/* 모든 태그 */}
          <button
            onClick={() => setSelectedGroupId(null)}
            className={`flex items-center justify-between w-full px-3 py-1.5 text-sm hover:bg-surface-hover ${
              selectedGroupId === null ? "bg-accent text-white" : ""
            }`}
          >
            <span>{dict.browse.allTags}</span>
            <span className={`text-xs ${selectedGroupId === null ? "text-white/70" : "text-muted"}`}>
              {totalTagCount.toLocaleString()}
            </span>
          </button>

          {/* parentGroup별 섹션 헤더 + child groups */}
          {mergedParentGroups.map((parent) => {
            const childGroups = mergedTagGroups.filter(
              (g) => g.parent === parent.id && groupTagCounts[g.id] > 0
            );
            if (childGroups.length === 0) {
              if (parent.id === AI_PARENT_GROUP_ID && aiTagData.hasAiField) {
                return (
                  <div key={parent.id}>
                    <div className="mt-2 px-3 py-1 text-[10px] uppercase tracking-wider text-muted">
                      {parent.name[lang]}
                    </div>
                  </div>
                );
              }
              return null;
            }
            return (
              <div key={parent.id}>
                {/* 섹션 헤더 */}
                <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted mt-2">
                  {parent.name[lang]}
                </div>
                {/* child groups */}
                {childGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`flex items-center justify-between w-full px-3 py-1.5 text-sm hover:bg-surface-hover ${
                      selectedGroupId === group.id ? "bg-accent text-white" : ""
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {group.parent === AI_PARENT_GROUP_ID ? (
                        <span
                          aria-hidden="true"
                          className="h-1 w-1 rounded-full bg-accent"
                        />
                      ) : null}
                      <span>{group.name[lang]}</span>
                    </span>
                    <span
                      className={`text-xs ${
                        selectedGroupId === group.id ? "text-white/70" : "text-muted"
                      }`}
                    >
                      {groupTagCounts[group.id]}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* 우측: 태그 목록 */}
        <div className="grid flex-1 grid-cols-1 content-start overflow-y-auto xl:grid-cols-2 2xl:grid-cols-3">
          {currentTags.map((tag) => {
            const isIncluded = selectedTags.includes(tag);
            const isExcluded = excludedTags.includes(tag);
            const color = tagColorMap[tag];
            return (
              <button
                key={tag}
                onClick={() => handleTagToggle(tag)}
                onContextMenu={(e) => handleTagContextMenu(e, tag)}
                className={`flex items-center gap-3 w-full px-3 py-1.5 text-sm hover:bg-surface-hover ${
                  isIncluded ? "bg-accent/10" : isExcluded ? "bg-red-500/10" : ""
                }`}
              >
                {/* 체크박스 */}
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    isIncluded
                      ? "bg-accent border-accent text-white"
                      : isExcluded
                        ? "bg-red-500 border-red-500 text-white"
                        : "border-muted"
                  }`}
                >
                  {isIncluded && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 5L4 7L8 3" />
                    </svg>
                  )}
                  {isExcluded && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 2L8 8M8 2L2 8" />
                    </svg>
                  )}
                </span>

                {/* 색상 북마크 아이콘 */}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill={color || "currentColor"}
                  className={color ? "" : "text-muted"}
                >
                  <path d="M3 1h8v12l-4-3-4 3V1z" />
                </svg>

                {/* 태그 이름 */}
                <span className={`flex-1 text-left ${isExcluded ? "line-through text-red-600 dark:text-red-400" : ""}`}>{getDisplayTag(tag)}</span>

                {/* 카운트 */}
                <span className="text-xs text-muted">{(tagCounts[tag] || 0).toLocaleString()}</span>
              </button>
            );
          })}

          {currentTags.length === 0 && (
            <div className="col-span-full flex min-h-full items-center justify-center text-sm text-muted">
              {dict.browse.noResults}
            </div>
          )}
        </div>
      </div>

      {/* 하단: 도움말 */}
      <div className="flex items-center px-3 py-1.5 border-t border-border text-xs text-muted shrink-0">
        <span>{dict.common.select} <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-[10px]">Click</kbd></span>
        <span className="ml-4">{dict.common.exclude} <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-[10px]">Right Click</kbd></span>
        <span className="ml-auto">{dict.common.close} <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-[10px]">ESC</kbd></span>
      </div>
    </div>
  );
}
