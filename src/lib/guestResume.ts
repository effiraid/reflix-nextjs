const RESUME_CLIP_PARAM = "resumeClip";
const RESUME_OPEN_PARAM = "resumeOpen";
const CLIP_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function normalizeSearch(search: string) {
  return search.startsWith("?") ? search.slice(1) : search;
}

export function isValidResumeClipId(value: string | null | undefined): value is string {
  return Boolean(value && CLIP_ID_PATTERN.test(value));
}

export function buildGuestResumeNextPath(
  pathname: string,
  search: string,
  clipId: string
): string {
  const params = new URLSearchParams(normalizeSearch(search));

  if (!isValidResumeClipId(clipId)) {
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  params.set(RESUME_CLIP_PARAM, clipId);
  params.set(RESUME_OPEN_PARAM, "1");

  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function readGuestResume(search: string): {
  clipId: string | null;
  shouldOpen: boolean;
} {
  const params = new URLSearchParams(normalizeSearch(search));
  const clipId = params.get(RESUME_CLIP_PARAM);

  return {
    clipId: isValidResumeClipId(clipId) ? clipId : null,
    shouldOpen: params.get(RESUME_OPEN_PARAM) === "1",
  };
}

export function clearGuestResumeParams(pathname: string, search: string): string {
  const params = new URLSearchParams(normalizeSearch(search));
  params.delete(RESUME_CLIP_PARAM);
  params.delete(RESUME_OPEN_PARAM);

  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
