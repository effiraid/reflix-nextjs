import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveEagleLibraryPath } from "./eagle-library-path.mjs";
import { readEagleLibrary } from "./eagle-reader.mjs";
import { writeMetadataWithBackup } from "./eagle-metadata.mjs";
import { DEFAULT_GEMINI_MODEL, generateAiTagsWithGemini } from "./ai-tagging.mjs";
import { mapWithConcurrency } from "./bounded-pool.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DEFAULT_CHECKPOINT_RELATIVE_PATH = "config/ai-tagging-progress.json";

export function parseFlags(args) {
  const idsIdx = args.indexOf("--ids");
  const limitIdx = args.indexOf("--limit");
  const modelIdx = args.indexOf("--model");
  const checkpointIdx = args.indexOf("--checkpoint");
  const concurrencyIdx = args.indexOf("--concurrency");
  const parsedLimit = limitIdx !== -1 && args[limitIdx + 1]
    ? Number.parseInt(args[limitIdx + 1], 10)
    : null;
  const parsedConcurrency = concurrencyIdx !== -1 && args[concurrencyIdx + 1]
    ? Number.parseInt(args[concurrencyIdx + 1], 10)
    : null;

  return {
    dryRun: args.includes("--dry-run"),
    retryNull: args.includes("--retry-null"),
    ids:
      idsIdx !== -1 && args[idsIdx + 1]
        ? args[idsIdx + 1]
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : null,
    limit: Number.isNaN(parsedLimit) ? null : parsedLimit,
    model: modelIdx !== -1 && args[modelIdx + 1]
      ? args[modelIdx + 1]
      : DEFAULT_GEMINI_MODEL,
    concurrency:
      Number.isNaN(parsedConcurrency) || parsedConcurrency === null
        ? 4
        : parsedConcurrency,
    checkpointPath:
      checkpointIdx !== -1 && args[checkpointIdx + 1]
        ? args[checkpointIdx + 1]
        : DEFAULT_CHECKPOINT_RELATIVE_PATH,
  };
}

export function createAiTagCheckpoint() {
  return {
    processedIds: [],
    succeededIds: [],
    failed: [],
  };
}

export function loadAiTagCheckpoint(checkpointPath) {
  if (!fs.existsSync(checkpointPath)) {
    return createAiTagCheckpoint();
  }

  const raw = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
  return {
    processedIds: Array.isArray(raw.processedIds) ? raw.processedIds : [],
    succeededIds: Array.isArray(raw.succeededIds) ? raw.succeededIds : [],
    failed: Array.isArray(raw.failed) ? raw.failed : [],
  };
}

export function saveAiTagCheckpoint(checkpointPath, checkpoint) {
  fs.mkdirSync(path.dirname(checkpointPath), { recursive: true });
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
}

export function shouldBackfillAiTags(item, { retryNull }) {
  if (!Object.prototype.hasOwnProperty.call(item, "aiTags")) {
    return true;
  }

  return Boolean(retryNull && item.aiTags === null);
}

export function selectAiBackfillItems(items, { retryNull, ids, limit }) {
  const idSet = ids?.length ? new Set(ids) : null;
  const filtered = items.filter((item) => {
    if (idSet && !idSet.has(item.id)) {
      return false;
    }

    return shouldBackfillAiTags(item, { retryNull });
  });

  if (typeof limit === "number" && limit >= 0) {
    return filtered.slice(0, limit);
  }

  return filtered;
}

function resolveAbsolutePath(projectRoot, targetPath) {
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.join(projectRoot, targetPath);
}

export function loadProjectEnv(projectRoot = PROJECT_ROOT, targetEnv = process.env) {
  const envPath = path.join(projectRoot, ".env.local");

  if (!fs.existsSync(envPath)) {
    return false;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1);

    if (key && !(key in targetEnv)) {
      targetEnv[key] = value;
    }
  }

  return true;
}

