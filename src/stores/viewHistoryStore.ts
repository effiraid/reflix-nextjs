import { create } from "zustand";
import {
  clearViewHistory,
  deleteViewHistoryEntry,
  fetchViewHistoryEntries,
  recordViewHistoryBatch,
  type ViewHistoryEntry,
} from "@/lib/viewHistoryClient";

export const VIEW_HISTORY_WRITE_DELAY_MS = 700;

interface ViewHistoryState {
  userId: string | null;
  entries: ViewHistoryEntry[];
  isLoading: boolean;
  hasLoaded: boolean;
  syncForUser: (userId: string | null) => Promise<void>;
  queueClipView: (userId: string | null, clipId: string) => void;
  removeEntry: (userId: string | null, clipId: string) => Promise<void>;
  clearEntries: (userId: string | null) => Promise<void>;
}

let loadPromise: Promise<void> | null = null;
let loadingUserId: string | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let queuedUserId: string | null = null;
let queuedClipIds: string[] = [];

function clearPendingQueue() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  queuedUserId = null;
  queuedClipIds = [];
}

function sortEntries(entries: ViewHistoryEntry[]) {
  return [...entries].sort((a, b) =>
    b.viewedAt > a.viewedAt ? 1 : b.viewedAt < a.viewedAt ? -1 : 0
  );
}

function mergeEntries(
  serverEntries: ViewHistoryEntry[],
  optimisticEntries: ViewHistoryEntry[]
) {
  const merged = new Map<string, ViewHistoryEntry>();

  for (const entry of serverEntries) {
    merged.set(entry.clipId, entry);
  }

  for (const entry of optimisticEntries) {
    const existing = merged.get(entry.clipId);
    if (
      !existing ||
      entry.viewedAt >= existing.viewedAt
    ) {
      merged.set(entry.clipId, entry);
    }
  }

  return sortEntries(Array.from(merged.values()));
}

function applyOptimisticView(
  entries: ViewHistoryEntry[],
  clipId: string,
  viewedAt: string
) {
  const withoutClip = entries.filter((entry) => entry.clipId !== clipId);
  return [{ clipId, viewedAt }, ...withoutClip];
}

async function reloadHistoryFromServer(userId: string) {
  await useViewHistoryStore.getState().syncForUser(userId);
}

async function flushQueuedViews() {
  if (!queuedUserId || queuedClipIds.length === 0) return;

  const userId = queuedUserId;
  const clipIds = [...queuedClipIds];
  clearPendingQueue();

  try {
    await recordViewHistoryBatch(clipIds);
  } catch {
    await reloadHistoryFromServer(userId).catch(() => {});
  }
}

function scheduleFlush(userId: string) {
  queuedUserId = userId;
  if (flushTimer) {
    clearTimeout(flushTimer);
  }
  flushTimer = setTimeout(() => {
    void flushQueuedViews();
  }, VIEW_HISTORY_WRITE_DELAY_MS);
}

export const useViewHistoryStore = create<ViewHistoryState>()((set, get) => ({
  userId: null,
  entries: [],
  isLoading: false,
  hasLoaded: false,

  async syncForUser(userId) {
    if (!userId) {
      clearPendingQueue();
      set({
        userId: null,
        entries: [],
        isLoading: false,
        hasLoaded: false,
      });
      return;
    }

    const state = get();
    if (state.userId !== userId) {
      clearPendingQueue();
      set({
        userId,
        entries: [],
        isLoading: true,
        hasLoaded: false,
      });
    } else if (state.hasLoaded) {
      return;
    } else if (!state.isLoading) {
      set({ isLoading: true });
    }

    if (loadPromise && loadingUserId === userId) {
      return loadPromise;
    }

    loadingUserId = userId;
    loadPromise = fetchViewHistoryEntries()
      .then((serverEntries) => {
        const current = get();
        if (current.userId !== userId) return;
        set({
          entries: mergeEntries(serverEntries, current.entries),
          isLoading: false,
          hasLoaded: true,
        });
      })
      .catch(() => {
        const current = get();
        if (current.userId !== userId) return;
        set({
          isLoading: false,
          hasLoaded: true,
        });
      })
      .finally(() => {
        if (loadingUserId === userId) {
          loadingUserId = null;
          loadPromise = null;
        }
      });

    return loadPromise;
  },

  queueClipView(userId, clipId) {
    if (!userId || !clipId) return;

    const viewedAt = new Date().toISOString();
    set((state) => ({
      userId,
      entries: applyOptimisticView(state.entries, clipId, viewedAt),
      hasLoaded: true,
    }));

    queuedClipIds = queuedClipIds.filter((queuedClipId) => queuedClipId !== clipId);
    queuedClipIds.push(clipId);
    scheduleFlush(userId);
  },

  async removeEntry(userId, clipId) {
    if (!userId || !clipId) return;

    set((state) => ({
      entries: state.entries.filter((entry) => entry.clipId !== clipId),
      hasLoaded: true,
    }));
    queuedClipIds = queuedClipIds.filter((queuedClipId) => queuedClipId !== clipId);
    if (queuedClipIds.length === 0) {
      clearPendingQueue();
    }

    try {
      await deleteViewHistoryEntry(clipId);
    } catch {
      await reloadHistoryFromServer(userId).catch(() => {});
    }
  },

  async clearEntries(userId) {
    if (!userId) return;

    clearPendingQueue();
    set({
      entries: [],
      hasLoaded: true,
    });

    try {
      await clearViewHistory();
    } catch {
      await reloadHistoryFromServer(userId).catch(() => {});
    }
  },
}));

export function resetViewHistoryStoreForTests() {
  clearPendingQueue();
  loadPromise = null;
  loadingUserId = null;
  useViewHistoryStore.setState({
    userId: null,
    entries: [],
    isLoading: false,
    hasLoaded: false,
  });
}
