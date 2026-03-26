export async function fetchBlobUrl(
  videoUrl: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(videoUrl, {
    credentials: "include",
    signal,
  });
  if (!res.ok) {
    throw new Error(`Media fetch failed: ${res.status}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
