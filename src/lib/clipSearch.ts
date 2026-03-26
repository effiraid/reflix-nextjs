import { getClipSearchTargets, getStructuredAiTags } from "./aiTags";
import { createMatcher, isChoseongOnly, isLatinOnly } from "./search";
import { getTagDisplayLabels } from "./tagDisplay";
import type { ClipIndex, Locale } from "./types";

export type SearchMode = "none" | "instant" | "semantic";

interface SearchClipOptions {
  lang: Locale;
  query: string;
  tagI18n: Record<string, string>;
}

export function getSearchMode(lang: Locale, query: string): SearchMode {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return "none";
  }

  if (lang === "ko" && (isChoseongOnly(trimmedQuery) || isLatinOnly(trimmedQuery))) {
    return "instant";
  }

  return "semantic";
}

export function searchClips(
  clips: ClipIndex[],
  { lang, query, tagI18n }: SearchClipOptions
): ClipIndex[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return clips;
  }

  const mode = getSearchMode(lang, trimmedQuery);
  const match = createMatcher(lang, trimmedQuery);

  return clips
    .map((clip) => {
      const score = scoreClipMatch(clip, trimmedQuery, match, tagI18n, mode);
      return score === null ? null : { clip, score };
    })
    .filter((entry): entry is { clip: ClipIndex; score: number } => Boolean(entry))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.clip.name.localeCompare(b.clip.name, lang);
    })
    .map((entry) => entry.clip);
}

function scoreClipMatch(
  clip: ClipIndex,
  query: string,
  match: (target: string) => boolean,
  tagI18n: Record<string, string>,
  mode: SearchMode
): number | null {
  const manualTags = clip.tags ?? [];
  const translatedTags = getTagDisplayLabels(manualTags, "en", tagI18n)
    .filter((value, index) => value !== manualTags[index]);
  const aiStructuredTags = clip.aiTags
    ? getStructuredAiTags(clip.aiTags)
    : [];
  const translatedAiStructuredTags = getTagDisplayLabels(aiStructuredTags, "en", tagI18n)
    .filter((value, index) => value !== aiStructuredTags[index]);
  const descriptions = clip.aiTags
    ? [clip.aiTags.description.ko, clip.aiTags.description.en]
    : [];

  const candidates = [
    { value: clip.name, weight: 120 },
    ...manualTags.map((value) => ({ value, weight: 90 })),
    ...translatedTags.map((value) => ({ value, weight: 80 })),
    ...aiStructuredTags.map((value) => ({ value, weight: 70 })),
    ...translatedAiStructuredTags.map((value) => ({ value, weight: 70 })),
    ...descriptions.map((value) => ({ value, weight: mode === "semantic" ? 60 : 45 })),
  ];

  let bestScore: number | null = null;
  for (const candidate of candidates) {
    if (!candidate.value || !match(candidate.value)) {
      continue;
    }

    const normalizedCandidate = candidate.value.toLowerCase();
    const normalizedQuery = query.toLowerCase();
    let score = candidate.weight;

    if (normalizedCandidate === normalizedQuery) {
      score += 40;
    } else if (normalizedCandidate.startsWith(normalizedQuery)) {
      score += 20;
    } else if (normalizedCandidate.includes(normalizedQuery)) {
      score += 10;
    }

    bestScore = bestScore === null ? score : Math.max(bestScore, score);
  }

  return bestScore;
}

export function getSearchTargetsForOverlay(
  clip: ClipIndex,
  tagI18n: Record<string, string>
): string[] {
  return getClipSearchTargets(clip, tagI18n);
}
