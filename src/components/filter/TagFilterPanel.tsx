"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useFilterStore } from "@/stores/filterStore";
import { useUIStore } from "@/stores/uiStore";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { TagGroupData, ClipIndex, Locale } from "@/lib/types";

interface TagFilterPanelProps {
  tagGroups: TagGroupData;
  clips: ClipIndex[];
  lang: Locale;
  tagI18n: Record<string, string>;
  dict: Pick<Dictionary, "browse" | "clip" | "common">;
  updateURL: (updates: { selectedTags: string[] }) => void;
}

export function TagFilterPanel({
  tagGroups,
  clips,
  lang,
  tagI18n,
  dict,
  updateURL,
}: TagFilterPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const { selectedTags } = useFilterStore();
  const { setActiveFilterTab } = useUIStore();
  const getDisplayTag = useCallback(
    (tag: string) => (lang === "en" ? tagI18n[tag] ?? tag : tag),
    [lang, tagI18n]
  );

  // 태그별 클립 사용 횟수 계산
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const clip of clips) {
      if (clip.tags) {
        for (const tag of clip.tags) {
          counts[tag] = (counts[tag] || 0) + 1;
        }
      }
    }
    return counts;
  }, [clips]);

  // 전체 태그 (모든 그룹의 태그 합집합)
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const group of tagGroups.groups) {
      for (const tag of group.tags) set.add(tag);
    }
    return Array.from(set).sort();
  }, [tagGroups]);

  // 현재 선택된 그룹의 태그 목록
  const currentTags = useMemo(() => {
    const baseTags = selectedGroupId
      ? tagGroups.groups.find((g) => g.id === selectedGroupId)?.tags ?? []
      : allTags;

    if (!searchQuery) return baseTags;
    const q = searchQuery.toLowerCase();
    return baseTags.filter((t) => getDisplayTag(t).toLowerCase().includes(q));
  }, [selectedGroupId, tagGroups, allTags, searchQuery, getDisplayTag]);

  // 그룹별 태그 수 (검색 반영)
  const groupTagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const q = searchQuery.toLowerCase();
    for (const group of tagGroups.groups) {
      counts[group.id] = searchQuery
        ? group.tags.filter((t) => getDisplayTag(t).toLowerCase().includes(q)).length
        : group.tags.length;
    }
    return counts;
  }, [tagGroups, searchQuery, getDisplayTag]);

  // 전체 태그 수 (검색 반영)
  const totalTagCount = useMemo(() => {
    if (!searchQuery) return allTags.length;
    const q = searchQuery.toLowerCase();
    return allTags.filter((t) => getDisplayTag(t).toLowerCase().includes(q)).length;
  }, [allTags, searchQuery, getDisplayTag]);

  // 태그 토글 핸들러
  const handleTagToggle = useCallback(
    (tag: string) => {
      const current = useFilterStore.getState().selectedTags;
      const next = current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag];
      updateURL({ selectedTags: next });
    },
    [updateURL]
  );

  // ESC 키로 패널 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveFilterTab(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveFilterTab]);

  // 태그가 속한 그룹의 색상 (북마크 아이콘용)
  const tagColorMap = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const group of tagGroups.groups) {
      for (const tag of group.tags) {
        map[tag] = group.color;
      }
    }
    return map;
  }, [tagGroups]);

  return (
    <div className="border-b border-border bg-background flex flex-col" style={{ height: "320px" }}>
      {/* 상단: 검색바 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-muted">{dict.clip.tags}</span>
        <input
          type="text"
          placeholder={dict.browse.tagSearchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
          className="flex-1 h-7 px-2 text-sm rounded border border-border bg-surface focus:outline-none focus:border-accent"
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
          {tagGroups.parentGroups.map((parent) => {
            const childGroups = tagGroups.groups.filter(
              (g) => g.parent === parent.id && groupTagCounts[g.id] > 0
            );
            if (childGroups.length === 0) return null;
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
                    <span>{group.name[lang]}</span>
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
        <div className="flex-1 overflow-y-auto">
          {currentTags.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            const color = tagColorMap[tag];
            return (
              <button
                key={tag}
                onClick={() => handleTagToggle(tag)}
                className={`flex items-center gap-3 w-full px-3 py-1.5 text-sm hover:bg-surface-hover ${
                  isSelected ? "bg-accent/10" : ""
                }`}
              >
                {/* 체크박스 */}
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    isSelected
                      ? "bg-accent border-accent text-white"
                      : "border-muted"
                  }`}
                >
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 5L4 7L8 3" />
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
                <span className="flex-1 text-left">{getDisplayTag(tag)}</span>

                {/* 카운트 */}
                <span className="text-xs text-muted">{(tagCounts[tag] || 0).toLocaleString()}</span>
              </button>
            );
          })}

          {currentTags.length === 0 && (
            <div className="flex items-center justify-center h-full text-sm text-muted">
              {dict.browse.noResults}
            </div>
          )}
        </div>
      </div>

      {/* 하단: 도움말 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border text-xs text-muted shrink-0">
        <span>{dict.common.select} <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-[10px]">Click</kbd></span>
        <span>{dict.common.close} <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-[10px]">ESC</kbd></span>
      </div>
    </div>
  );
}