function createBackupDirectory(projectRoot) {
  return path.join(
    projectRoot,
    ".tmp",
    "ai-tagging-backups",
    new Date().toISOString().replaceAll(":", "-")
  );
}

export async function runAiTagBackfill(items, {
  projectRoot = PROJECT_ROOT,
  dryRun = false,
  retryNull = false,
  ids = null,
  limit = null,
  model = DEFAULT_GEMINI_MODEL,
  concurrency = 4,
  checkpointPath = DEFAULT_CHECKPOINT_RELATIVE_PATH,
  generateAiTags = generateAiTagsWithGemini,
  writeMetadata = writeMetadataWithBackup,
} = {}) {
  const absoluteCheckpointPath = resolveAbsolutePath(projectRoot, checkpointPath);
  const checkpoint = loadAiTagCheckpoint(absoluteCheckpointPath);
  const processedSet = new Set(checkpoint.processedIds);
  const selectedItems = selectAiBackfillItems(items, { retryNull, ids, limit });
  const pendingItems = selectedItems.filter((item) => !processedSet.has(item.id));
  const backupDir = createBackupDirectory(projectRoot);

  if (dryRun) {
    return {
      selectedIds: selectedItems.map((item) => item.id),
      processedIds: [],
      successCount: 0,
      failureCount: 0,
      skippedCount: selectedItems.length - pendingItems.length,
      checkpointPath: absoluteCheckpointPath,
      backupDir,
    };
  }

  let successCount = 0;
  let failureCount = 0;
  let checkpointWrite = Promise.resolve();
  const queueCheckpointWrite = (itemId, result) => {
    checkpointWrite = checkpointWrite.then(() => {
      checkpoint.processedIds.push(itemId);
      if (result.status === "fulfilled") {
        checkpoint.succeededIds.push(itemId);
      } else {
        checkpoint.failed.push({
          id: itemId,
          error: result.error,
        });
      }
      saveAiTagCheckpoint(absoluteCheckpointPath, checkpoint);
    });

    return checkpointWrite;
  };

  const results = await mapWithConcurrency(
    pendingItems,
    async (item) => {
      try {
        const aiTags = await generateAiTags(item, { model });
        writeMetadata(item, { aiTags }, backupDir);
        successCount += 1;

        const result = {
          id: item.id,
          status: "fulfilled",
        };
        await queueCheckpointWrite(item.id, result);
        return result;
      } catch (error) {
        writeMetadata(item, { aiTags: null }, backupDir);
        failureCount += 1;

        const result = {
          id: item.id,
          status: "rejected",
          error: error instanceof Error ? error.message : String(error),
        };
        await queueCheckpointWrite(item.id, result);
        return result;
      }
    },
    { concurrency }
  );

  await checkpointWrite;

  return {
    selectedIds: selectedItems.map((item) => item.id),
    processedIds: results.map((item) => item.id),
    successCount,
    failureCount,
    skippedCount: selectedItems.length - pendingItems.length,
    checkpointPath: absoluteCheckpointPath,
    backupDir,
  };
}

export async function main(argv = process.argv.slice(2)) {
  loadProjectEnv();
  const flags = parseFlags(argv);
  const libraryPath = resolveEagleLibraryPath();
  const items = readEagleLibrary(libraryPath, {
    ids: flags.ids,
  });

  const summary = await runAiTagBackfill(items, flags);

  console.log(`AI tag backfill candidates: ${summary.selectedIds.length}`);
  console.log(`Processed: ${summary.processedIds.length}`);
  console.log(`Succeeded: ${summary.successCount}`);
  console.log(`Failed: ${summary.failureCount}`);
  console.log(`Skipped (checkpoint): ${summary.skippedCount}`);
  console.log(`Checkpoint: ${summary.checkpointPath}`);
  if (!flags.dryRun) {
    console.log(`Backups: ${summary.backupDir}`);
  }

  return summary;
}
