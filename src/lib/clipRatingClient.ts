export interface ClipRating {
  rating: number | null;
  memo: string | null;
}

const SAVE_RETRY_ATTEMPTS = 2;
const SAVE_RETRY_DELAY_MS = 150;

function isTransientSaveError(error: unknown) {
  return error instanceof TypeError;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchClipRating(clipId: string): Promise<ClipRating> {
  const res = await fetch(`/api/user-ratings?clipId=${encodeURIComponent(clipId)}`);
  if (!res.ok) {
    if (res.status === 401) return { rating: null, memo: null };
    throw new Error(`Failed to fetch rating: ${res.status}`);
  }
  return res.json();
}

export async function saveClipRating(
  clipId: string,
  rating: number | null,
  memo: string | null
): Promise<ClipRating> {
  for (let attempt = 0; attempt < SAVE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch("/api/user-ratings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId, rating, memo }),
      });
      if (!res.ok) throw new Error(`Failed to save rating: ${res.status}`);
      return res.json();
    } catch (error) {
      const shouldRetry =
        attempt < SAVE_RETRY_ATTEMPTS - 1 && isTransientSaveError(error);

      if (!shouldRetry) {
        throw error;
      }

      await wait(SAVE_RETRY_DELAY_MS);
    }
  }

  throw new Error("Failed to save rating");
}

export async function deleteClipRating(clipId: string): Promise<void> {
  const res = await fetch(`/api/user-ratings?clipId=${encodeURIComponent(clipId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete rating: ${res.status}`);
}
