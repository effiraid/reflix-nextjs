export interface ViewHistoryEntry {
  clipId: string;
  viewedAt: string;
}

export interface ViewHistoryResponse {
  entries: ViewHistoryEntry[];
}

export async function fetchViewHistoryEntries(): Promise<ViewHistoryEntry[]> {
  const res = await fetch("/api/view-history");
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error(`Failed to fetch view history: ${res.status}`);
  }

  const data = (await res.json()) as ViewHistoryResponse;
  return data.entries ?? [];
}

export async function recordViewHistoryBatch(clipIds: string[]): Promise<void> {
  const normalizedClipIds = clipIds.map((clipId) => clipId.trim()).filter(Boolean);
  if (normalizedClipIds.length === 0) return;

  const res = await fetch("/api/view-history", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clipIds: normalizedClipIds }),
  });

  if (!res.ok) {
    throw new Error(`Failed to record view history: ${res.status}`);
  }
}

export async function deleteViewHistoryEntry(clipId: string): Promise<void> {
  const res = await fetch(`/api/view-history?clipId=${encodeURIComponent(clipId)}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error(`Failed to delete view history entry: ${res.status}`);
  }
}

export async function clearViewHistory(): Promise<void> {
  const res = await fetch("/api/view-history", {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error(`Failed to clear view history: ${res.status}`);
  }
}
