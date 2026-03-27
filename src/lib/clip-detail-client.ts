import type { Clip } from "./types";

const clipDetailCache = new Map<string, Clip>();
const inflightClipDetailCache = new Map<string, Promise<Clip | null>>();

function getClipDetailUrl(id: string): string {
  return `/data/clips/${id}.json`;
}

export async function loadClipDetail(id: string): Promise<Clip | null> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    return null;
  }

  const cached = clipDetailCache.get(id);
  if (cached) {
    return cached;
  }

  const inflight = inflightClipDetailCache.get(id);
  if (inflight) {
    return inflight;
  }

  const request = fetch(getClipDetailUrl(id), {
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }

      const clip = (await response.json()) as Clip;
      clipDetailCache.set(id, clip);
      return clip;
    })
    .catch((error) => {
      console.error("[clip-detail-client] Failed to load clip detail:", id, error);
      return null;
    })
    .finally(() => {
      inflightClipDetailCache.delete(id);
    });

  inflightClipDetailCache.set(id, request);
  return request;
}

export function getCachedClipDetail(id: string): Clip | null {
  return clipDetailCache.get(id) ?? null;
}

export function clearClipDetailCache() {
  clipDetailCache.clear();
  inflightClipDetailCache.clear();
}
