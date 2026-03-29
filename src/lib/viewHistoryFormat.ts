import type { Locale } from "@/lib/types";

export function formatViewedAt(viewedAt: string, lang: Locale, now = Date.now()) {
  const time = new Date(viewedAt).getTime();
  if (!Number.isFinite(time)) {
    return lang === "ko" ? "방금 전" : "Just now";
  }

  const diffMs = Math.max(0, now - time);
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) {
    return lang === "ko" ? "방금 전" : "Just now";
  }

  if (diffMinutes < 60) {
    return lang === "ko" ? `${diffMinutes}분 전` : `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return lang === "ko" ? `${diffHours}시간 전` : `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return lang === "ko" ? `${diffDays}일 전` : `${diffDays}d ago`;
  }

  return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
  }).format(time);
}
