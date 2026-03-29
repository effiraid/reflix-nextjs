import type {
  AIGeneratedTags,
  BrowseClipRecord,
  BrowseFilterIndexRecord,
  BrowseProjectionRecord,
  BrowseSummaryRecord,
  ClipIndex,
} from "./types";
import { getStructuredAiTags } from "./aiTags";

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );
}

function tokenizeText(value: string): string[] {
  return value
    .toLowerCase()
    .match(/[\p{Script=Hangul}\p{L}\p{N}]+/gu)
    ?.filter(Boolean) ?? [];
}

function buildSearchTokens(record: {
  name: string;
  tags?: string[];
  aiTags?: AIGeneratedTags | null;
  aiStructuredTags?: string[];
}): string[] {
  const aiStructuredTags =
    record.aiStructuredTags ?? getStructuredAiTags(record.aiTags);
  const descriptions = record.aiTags
    ? [record.aiTags.description.ko, record.aiTags.description.en]
    : [];
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const value of [
    record.name,
    ...(record.tags ?? []),
    ...aiStructuredTags,
    ...descriptions,
  ]) {
    for (const token of tokenizeText(value)) {
      if (seen.has(token)) {
        continue;
      }

      seen.add(token);
      tokens.push(token);
    }
  }

  return tokens;
}

export function toBrowseSummaryRecord(
  record: BrowseSummaryRecord
): BrowseSummaryRecord {
  return {
    id: record.id,
    name: record.name,
    thumbnailUrl: record.thumbnailUrl,
    previewUrl: record.previewUrl,
    lqipBase64: record.lqipBase64,
    width: record.width,
    height: record.height,
    duration: record.duration,
    category: record.category,
    tags: normalizeStringList(record.tags),
  };
}

function toBrowseCardRecord(record: BrowseSummaryRecord): BrowseSummaryRecord {
  return {
    ...toBrowseSummaryRecord(record),
    // Cards render fine without inline LQIP; trimming it keeps the initial
    // browse payload and the lazy cards API lighter.
    lqipBase64: "",
  };
}

export function normalizeBrowseProjectionRecord(
  record: BrowseSummaryRecord &
    Partial<Pick<BrowseProjectionRecord, "tags" | "aiStructuredTags" | "folders" | "searchTokens">>
): BrowseProjectionRecord {
  return {
    ...toBrowseSummaryRecord(record),
    tags: normalizeStringList(record.tags),
    aiStructuredTags: normalizeStringList(record.aiStructuredTags),
    folders: normalizeStringList(record.folders),
    searchTokens: normalizeStringList(record.searchTokens),
  };
}

export function normalizeBrowseFilterIndexRecord(
  record: Partial<BrowseFilterIndexRecord> &
    Pick<BrowseFilterIndexRecord, "id" | "name" | "category">
): BrowseFilterIndexRecord {
  return {
    id: record.id,
    name: record.name,
    category: record.category,
    tags: normalizeStringList(record.tags),
    aiStructuredTags: normalizeStringList(record.aiStructuredTags),
    folders: normalizeStringList(record.folders),
    searchTokens: normalizeStringList(record.searchTokens),
  };
}

export function buildBrowseArtifactsFromClipIndex(
  clips: ClipIndex[]
): {
  summary: BrowseSummaryRecord[];
  projection: BrowseProjectionRecord[];
  cards: BrowseSummaryRecord[];
  filterIndex: BrowseFilterIndexRecord[];
} {
  const summary = clips.map((clip) => toBrowseSummaryRecord(clip));
  const projection = clips.map((clip): BrowseProjectionRecord =>
    normalizeBrowseProjectionRecord({
      ...toBrowseSummaryRecord(clip),
      tags: clip.tags ?? [],
      aiStructuredTags:
        clip.aiStructuredTags ?? getStructuredAiTags(clip.aiTags),
      folders: clip.folders ?? [],
      searchTokens: clip.searchTokens ?? buildSearchTokens(clip),
    })
  );
  const cards = clips.map((clip) => toBrowseCardRecord(clip));
  const filterIndex = clips.map((clip): BrowseFilterIndexRecord =>
    normalizeBrowseFilterIndexRecord({
      id: clip.id,
      name: clip.name,
      category: clip.category,
      tags: clip.tags ?? [],
      aiStructuredTags:
        clip.aiStructuredTags ?? getStructuredAiTags(clip.aiTags),
      folders: clip.folders ?? [],
      searchTokens: clip.searchTokens ?? buildSearchTokens(clip),
    })
  );

  return {
    summary,
    projection,
    cards,
    filterIndex,
  };
}
