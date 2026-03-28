export interface ClipRating {
  rating: number | null;
  memo: string | null;
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
  const res = await fetch("/api/user-ratings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clipId, rating, memo }),
  });
  if (!res.ok) throw new Error(`Failed to save rating: ${res.status}`);
  return res.json();
}

export async function deleteClipRating(clipId: string): Promise<void> {
  const res = await fetch(`/api/user-ratings?clipId=${encodeURIComponent(clipId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete rating: ${res.status}`);
}
