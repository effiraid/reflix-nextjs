import fs from "node:fs";
import path from "node:path";

import { writeAtomicJson } from "./release-approval-state.mjs";
import { loadItemState, saveItemState } from "./export-run-state.mjs";
import {
  computeRelatedClips,
  computeRelatedClipsForSubset,
} from "./similarity.mjs";

function loadAllClips(projectRoot) {
  const indexPath = path.join(projectRoot, "src", "data", "index.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

  return index.clips.map((entry) =>
    JSON.parse(
      fs.readFileSync(
        path.join(projectRoot, "public", "data", "clips", `${entry.id}.json`),
        "utf-8"
      )
    )
  );
}

function toNormalizedInput(input) {
  if (!input) {
    return null;
  }

  return {
    tags: Array.isArray(input.tags) ? input.tags : [],
    folders: Array.isArray(input.folders) ? input.folders : [],
    category: String(input.category ?? "uncategorized"),
  };
}

export function collectImpactedClipIds({ allClips, changedItems }) {
  const impacted = new Set();
  const tagIndex = new Map();
  const folderIndex = new Map();

  for (const clip of allClips) {
    for (const tag of clip.tags || []) {
      if (!tagIndex.has(tag)) tagIndex.set(tag, new Set());
      tagIndex.get(tag).add(clip.id);
    }
    for (const folder of clip.folders || []) {
      if (!folderIndex.has(folder)) folderIndex.set(folder, new Set());
      folderIndex.get(folder).add(clip.id);
    }
  }

  for (const item of changedItems) {
    impacted.add(item.id);

    const tags = new Set([
      ...(item.previous?.tags || []),
      ...(item.next?.tags || []),
    ]);
    const folders = new Set([
      ...(item.previous?.folders || []),
      ...(item.next?.folders || []),
    ]);

    for (const tag of tags) {
      for (const clipId of tagIndex.get(tag) || []) {
        impacted.add(clipId);
      }
    }

    for (const folder of folders) {
      for (const clipId of folderIndex.get(folder) || []) {
        impacted.add(clipId);
      }
    }
  }

  return impacted;
}

export async function runRelatedStage(items, {
  projectRoot,
  runId,
  forceFullRebuild = false,
} = {}) {
  if (!projectRoot) {
    throw new Error("runRelatedStage requires a projectRoot");
  }

  if (!runId) {
    throw new Error("runRelatedStage requires a runId");
  }

  const allClips = loadAllClips(projectRoot);
  let mode = forceFullRebuild ? "full" : "partial";
  const changedItems = [];

  for (const item of items) {
    const itemState = loadItemState({ projectRoot, runId, clipId: item.id });
    const previous = toNormalizedInput(itemState?.artifacts?.relatedInput?.previous);
    const next = toNormalizedInput(itemState?.artifacts?.relatedInput?.next);

    if (!previous && !next) {
      mode = "full";
      continue;
    }

    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      changedItems.push({
        id: item.id,
        previous,
        next,
      });
    }
  }

  const impactedIds =
    mode === "full"
      ? new Set(allClips.map((clip) => clip.id))
      : collectImpactedClipIds({ allClips, changedItems });

  const relatedMap =
    mode === "full"
      ? computeRelatedClips(allClips)
      : computeRelatedClipsForSubset(allClips, impactedIds);

  let rewrittenCount = 0;
  for (const clip of allClips) {
    if (!impactedIds.has(clip.id)) {
      continue;
    }

    clip.relatedClips = relatedMap.get(clip.id) || [];
    writeAtomicJson(
      path.join(projectRoot, "public", "data", "clips", `${clip.id}.json`),
      clip
    );
    rewrittenCount += 1;
  }

  for (const item of items) {
    const itemState = loadItemState({ projectRoot, runId, clipId: item.id }) || {
      id: item.id,
    };
    saveItemState({
      projectRoot,
      runId,
      clipId: item.id,
      itemState: {
        ...itemState,
        related: {
          status: "completed",
          mode,
        },
        lastError: null,
      },
    });
  }

  return {
    mode,
    rewrittenCount,
    impactedClipIds: [...impactedIds],
  };
}
