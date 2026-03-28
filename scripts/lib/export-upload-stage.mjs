import path from "node:path";

import { mapWithConcurrency } from "./bounded-pool.mjs";
import {
  loadItemState,
  saveItemState,
  verifyOutputFile,
} from "./export-run-state.mjs";
import {
  checkR2ObjectExists,
  createR2ClientFromEnv,
  getContentTypeForKey,
  toR2ObjectKey,
  uploadFile,
} from "./r2-uploader.mjs";

function buildUploadEntries(clipIds, projectRoot) {
  return clipIds.flatMap((clipId) => [
    {
      clipId,
      localPath: path.join(projectRoot, "public", "videos", `${clipId}.mp4`),
      publicPath: `/videos/${clipId}.mp4`,
    },
    {
      clipId,
      localPath: path.join(projectRoot, "public", "previews", `${clipId}.mp4`),
      publicPath: `/previews/${clipId}.mp4`,
    },
    {
      clipId,
      localPath: path.join(projectRoot, "public", "thumbnails", `${clipId}.webp`),
      publicPath: `/thumbnails/${clipId}.webp`,
    },
  ]);
}

function findExistingEntry(itemState, key) {
  return itemState?.upload?.entries?.find((entry) => entry.key === key) ?? null;
}

function canReuseEntry(itemState, key, localPath) {
  const existingEntry = findExistingEntry(itemState, key);
  if (!existingEntry) {
    return false;
  }

  if (!["uploaded", "skipped"].includes(existingEntry.status)) {
    return false;
  }

  return Boolean(verifyOutputFile(localPath));
}

function mergeUploadEntries(previousEntries, nextEntries) {
  const merged = new Map((previousEntries || []).map((entry) => [entry.key, entry]));
  for (const entry of nextEntries) {
    merged.set(entry.key, entry);
  }
  return Array.from(merged.values());
}

async function uploadWithRetries(entry, {
  env,
  client,
  bucketName,
}) {
  let lastError = null;
  const key = toR2ObjectKey(entry.publicPath);
  const contentType = getContentTypeForKey(key);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const uploaded = await uploadFile(
        {
          localPath: entry.localPath,
          key,
          contentType,
        },
        {
          env,
          client,
          bucketName,
        }
      );
      return {
        clipId: entry.clipId,
        ...uploaded,
      };
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        const delay = 1000 * 2 ** attempt;
        console.warn(
          `  ⚠️ Upload failed (attempt ${attempt + 1}/3): ${key} — retrying in ${delay / 1000}s`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return {
    clipId: entry.clipId,
    key,
    localPath: entry.localPath,
    contentType,
    dryRun: false,
    status: "failed",
    error: lastError instanceof Error ? lastError.message : String(lastError),
  };
}

export async function runUploadStage(clipIds, {
  projectRoot,
  runId,
  env = process.env,
  client = null,
  concurrency = 4,
  skipExisting = true,
} = {}) {
  if (!projectRoot) {
    throw new Error("runUploadStage requires a projectRoot");
  }

  if (!runId) {
    throw new Error("runUploadStage requires a runId");
  }

  const resolvedClient = client ?? createR2ClientFromEnv(env);
  const bucketName = env.R2_BUCKET_NAME;
  const entries = buildUploadEntries(clipIds, projectRoot);
  const itemStates = new Map(
    clipIds.map((clipId) => [clipId, loadItemState({ projectRoot, runId, clipId }) || { id: clipId }])
  );
  const summary = {
    uploaded: 0,
    failed: 0,
    skipped: 0,
    reused: 0,
  };

  const results = await mapWithConcurrency(
    entries,
    async (entry) => {
      const key = toR2ObjectKey(entry.publicPath);
      const itemState = itemStates.get(entry.clipId);

      if (canReuseEntry(itemState, key, entry.localPath)) {
        summary.reused += 1;
        return findExistingEntry(itemState, key);
      }

      const contentType = getContentTypeForKey(key);
      if (skipExisting) {
        try {
          if (await checkR2ObjectExists(resolvedClient, bucketName, key)) {
            summary.skipped += 1;
            return {
              clipId: entry.clipId,
              key,
              localPath: entry.localPath,
              contentType,
              dryRun: false,
              status: "skipped",
            };
          }
        } catch (error) {
          console.warn(`  ⚠️ HeadObject check failed for ${key}, proceeding to upload: ${error.message}`);
        }
      }

      const uploadedEntry = await uploadWithRetries(entry, {
        env,
        client: resolvedClient,
        bucketName,
      });

      if (uploadedEntry.status === "uploaded") {
        summary.uploaded += 1;
      } else if (uploadedEntry.status === "failed") {
        summary.failed += 1;
      }

      return uploadedEntry;
    },
    { concurrency }
  );

  const resultsByClipId = new Map();
  for (const entry of results) {
    const arr = resultsByClipId.get(entry.clipId) || [];
    arr.push(entry);
    resultsByClipId.set(entry.clipId, arr);
  }

  for (const clipId of clipIds) {
    const itemState = itemStates.get(clipId) || { id: clipId };
    const clipEntries = resultsByClipId.get(clipId) || [];
    const mergedEntries = mergeUploadEntries(itemState.upload?.entries, clipEntries);

    saveItemState({
      projectRoot,
      runId,
      clipId,
      itemState: {
        ...itemState,
        upload: {
          status: mergedEntries.some((entry) => entry.status === "failed")
            ? "failed"
            : "completed",
          entries: mergedEntries,
        },
        lastError: mergedEntries.find((entry) => entry.status === "failed")?.error ?? null,
      },
    });
  }

  return summary;
}
