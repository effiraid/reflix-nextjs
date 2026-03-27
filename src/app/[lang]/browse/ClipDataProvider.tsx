"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
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
}

const ClipDataContext = createContext<BrowseDataContextValue>({
  initialClips: [],
  projectionClips: null,
  projectionStatus: "loading",
  initialTotalCount: 0,
  totalClipCount: 0,
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
    let cancelled = false;

    async function preloadProjection() {
      try {
        const response = await fetch("/api/browse/projection", {
          cache: "force-cache",
        });

        if (!response.ok) {
          throw new Error(`Projection preload failed: ${response.status}`);
        }

        const nextProjection =
          (await response.json()) as BrowseProjectionRecord[];
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setProjectionClips(nextProjection);
          setProjectionStatus("ready");
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("[ClipDataProvider] Failed to preload projection:", error);
        setProjectionStatus("error");
      }
    }

    void preloadProjection();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ClipDataContext.Provider
      value={{
        initialClips: clips,
        projectionClips,
        projectionStatus,
        initialTotalCount,
        totalClipCount,
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
