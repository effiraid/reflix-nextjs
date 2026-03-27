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
    star: entry.star || 0,
    category: entry.category || "uncategorized",
  };
}

function getStructuredAiTags(aiTags) {
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
  const projection = entries.map((entry, index) => {
    const aiStructuredTags = getStructuredAiTags(entry.aiTags);

    return {
      ...summary[index],
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      aiStructuredTags,
      folders: Array.isArray(entry.folders) ? entry.folders : [],
      searchTokens: buildSearchTokens(entry, aiStructuredTags),
    };
  });

  return {
    summary,
    projection,
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
}
