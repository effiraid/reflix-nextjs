import fs from "node:fs";
import path from "node:path";

function toSummaryRecord(entry) {
  return {
    id: entry.id,
    name: entry.name,
    thumbnailUrl: entry.thumbnailUrl,
    previewUrl: entry.previewUrl,
    lqipBase64: entry.lqipBase64 || "",
    width: entry.width || 640,
    height: entry.height || 360,
    duration: entry.duration || 0,
    category: entry.category || "uncategorized",
    tags: Array.isArray(entry.tags) ? entry.tags : [],
  };
}

export function getStructuredAiTags(aiTags) {
  if (!aiTags) {
    return [];
  }

  const values = [
    ...(Array.isArray(aiTags.actionType) ? aiTags.actionType : []),
    ...(Array.isArray(aiTags.emotion) ? aiTags.emotion : []),
    ...(Array.isArray(aiTags.composition) ? aiTags.composition : []),
    aiTags.pacing,
    ...(Array.isArray(aiTags.characterType) ? aiTags.characterType : []),
    ...(Array.isArray(aiTags.effects) ? aiTags.effects : []),
  ];

  return Array.from(
    new Set(
      values.filter(
        (value) => typeof value === "string" && value.trim().length > 0
      )
    )
  );
}

function tokenizeText(value) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .toLowerCase()
    .match(/[\p{Script=Hangul}\p{L}\p{N}]+/gu)
    ?.filter(Boolean) ?? [];
}

function buildSearchTokens(entry, aiStructuredTags) {
  const manualTags = Array.isArray(entry.tags) ? entry.tags : [];
  const descriptions = entry.aiTags
    ? [entry.aiTags.description?.ko, entry.aiTags.description?.en]
    : [];

  const seen = new Set();
  const tokens = [];
  for (const value of [
    entry.name,
    ...manualTags,
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

export function buildBrowseArtifacts(entries) {
  const summary = entries.map((entry) => toSummaryRecord(entry));

  // cards = summary fields for card rendering (lightweight)
  const cards = entries.map((entry, index) => ({
    ...summary[index],
    previewUrl: entry.previewUrl || "",
  }));

  // filterIndex = tag/folder/AI tag mapping for client-side filtering
  const filterIndex = entries.map((entry) => {
    const tags = Array.isArray(entry.tags) ? entry.tags : [];
    const aiStructuredTags = getStructuredAiTags(entry.aiTags);
    const folders = Array.isArray(entry.folders) ? entry.folders : [];
    return {
      id: entry.id,
      name: entry.name,
      category: entry.category || "uncategorized",
      tags,
      aiStructuredTags,
      folders,
      searchTokens: buildSearchTokens(entry, aiStructuredTags),
    };
  });

  // Keep projection for backward compatibility during transition
  const projection = entries.map((entry, index) => {
    const aiStructuredTags = filterIndex[index].aiStructuredTags;

    return {
      ...cards[index],
      tags: filterIndex[index].tags,
      aiStructuredTags,
      folders: filterIndex[index].folders,
      searchTokens: buildSearchTokens(entry, aiStructuredTags),
    };
  });

  return {
    summary,
    projection,
    cards,
    filterIndex,
  };
}

export function writeBrowseArtifacts(artifacts, outputDir) {
  const browseDir = path.join(outputDir, "public", "data", "browse");
  fs.mkdirSync(browseDir, { recursive: true });
  fs.writeFileSync(
    path.join(browseDir, "summary.json"),
    JSON.stringify(artifacts.summary, null, 2)
  );
  fs.writeFileSync(
    path.join(browseDir, "projection.json"),
    JSON.stringify(artifacts.projection, null, 2)
  );
  if (artifacts.cards) {
    fs.writeFileSync(
      path.join(browseDir, "cards.json"),
      JSON.stringify(artifacts.cards, null, 2)
    );
  }
  if (artifacts.filterIndex) {
    fs.writeFileSync(
      path.join(browseDir, "filter-index.json"),
      JSON.stringify(artifacts.filterIndex, null, 2)
    );
  }
}
