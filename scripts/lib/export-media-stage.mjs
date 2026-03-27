import fs from "node:fs";
import path from "node:path";

import { mapWithConcurrency } from "./bounded-pool.mjs";
import {
  loadItemState,
  saveItemState,
  verifyOutputFile,
} from "./export-run-state.mjs";
import {
  generateLQIP,
  generatePreview,
  getVideoResolution,
  processThumbnail,
  processVideo,
} from "./media-processor.mjs";

export function resolveMediaOutputPaths(projectRoot, clipId) {
  return {
    video: path.join(projectRoot, "public", "videos", `${clipId}.mp4`),
    preview: path.join(projectRoot, "public", "previews", `${clipId}.mp4`),
    thumbnail: path.join(projectRoot, "public", "thumbnails", `${clipId}.webp`),
  };
}

function ensureMediaDirectories(projectRoot) {
  fs.mkdirSync(path.join(projectRoot, "public", "videos"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "previews"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "thumbnails"), { recursive: true });
}

function hasReusableMediaState(item, itemState) {
  const mediaState = itemState?.media;
  const snapshot = itemState?.sourceSnapshot;
  if (
    mediaState?.status !== "completed" ||
    !snapshot ||
    snapshot.eagleMtime !== item.mtime ||
    snapshot.mediaPath !== item._mediaPath ||
    snapshot.thumbnailPath !== item._thumbnailPath ||
    typeof mediaState.width !== "number" ||
    typeof mediaState.height !== "number" ||
    typeof mediaState.lqipBase64 !== "string"
  ) {
    return false;
  }

  return Boolean(
    verifyOutputFile(mediaState.outputs?.video?.path) &&
      verifyOutputFile(mediaState.outputs?.preview?.path) &&
      verifyOutputFile(mediaState.outputs?.thumbnail?.path)
  );
}

async function buildMediaOutputs(item, projectRoot, {
  getVideoResolutionImpl,
  generateLQIPImpl,
  processVideoImpl,
  generatePreviewImpl,
  processThumbnailImpl,
}) {
  const outputs = resolveMediaOutputPaths(projectRoot, item.id);
  const resolution = await getVideoResolutionImpl(item._mediaPath);
  const lqipBase64 = await generateLQIPImpl(item._mediaPath);

  if (!verifyOutputFile(outputs.video)) {
    await processVideoImpl(item._mediaPath, outputs.video);
  }

  if (!verifyOutputFile(outputs.preview)) {
    await generatePreviewImpl(outputs.video, outputs.preview);
  }

  if (!verifyOutputFile(outputs.thumbnail)) {
    await processThumbnailImpl(item._thumbnailPath, outputs.thumbnail);
  }

  const verifiedOutputs = {
    video: verifyOutputFile(outputs.video),
    preview: verifyOutputFile(outputs.preview),
    thumbnail: verifyOutputFile(outputs.thumbnail),
  };

  if (!verifiedOutputs.video || !verifiedOutputs.preview || !verifiedOutputs.thumbnail) {
    throw new Error("media outputs failed verification");
  }

  return {
    outputs: verifiedOutputs,
    width: resolution.width,
    height: resolution.height,
    lqipBase64,
  };
}

export async function runMediaStage(items, {
  projectRoot,
  runId,
  concurrency = 4,
  getVideoResolutionImpl = getVideoResolution,
  generateLQIPImpl = generateLQIP,
  processVideoImpl = processVideo,
  generatePreviewImpl = generatePreview,
  processThumbnailImpl = processThumbnail,
} = {}) {
  if (!projectRoot) {
    throw new Error("runMediaStage requires a projectRoot");
  }

  if (!runId) {
    throw new Error("runMediaStage requires a runId");
  }

  ensureMediaDirectories(projectRoot);

  const summary = {
    completed: 0,
    reused: 0,
    rebuilt: 0,
    failed: 0,
  };

  await mapWithConcurrency(
    items,
    async (item) => {
      const itemState = loadItemState({ projectRoot, runId, clipId: item.id });

      try {
        if (hasReusableMediaState(item, itemState)) {
          summary.completed += 1;
          summary.reused += 1;
          return;
        }

        const media = await buildMediaOutputs(item, projectRoot, {
          getVideoResolutionImpl,
          generateLQIPImpl,
          processVideoImpl,
          generatePreviewImpl,
          processThumbnailImpl,
        });

        saveItemState({
          projectRoot,
          runId,
          clipId: item.id,
          itemState: {
            ...(itemState ?? { id: item.id }),
            id: item.id,
            sourceSnapshot: {
              eagleMtime: item.mtime,
              mediaPath: item._mediaPath,
              thumbnailPath: item._thumbnailPath,
            },
            media: {
              status: "completed",
              width: media.width,
              height: media.height,
              lqipBase64: media.lqipBase64,
              outputs: media.outputs,
            },
            lastError: null,
          },
        });

        summary.completed += 1;
        summary.rebuilt += 1;
      } catch (error) {
        saveItemState({
          projectRoot,
          runId,
          clipId: item.id,
          itemState: {
            ...(itemState ?? { id: item.id }),
            id: item.id,
            sourceSnapshot: {
              eagleMtime: item.mtime,
              mediaPath: item._mediaPath,
              thumbnailPath: item._thumbnailPath,
            },
            lastError: error instanceof Error ? error.message : String(error),
          },
        });

        summary.failed += 1;
      }
    },
    { concurrency }
  );

  return summary;
}
