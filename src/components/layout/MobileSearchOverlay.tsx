"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { SearchBar } from "@/components/common/SearchBar";
import { getMediaUrl } from "@/lib/mediaUrl";
import { searchClips } from "@/lib/clipSearch";
import { getTagDisplayLabels } from "@/lib/tagDisplay";
import type { BrowseClipRecord, Locale } from "@/lib/types";

interface MobileSearchOverlayProps {
  open: boolean;
  clips: BrowseClipRecord[];
  searchReady: boolean;
  lang: Locale;
  tagI18n: Record<string, string>;
  placeholder: string;
  closeLabel: string;
  noResultsLabel: string;
  loadingLabel: string;
  onClose: () => void;
  onSelectClip: (clipId: string, query: string) => void;
  allTags?: string[];
  popularTags?: string[];
}

export function MobileSearchOverlay({
  open,
  clips,
  searchReady,
  lang,
  tagI18n,
  placeholder,
  closeLabel,
  noResultsLabel,
  loadingLabel,
  onClose,
  onSelectClip,
  allTags = [],
  popularTags = [],
}: MobileSearchOverlayProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(
    () =>
      query
        ? searchClips(clips, {
            lang,
            query,
            tagI18n,
          })
        : [],
    [clips, lang, query, tagI18n]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={placeholder}
      className="fixed inset-0 z-50 flex flex-col bg-background md:hidden"
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <SearchBar
            initialQuery={query}
            placeholder={placeholder}
            onSearch={setQuery}
            autoFocus
            allTags={allTags}
            popularTags={popularTags}
            lang={lang}
            recentLabel={lang === "ko" ? "최근 검색어" : "Recent searches"}
            popularLabel={lang === "ko" ? "인기 태그" : "Popular tags"}
            suggestionsLabel={lang === "ko" ? "태그 제안" : "Tag suggestions"}
            clearLabel={lang === "ko" ? "지우기" : "Clear"}
          />
        </div>
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:text-foreground"
        >
          <X aria-hidden="true" size={18} strokeWidth={1.9} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {query ? (
          !searchReady ? (
            <p className="py-8 text-center text-sm text-muted">{loadingLabel}</p>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              {results.map((clip) => (
                <button
                  key={clip.id}
                  type="button"
                  aria-label={clip.name}
                  onClick={() => onSelectClip(clip.id, query)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface/50 p-3 text-left"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                    <Image
                      src={getMediaUrl(clip.thumbnailUrl)}
                      alt={clip.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {clip.name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">
                      {getTagDisplayLabels(clip.tags ?? [], lang, tagI18n).join(" · ")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted">{noResultsLabel}</p>
          )
        ) : null}
      </div>
    </div>
  );
}
