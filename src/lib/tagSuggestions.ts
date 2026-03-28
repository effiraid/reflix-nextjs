import { createMatcher } from "./search";
import type { Locale } from "./types";

const MAX_SUGGESTIONS = 8;

/** Filter allTags by query using locale-aware matching (choseong, qwerty→hangul, fuzzy) */
export function matchTags(
  allTags: string[],
  query: string,
  lang: Locale
): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const match = createMatcher(lang, trimmed);
  return allTags.filter((tag) => match(tag)).slice(0, MAX_SUGGESTIONS);
}
