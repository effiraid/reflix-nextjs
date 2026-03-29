"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  allCards: BrowseCardRecord[] | null;
  cardsStatus: ProjectionStatus;
  projectionClips: BrowseProjectionRecord[] | null;
  projectionStatus: ProjectionStatus;
  initialTotalCount: number;
  totalClipCount: number;
  allTags: string[];
  popularTags: string[];
  tagCounts: Record<string, number>;
  requestCardIndex: () => void;
  requestDetailedIndex: () => void;
}

const ClipDataContext = createContext<BrowseDataContextValue>({
  initialClips: [],
  allCards: null,
  cardsStatus: "loading",
  projectionClips: null,
  projectionStatus: "loading",
  initialTotalCount: 0,
  totalClipCount: 0,
  allTags: [],
  popularTags: [],
  tagCounts: {},
  requestCardIndex: () => {},
  requestDetailedIndex: () => {},
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
  const [allCards, setAllCards] = useState<BrowseCardRecord[] | null>(null);
  const [cardsStatus, setCardsStatus] =
    useState<ProjectionStatus>("loading");
  const [projectionClips, setProjectionClips] =
    useState<BrowseProjectionRecord[] | null>(null);
  const [projectionStatus, setProjectionStatus] =
    useState<ProjectionStatus>("loading");
  const [cardIndexRequested, setCardIndexRequested] = useState(preloadDetailedIndex);
  const [detailedIndexRequested, setDetailedIndexRequested] =
    useState(preloadDetailedIndex);
  const allCardsRef = useRef<BrowseCardRecord[] | null>(null);
  const inFlightRef = useRef(false);
  const cardsLoadPromiseRef =
    useRef<Promise<BrowseCardRecord[]> | null>(null);
  const cardsLoadControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const filters = useFilterStore(
    useShallow((state) => ({
      selectedFolders: state.selectedFolders,
      excludedFolders: state.excludedFolders,
      selectedTags: state.selectedTags,
      excludedTags: state.excludedTags,
      searchQuery: state.searchQuery,
    }))
  );

  const requestCardIndex = useCallback(() => {
    setCardIndexRequested(true);
  }, []);

  const requestDetailedIndex = useCallback(() => {
    setDetailedIndexRequested(true);
  }, []);

  const shouldLoadDetailedIndex =
    detailedIndexRequested ||
    requiresDetailedBrowseIndex(filters, {
      includeSearchQuery: false,
    });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cardsLoadControllerRef.current?.abort();
    };
  }, []);

  const loadCards = useCallback(() => {
    if (allCardsRef.current) {
      return Promise.resolve(allCardsRef.current);
    }

    if (cardsLoadPromiseRef.current) {
      return cardsLoadPromiseRef.current;
    }

    const controller = new AbortController();
    cardsLoadControllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    setCardsStatus("loading");

    const requestPromise = (async () => {
      try {
        const cardsResponse = await fetch("/api/browse/cards", {
          signal: controller.signal,
        });
        if (!cardsResponse.ok) {
          throw new Error(`cards HTTP ${cardsResponse.status}`);
        }

        const cards = (await cardsResponse.json()) as BrowseCardRecord[];
        allCardsRef.current = cards;
        startTransition(() => {
          setAllCards(cards);
          setCardsStatus("ready");
        });
        return cards;
      } catch (err) {
        if (isMountedRef.current) {
          if (err instanceof Error && err.name !== "AbortError") {
            console.error("[ClipDataProvider] cards load failed:", err);
          }
          setCardsStatus("error");
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
    })();

    const sharedPromise = requestPromise.finally(() => {
      if (cardsLoadPromiseRef.current === sharedPromise) {
        cardsLoadPromiseRef.current = null;
        cardsLoadControllerRef.current = null;
      }
    });

    cardsLoadPromiseRef.current = sharedPromise;
    return sharedPromise;
  }, []);

  useEffect(() => {
    if (!cardIndexRequested || allCardsRef.current || cardsLoadPromiseRef.current) {
      return;
    }

    void loadCards().catch(() => {});
  }, [allCards, cardIndexRequested, loadCards]);

  useEffect(() => {
    if (!shouldLoadDetailedIndex || projectionClips || inFlightRef.current) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    inFlightRef.current = true;
    let cancelled = false;

    async function preload() {
      try {
        const cards = await loadCards();
        if (cancelled) {
          return;
        }

        const filterIndexResponse = await fetch("/api/browse/filter-index", {
          signal: controller.signal,
        });
        if (!filterIndexResponse.ok) {
          throw new Error(`filter-index HTTP ${filterIndexResponse.status}`);
        }

        const filterIndex = (await filterIndexResponse.json()) as BrowseFilterIndexRecord[];
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
        if (!cancelled) {
          if (!allCardsRef.current) {
            setCardsStatus("error");
          }
          if (err instanceof Error && err.name !== "AbortError") {
            console.error("[ClipDataProvider] filter-index load failed:", err);
          }
          setProjectionStatus("error");
        }
      } finally {
        inFlightRef.current = false;
        clearTimeout(timeout);
      }
    }

    void preload();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [projectionClips, shouldLoadDetailedIndex, loadCards]);

  // Derive unique tag list from full clip data (unfiltered) for autocomplete
  const sourceClips = projectionClips ?? allCards ?? clips;
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

  // Tag counts: per-tag clip usage frequency (exposed via context)
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const clip of sourceClips) {
      if (clip.tags) {
        for (const t of clip.tags) counts[t] = (counts[t] ?? 0) + 1;
      }
      if ("aiStructuredTags" in clip) {
        const proj = clip as BrowseProjectionRecord;
        if (proj.aiStructuredTags) {
          for (const t of proj.aiStructuredTags)
            counts[t] = (counts[t] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [sourceClips]);

  // Top 8 tags by frequency (min count 2 to avoid false popularity signals)
  const popularTags = useMemo(() => {
    return Object.entries(tagCounts)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [tagCounts]);

  return (
    <ClipDataContext.Provider
      value={{
        initialClips: clips,
        allCards,
        cardsStatus,
        projectionClips,
        projectionStatus,
        initialTotalCount,
        totalClipCount,
        allTags,
        popularTags,
        tagCounts,
        requestCardIndex,
        requestDetailedIndex,
      }}
    >
      {children}
    </ClipDataContext.Provider>
  );
}

export function useClipData() {
  const { initialClips, allCards, projectionClips } =
    useContext(ClipDataContext);
  return (projectionClips ?? allCards ?? initialClips) as BrowseClipRecord[];
}

export function useBrowseData() {
  return useContext(ClipDataContext);
}
