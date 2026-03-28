import { getClipSearchTargets, getStructuredAiTags } from "./aiTags";
import { createMatcher, isChoseongOnly, isLatinOnly } from "./search";
import { getTagDisplayLabels } from "./tagDisplay";
import type { AIGeneratedTags, Locale } from "./types";

export type SearchMode = "none" | "instant" | "semantic";

export interface SearchableClipRecord {
  id: string;
  name: string;
  tags?: string[];
  aiTags?: AIGeneratedTags | null;
  aiStructuredTags?: string[];
  searchTokens?: string[];
}

interface SearchClipOptions {
  lang: Locale;
  query: string;
  tagI18n: Record<string, string>;
}

function splitQueryWords(query: string): string[] {
  return query.split(/\s+/).filter(Boolean);
}

export function getSearchMode(lang: Locale, query: string): SearchMode {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return "none";
  }

  if (lang === "ko") {
    const words = splitQueryWords(trimmedQuery);
    if (words.some((w) => isChoseongOnly(w) || isLatinOnly(w))) {
      return "instant";
    }
  }

  return "semantic";
}

export function searchClips<T extends SearchableClipRecord>(
  clips: T[],
  { lang, query, tagI18n }: SearchClipOptions
): T[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return clips;
  }

  const words = splitQueryWords(trimmedQuery);
  const mode = getSearchMode(lang, trimmedQuery);

  if (words.length === 1) {
    const match = createMatcher(lang, trimmedQuery);
    return clips
      .map((clip) => {
        const score = scoreClipMatchSingle(clip, trimmedQuery, match, tagI18n, mode);
        return score === null ? null : { clip, score };
      })
      .filter((entry): entry is { clip: T; score: number } => Boolean(entry))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.clip.name ?? "").localeCompare(b.clip.name ?? "", lang);
      })
      .map((entry) => entry.clip);
  }

  const matchers = words.map((w) => createMatcher(lang, w));
  return clips
    .map((clip) => {
      const score = scoreClipMatchMulti(clip, words, matchers, tagI18n, mode);
      return score === null ? null : { clip, score };
    })
    .filter((entry): entry is { clip: T; score: number } => Boolean(entry))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.clip.name ?? "").localeCompare(b.clip.name ?? "", lang);
    })
    .map((entry) => entry.clip);
}

interface Candidate {
  value: string;
  weight: number;
}

function buildCandidates(
  clip: SearchableClipRecord,
  tagI18n: Record<string, string>,
  mode: SearchMode
): Candidate[] {
  const manualTags = clip.tags ?? [];
  const translatedTags = getTagDisplayLabels(manualTags, "en", tagI18n)
    .filter((value, index) => value !== manualTags[index]);
  const aiStructuredTags = clip.aiStructuredTags ?? getStructuredAiTags(clip.aiTags);
  const translatedAiStructuredTags = getTagDisplayLabels(aiStructuredTags, "en", tagI18n)
    .filter((value, index) => value !== aiStructuredTags[index]);
  const descriptions = clip.aiTags
    ? [clip.aiTags.description.ko, clip.aiTags.description.en]
    : [];
  const searchTokens = clip.searchTokens ?? [];

  return [
    { value: clip.name, weight: 120 },
    ...manualTags.map((value) => ({ value, weight: 90 })),
    ...translatedTags.map((value) => ({ value, weight: 80 })),
    ...aiStructuredTags.map((value) => ({ value, weight: 70 })),
    ...translatedAiStructuredTags.map((value) => ({ value, weight: 70 })),
    ...searchTokens.map((value) => ({ value, weight: mode === "semantic" ? 60 : 45 })),
    ...descriptions.map((value) => ({ value, weight: mode === "semantic" ? 60 : 45 })),
  ];
}

function scoreCandidateForWord(
  candidate: Candidate,
  word: string,
  match: (target: string) => boolean
): number | null {
  if (!candidate.value || !match(candidate.value)) {
    return null;
  }

  const normalizedCandidate = candidate.value.toLowerCase();
  const normalizedWord = word.toLowerCase();
  let score = candidate.weight;

  if (normalizedCandidate === normalizedWord) {
    score += 40;
  } else if (normalizedCandidate.startsWith(normalizedWord)) {
    score += 20;
  } else if (normalizedCandidate.includes(normalizedWord)) {
    score += 10;
  }

  return score;
}

function scoreClipMatchSingle(
  clip: SearchableClipRecord,
  query: string,
  match: (target: string) => boolean,
  tagI18n: Record<string, string>,
  mode: SearchMode
): number | null {
  const candidates = buildCandidates(clip, tagI18n, mode);

  let bestScore: number | null = null;
  for (const candidate of candidates) {
    const score = scoreCandidateForWord(candidate, query, match);
    if (score !== null) {
      bestScore = bestScore === null ? score : Math.max(bestScore, score);
    }
  }

  return bestScore;
}

function scoreClipMatchMulti(
  clip: SearchableClipRecord,
  words: string[],
  matchers: ((target: string) => boolean)[],
  tagI18n: Record<string, string>,
  mode: SearchMode
): number | null {
  const candidates = buildCandidates(clip, tagI18n, mode);
  let totalScore = 0;

  for (let i = 0; i < words.length; i++) {
    let bestScoreForWord: number | null = null;

    for (const candidate of candidates) {
      const score = scoreCandidateForWord(candidate, words[i], matchers[i]);
      if (score !== null) {
        bestScoreForWord = bestScoreForWord === null ? score : Math.max(bestScoreForWord, score);
      }
    }

    if (bestScoreForWord === null) {
      return null; // AND: 단어 하나라도 매칭 실패 → 제외
    }

    totalScore += bestScoreForWord;
  }

  return totalScore / words.length; // 평균 점수
}

export function getSearchTargetsForOverlay(
  clip: SearchableClipRecord,
  tagI18n: Record<string, string>
): string[] {
  return getClipSearchTargets(clip, tagI18n);
}
