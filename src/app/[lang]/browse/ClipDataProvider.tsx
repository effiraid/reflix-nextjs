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
  BrowseClipRecord,
  BrowseProjectionRecord,
  BrowseSummaryRecord,
} from "@/lib/types";

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
  children,
}: {
  clips: BrowseSummaryRecord[];
  initialTotalCount?: number;
  totalClipCount?: number;
  children: ReactNode;
}) {
  const [projectionClips, setProjectionClips] =
    useState<BrowseProjectionRecord[] | null>(null);
  const [projectionStatus, setProjectionStatus] =
    useState<ProjectionStatus>("loading");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    async function preload() {
      try {
        const res = await fetch("/api/browse/filter-index", {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as BrowseProjectionRecord[];

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
  }, []);

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
