"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  BrowseCardRecord,
  BrowseFilterIndexRecord,
  BrowseClipRecord,
  BrowseProjectionRecord,
  BrowseSummaryRecord,
} from "@/lib/types";
import { requiresDetailedBrowseIndex } from "@/lib/browse-service";
import { useFilterStore } from "@/stores/filterStore";
import { useShallow } from "zustand/react/shallow";

type ProjectionStatus = "loading" | "ready" | "error";

interface BrowseDataContextValue {
  initialClips: BrowseSummaryRecord[];
  projectionClips: BrowseProjectionRecord[] | null;
  projectionStatus: ProjectionStatus;
  initialTotalCount: number;
  totalClipCount: number;
  allTags: string[];
  popularTags: string[];
}

const ClipDataContext = createContext<BrowseDataContextValue>({
  initialClips: [],
  projectionClips: null,
  projectionStatus: "loading",
  initialTotalCount: 0,
  totalClipCount: 0,
  allTags: [],
  popularTags: [],
});

export function ClipDataProvider({
  clips,
  initialTotalCount = clips.length,
  totalClipCount = initialTotalCount,
  preloadDetailedIndex = false,
  children,
}: {
  clips: BrowseSummaryRecord[];
  initialTotalCount?: number;
  totalClipCount?: number;
  preloadDetailedIndex?: boolean;
  children: ReactNode;
}) {
  const [projectionClips, setProjectionClips] =
    useState<BrowseProjectionRecord[] | null>(null);
  const [projectionStatus, setProjectionStatus] =
    useState<ProjectionStatus>("loading");
  const [idlePreload, setIdlePreload] = useState(false);
  const filters = useFilterStore(
    useShallow((state) => ({
      selectedFolders: state.selectedFolders,
      excludedFolders: state.excludedFolders,
      selectedTags: state.selectedTags,
      excludedTags: state.excludedTags,
      searchQuery: state.searchQuery,
    }))
  );

  // Always preload the detailed index after first paint so tag panel,
  // search, and autocomplete are ready before the user interacts.
  useEffect(() => {
    if (preloadDetailedIndex || projectionClips) return;
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => setIdlePreload(true));
      return () => cancelIdleCallback(id);
    }
    const timer = setTimeout(() => setIdlePreload(true), 200);
    return () => clearTimeout(timer);
  }, [preloadDetailedIndex, projectionClips]);

  const shouldLoadDetailedIndex =
    preloadDetailedIndex || idlePreload || requiresDetailedBrowseIndex(filters);

  useEffect(() => {
    if (!shouldLoadDetailedIndex || projectionClips) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    async function preload() {
      try {
        const [cardsResponse, filterIndexResponse] = await Promise.all([
          fetch("/api/browse/cards", {
            signal: controller.signal,
          }),
          fetch("/api/browse/filter-index", {
            signal: controller.signal,
          }),
        ]);
        if (!cardsResponse.ok) throw new Error(`cards HTTP ${cardsResponse.status}`);
        if (!filterIndexResponse.ok) {
          throw new Error(`filter-index HTTP ${filterIndexResponse.status}`);
        }

        const [cards, filterIndex] = (await Promise.all([
          cardsResponse.json(),
          filterIndexResponse.json(),
        ])) as [BrowseCardRecord[], BrowseFilterIndexRecord[]];
        const cardsById = new Map(cards.map((clip) => [clip.id, clip] as const));
        const data = filterIndex.map((record): BrowseProjectionRecord => ({
          ...(cardsById.get(record.id) ?? {
            id: record.id,
            name: record.name,
            thumbnailUrl: "",
            previewUrl: "",
            lqipBase64: "",
            width: 640,
            height: 360,
            duration: 0,
            category: record.category,
          }),
          tags: record.tags,
          aiStructuredTags: record.aiStructuredTags,
          folders: record.folders,
          searchTokens: record.searchTokens,
        }));

        startTransition(() => {
          setProjectionClips(data);
          setProjectionStatus("ready");
        });
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("[ClipDataProvider] filter-index load failed:", err);
          setProjectionStatus("error");
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    void preload();
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [projectionClips, shouldLoadDetailedIndex]);

  // Derive unique tag list from full clip data (unfiltered) for autocomplete
  const sourceClips = projectionClips ?? clips;
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const clip of sourceClips) {
      if (clip.tags) {
        for (const t of clip.tags) tagSet.add(t);
      }
      if ("aiStructuredTags" in clip) {
        const proj = clip as BrowseProjectionRecord;
        if (proj.aiStructuredTags) {
          for (const t of proj.aiStructuredTags) tagSet.add(t);
        }
      }
    }
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, "ko"));
  }, [sourceClips]);

  // Top 8 tags by clip usage frequency
  const popularTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const clip of sourceClips) {
      if (clip.tags) {
        for (const t of clip.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      if ("aiStructuredTags" in clip) {
        const proj = clip as BrowseProjectionRecord;
        if (proj.aiStructuredTags) {
          for (const t of proj.aiStructuredTags)
            counts.set(t, (counts.get(t) ?? 0) + 1);
        }
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [sourceClips]);

  return (
    <ClipDataContext.Provider
      value={{
        initialClips: clips,
        projectionClips,
        projectionStatus,
        initialTotalCount,
        totalClipCount,
        allTags,
        popularTags,
      }}
    >
      {children}
    </ClipDataContext.Provider>
  );
}

export function useClipData() {
  const { initialClips, projectionClips } = useContext(ClipDataContext);
  return (projectionClips ?? initialClips) as BrowseClipRecord[];
}

export function useBrowseData() {
  return useContext(ClipDataContext);
}
