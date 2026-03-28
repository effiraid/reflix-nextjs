import fs from "node:fs";
import path from "node:path";

import { writeAtomicJson } from "./release-approval-state.mjs";
import { loadItemState, saveItemState } from "./export-run-state.mjs";
import {
  buildClipIndex,
  buildFullClip,
  mergeClipIndexEntries,
} from "./index-builder.mjs";
import { buildBrowseArtifacts, getStructuredAiTags } from "./browse-artifacts.mjs";
import { buildRelatedInput } from "./similarity.mjs";

function loadOptionalJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function toClipJsonPath(projectRoot, clipId) {
  return path.join(projectRoot, "public", "data", "clips", `${clipId}.json`);
}

function ensureArtifactDirectories(projectRoot) {
  fs.mkdirSync(path.join(projectRoot, "public", "data", "clips"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "data", "browse"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "src", "data"), { recursive: true });
}

export async function runArtifactStage(items, { projectRoot, runId } = {}) {
  if (!projectRoot) {
    throw new Error("runArtifactStage requires a projectRoot");
  }

  if (!runId) {
    throw new Error("runArtifactStage requires a runId");
  }

  ensureArtifactDirectories(projectRoot);

  const clips = [];
  const indexEntries = [];

  for (const item of items) {
    const itemState = loadItemState({ projectRoot, runId, clipId: item.id });
    if (itemState?.media?.status !== "completed") {
      throw new Error(`media stage must be completed before artifact stage (${item.id})`);
    }

    const previousClip = loadOptionalJson(toClipJsonPath(projectRoot, item.id));
    const artifactMeta = {
      ...item,
      width: itemState.media.width,
      height: itemState.media.height,
    };

    const clipIndex = buildClipIndex(artifactMeta, itemState.media.lqipBase64);
    const fullClip = buildFullClip(artifactMeta, itemState.media.lqipBase64);
    const clipJsonPath = toClipJsonPath(projectRoot, item.id);

    writeAtomicJson(clipJsonPath, fullClip);

    saveItemState({
      projectRoot,
      runId,
      clipId: item.id,
      itemState: {
        ...itemState,
        artifacts: {
          status: "completed",
          clipJsonPath,
          relatedInput: {
            previous: previousClip ? buildRelatedInput(previousClip) : null,
            next: buildRelatedInput(fullClip),
          },
        },
        lastError: null,
      },
    });

    clips.push(fullClip);
    indexEntries.push(clipIndex);
  }

  const publicIndexPath = path.join(projectRoot, "public", "data", "index.json");
  const legacyIndexPath = path.join(projectRoot, "src", "data", "index.json");
  const existingIndex = loadOptionalJson(publicIndexPath) ?? loadOptionalJson(legacyIndexPath);
  const mergedEntries = mergeClipIndexEntries(existingIndex?.clips ?? [], indexEntries);
  const indexPayload = {
    clips: mergedEntries,
    totalCount: mergedEntries.length,
    generatedAt: new Date().toISOString(),
  };
  writeAtomicJson(publicIndexPath, indexPayload);
  // Keep legacy path in sync during transition
  writeAtomicJson(legacyIndexPath, indexPayload);

  const browseArtifacts = buildBrowseArtifacts(mergedEntries);
  writeAtomicJson(path.join(projectRoot, "public", "data", "browse", "summary.json"), browseArtifacts.summary);
  writeAtomicJson(path.join(projectRoot, "public", "data", "browse", "projection.json"), browseArtifacts.projection);
  writeAtomicJson(path.join(projectRoot, "public", "data", "browse", "cards.json"), browseArtifacts.cards);
  writeAtomicJson(path.join(projectRoot, "public", "data", "browse", "filter-index.json"), browseArtifacts.filterIndex);

  // Pre-compute landing stats
  const aiTagSet = new Set();
  for (const entry of mergedEntries) {
    const aiTags = entry.aiStructuredTags || getStructuredAiTags(entry.aiTags);
    for (const tag of aiTags) aiTagSet.add(tag);
  }
  writeAtomicJson(path.join(projectRoot, "public", "data", "landing-stats.json"), {
    totalClips: mergedEntries.length,
    aiRecommendationCount: aiTagSet.size,
    generatedAt: new Date().toISOString(),
  });

  return {
    writtenClips: clips.length,
    indexCount: mergedEntries.length,
  };
}
