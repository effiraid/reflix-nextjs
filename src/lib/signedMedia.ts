export async function getSignedVideoUrl(path: string): Promise<string> {
  const res = await fetch("/api/media/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });

  if (!res.ok) {
    throw new Error(`Sign request failed: ${res.status}`);
  }

  const { url } = await res.json();
  return url;
}
