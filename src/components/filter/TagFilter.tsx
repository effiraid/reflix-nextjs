"use client";

import { useRef, useState } from "react";
import type { TagGroupData, Locale } from "@/lib/types";
import { useFilterStore } from "@/stores/filterStore";

interface TagFilterProps {
  tagGroups: TagGroupData;
  lang: Locale;
  onTagClick: (tag: string) => void;
}

export function TagFilter({ tagGroups, lang, onTagClick }: TagFilterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { selectedTags } = useFilterStore();
  const isComposingRef = useRef(false);

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder={lang === "ko" ? "태그 검색..." : "Search tags..."}
        value={searchQuery}
        onChange={(e) => {
          if (!isComposingRef.current) {
            setSearchQuery(e.target.value);
          }
        }}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={(e) => {
          isComposingRef.current = false;
          setSearchQuery(e.currentTarget.value);
        }}
        className="w-full px-2 py-1 text-xs rounded border border-border bg-background focus:outline-none focus:border-accent"
      />
      {tagGroups.parentGroups.map((parent) => (
        <ParentGroup
          key={parent.id}
          parent={parent}
          groups={tagGroups.groups.filter((g) =>
            parent.children.includes(g.id)
          )}
          lang={lang}
          searchQuery={searchQuery}
          selectedTags={selectedTags}
          onTagClick={onTagClick}
        />
      ))}
    </div>
  );
}

function ParentGroup({
  parent,
  groups,
  lang,
  searchQuery,
  selectedTags,
  onTagClick,
}: {
  parent: { id: string; name: { ko: string; en: string } };
  groups: TagGroupData["groups"];
  lang: Locale;
  searchQuery: string;
  selectedTags: string[];
  onTagClick: (tag: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const filteredGroups = groups
    .map((g) => ({
      ...g,
      tags: searchQuery
        ? g.tags.filter((t) =>
            t.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : g.tags,
    }))
    .filter((g) => g.tags.length > 0);

  if (filteredGroups.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 w-full text-xs font-semibold py-1 hover:text-accent"
      >
        <span className="w-3">{expanded ? "▼" : "▶"}</span>
        {parent.name[lang]}
      </button>
      {expanded && (
        <div className="flex flex-wrap gap-1 pl-4 pb-2">
          {filteredGroups.flatMap((g) =>
            g.tags.map((tag) => (
              <button
                key={tag}
                onClick={() => onTagClick(tag)}
                className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-accent text-white"
                    : "bg-surface hover:bg-surface-hover"
                }`}
                style={
                  g.color && !selectedTags.includes(tag)
                    ? { borderLeft: `3px solid ${g.color}` }
                    : undefined
                }
              >
                {tag}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
