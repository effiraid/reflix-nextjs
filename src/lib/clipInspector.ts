const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "m4v", "avi", "mkv"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif"]);

export function getClipMediaKind(ext: string): "video" | "image" {
  const normalized = ext.trim().replace(/^\./, "").toLowerCase();
  if (VIDEO_EXTENSIONS.has(normalized)) return "video";
  if (IMAGE_EXTENSIONS.has(normalized)) return "image";
  return "image";
}

export function formatClipDuration(durationInSeconds: number): string {
  const totalSeconds = Math.round(durationInSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }

  return [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}
