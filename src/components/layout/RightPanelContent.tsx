"use client";

import { useMemo } from "react";
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

    return <div className="p-4 text-sm text-muted">{dict.common.loading}</div>;
  }

  return (
    <RightPanelInspector
      clip={activeClip}
      categories={categories}
      lang={lang}
      dict={dict}
      tagI18n={tagI18n}
      relatedClips={relatedClips}
      onSelectFolder={(folderId) =>
        updateURL({
          selectedFolders: [folderId],
          selectedTags: [],
          excludedTags: [],
        })
      }
      onSelectRelatedClip={setSelectedClipId}
      onSelectTag={(tag) =>
        updateURL({
          selectedTags: [tag],
          selectedFolders: [],
          excludedTags: [],
        })
      }
    />
  );
}
