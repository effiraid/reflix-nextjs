"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useClipStore } from "@/stores/clipStore";
import { RightPanelInspector } from "./RightPanelInspector";
import { useClipData } from "@/app/[lang]/browse/ClipDataProvider";
import { useFilterSync } from "@/hooks/useFilterSync";
import { useClipDetail } from "@/hooks/useClipDetail";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { CategoryTree, Locale } from "@/lib/types";

interface RightPanelContentProps {
  categories: CategoryTree;
  lang: Locale;
  dict: Dictionary;
  tagI18n?: Record<string, string>;
}

export function RightPanelContent({
  categories,
  lang,
  dict,
  tagI18n = {},
}: RightPanelContentProps) {
  const clipIndex = useClipData();
  const { selectedClipId, setSelectedClipId } = useClipStore();
  const { updateURL } = useFilterSync();
  const { clip, loadState } = useClipDetail(selectedClipId);
  const activeClip = clip?.id === selectedClipId ? clip : null;
  const clipIndexMap = useMemo(
    () => new Map(clipIndex.map((entry) => [entry.id, entry])),
    [clipIndex]
  );
  const relatedClips = useMemo(
    () =>
      activeClip?.relatedClips
        .map((clipId) => clipIndexMap.get(clipId))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)) ?? [],
    [activeClip?.relatedClips, clipIndexMap]
  );

  if (!selectedClipId) {
    return null;
  }

  if (!activeClip) {
    if (loadState === "error") {
      return (
        <div className="p-4 text-sm text-muted">{dict.common.loadFailed}</div>
      );
    }

    return (
      <div
        role="status"
        aria-label={dict.common.loading}
        className="flex min-h-full w-full items-center justify-center p-6 text-muted"
      >
        <Loader2
          data-testid="inspector-loading-spinner"
          aria-hidden="true"
          className="size-5 animate-spin"
          strokeWidth={1.9}
        />
      </div>
    );
  }

  return (
    <RightPanelInspector
      key={activeClip.id}
      clip={activeClip}
      categories={categories}
      lang={lang}
      dict={dict}
      tagI18n={tagI18n}
      relatedClips={relatedClips}
      onSelectFolder={(folderId) =>
        updateURL({
          selectedFolders: [folderId],
          excludedFolders: [],
          selectedTags: [],
          excludedTags: [],
        })
      }
      onSelectRelatedClip={setSelectedClipId}
      onSelectTag={(tag) =>
        updateURL({
          selectedTags: [tag],
          selectedFolders: [],
          excludedFolders: [],
          excludedTags: [],
        })
      }
    />
  );
}
