"use client";

import { useEffect, useMemo, useReducer } from "react";
import { useClipStore } from "@/stores/clipStore";
import { RightPanelInspector } from "./RightPanelInspector";
import { useClipData } from "@/app/[lang]/browse/ClipDataProvider";
import { useFilterSync } from "@/hooks/useFilterSync";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { CategoryTree, Clip, Locale } from "@/lib/types";

type ClipLoadState = "idle" | "loading" | "ready" | "error";
type ClipPanelState = {
  clip: Clip | null;
  loadState: ClipLoadState;
};
type ClipPanelAction =
  | { type: "start" }
  | { type: "success"; clip: Clip }
  | { type: "error" };

function clipPanelReducer(
  state: ClipPanelState,
  action: ClipPanelAction
): ClipPanelState {
  switch (action.type) {
    case "start":
      return {
        clip: state.clip,
        loadState: "loading",
      };
    case "success":
      return {
        clip: action.clip,
        loadState: "ready",
      };
    case "error":
      return {
        clip: null,
        loadState: "error",
      };
  }
}

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
  const [{ clip, loadState }, dispatch] = useReducer(clipPanelReducer, {
    clip: null,
    loadState: "idle",
  });
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

  useEffect(() => {
    if (!selectedClipId) {
      return;
    }

    dispatch({ type: "start" });
    const controller = new AbortController();
    fetch(`/data/clips/${selectedClipId}.json`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((nextClip) => {
        dispatch({ type: "success", clip: nextClip });
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          console.error("[RightPanelContent] Failed to load clip:", selectedClipId, e);
          dispatch({ type: "error" });
        }
      });
    return () => controller.abort();
  }, [selectedClipId]);

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
