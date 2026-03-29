function collectStrings(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStrings(item));
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();
  return trimmed ? [trimmed] : [];
}

function uniqueStrings(values) {
  return Array.from(new Set(values));
}

function translateTerms(terms, tagI18n) {
  return terms.map((term) => tagI18n[term] ?? term);
}

function getStructuredAiTags(aiTags) {
  if (!aiTags || typeof aiTags !== "object") {
    return [];
  }

  return uniqueStrings([
    ...collectStrings(aiTags.actionType),
    ...collectStrings(aiTags.emotion),
    ...collectStrings(aiTags.composition),
    ...collectStrings(aiTags.pacing),
    ...collectStrings(aiTags.characterType),
    ...collectStrings(aiTags.effects),
  ]);
}

function buildSearchContent(values) {
  return uniqueStrings(values.flatMap((value) => collectStrings(value))).join("\n");
}

function buildPagefindRecord(entry, language, tags, tagI18n) {
  const structuredTags = getStructuredAiTags(entry.aiTags);
  const translatedTags = language === "en" ? translateTerms(tags, tagI18n) : tags;
  const translatedStructuredTags =
    language === "en" ? translateTerms(structuredTags, tagI18n) : structuredTags;
  const searchTokens = collectStrings(entry.searchTokens);

  return {
    url: `/${language}/clip/${entry.id}`,
    language,
    content: buildSearchContent([
      entry.name,
      translatedTags,
      translatedStructuredTags,
      searchTokens,
    ]),
    meta: {
      clipId: entry.id,
      name: entry.name,
    },
    filters: {
      category: [entry.category ?? "uncategorized"],
      folders: collectStrings(entry.folders),
      tags: translatedTags,
    },
  };
}

export function buildPagefindRecords(indexEntries, tagI18n = {}) {
  const records = [];

  for (const entry of indexEntries ?? []) {
    const tags = collectStrings(entry.tags);
    records.push(buildPagefindRecord(entry, "ko", tags, tagI18n));
    records.push(buildPagefindRecord(entry, "en", tags, tagI18n));
  }

  return records;
}

