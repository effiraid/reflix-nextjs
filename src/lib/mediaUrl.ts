function isAbsoluteUrl(path: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(path);
}

export function getConfiguredMediaBase(): string {
  return (process.env.NEXT_PUBLIC_MEDIA_URL ?? "").trim().replace(/\/+$/, "");
}

export function getMediaUrl(path: string): string {
  const normalizedPath = path.trim();
  if (!normalizedPath || isAbsoluteUrl(normalizedPath)) {
    return normalizedPath;
  }

  const mediaBase = getConfiguredMediaBase();
  if (!mediaBase) {
    return normalizedPath;
  }

  return normalizedPath.startsWith("/")
    ? `${mediaBase}${normalizedPath}`
    : `${mediaBase}/${normalizedPath}`;
}
