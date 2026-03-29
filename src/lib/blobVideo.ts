const MAX_CACHE_SIZE = 10;

/** LRU cache: videoUrl → blobUrl */
const cache = new Map<string, string>();

/** In-flight fetches for deduplication */
const inflight = new Map<string, Promise<string>>();

function evictOldest() {
  if (cache.size < MAX_CACHE_SIZE) return;
  // Map iteration order = insertion order; first key is oldest
  const oldest = cache.keys().next().value as string;
  const blobUrl = cache.get(oldest);
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  cache.delete(oldest);
}

function touchEntry(key: string) {
  const value = cache.get(key);
  if (value === undefined) return;
  // Re-insert to move to end (most recent)
  cache.delete(key);
  cache.set(key, value);
}

export function clearBlobVideoCache() {
  for (const blobUrl of cache.values()) {
    URL.revokeObjectURL(blobUrl);
  }
  cache.clear();
  inflight.clear();
}

/** @internal — exposed for tests only */
export const _clearCache = clearBlobVideoCache;

export async function fetchBlobUrl(
  videoUrl: string,
  cacheKey?: string,
): Promise<string> {
  const key = cacheKey ?? videoUrl;

  // Return cached blob URL if available
  const cached = cache.get(key);
  if (cached) {
    touchEntry(key);
    return cached;
  }

  // Deduplicate concurrent requests for the same URL
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const res = await fetch(videoUrl, {
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error(`Media fetch failed: ${res.status}`);
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    evictOldest();
    cache.set(key, blobUrl);
    return blobUrl;
  })();

  inflight.set(key, promise);
  // Swallow rejection before finally to avoid unhandled rejection from the cleanup chain
  promise.catch(() => {}).finally(() => inflight.delete(key));

  return promise;
}
