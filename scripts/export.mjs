#!/usr/bin/env node

/**
 * Eagle → Reflix Export Pipeline
 *
 * Usage:
 *   node scripts/export.mjs                     # Active release batch (default)
 *   node scripts/export.mjs --batch path.json   # Explicit release batch
 *   node scripts/export.mjs --full --confirm-full-export
 *   node scripts/export.mjs --dry-run           # Preview export changes
 *   node scripts/export.mjs --dry-run --r2      # Preview planned R2 uploads
 *   node scripts/export.mjs --prune             # Remove stale local artifacts outside the merged index
 *   node scripts/export.mjs --ids ID1,ID2       # Specific items
 *   node scripts/export.mjs --limit 5           # First N items
 *   node scripts/export.mjs --local             # Legacy alias; local generation is now default
 *   node scripts/export.mjs --local --r2        # Generate locally, then upload to R2
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveEagleLibraryPath } from "./lib/eagle-library-path.mjs";
import { readEagleLibrary } from "./lib/eagle-reader.mjs";
import { prunePublishedArtifacts } from "./lib/published-artifacts.mjs";
import { loadReleaseBatch, resolveReleaseBatchPath } from "./lib/release-batch.mjs";
import { generateLQIP, generatePreview, processThumbnail, processVideo, getVideoResolution } from "./lib/media-processor.mjs";
import { loadCategoryMap, buildClipIndex, buildFullClip, writeOutputFiles } from "./lib/index-builder.mjs";
import { uploadBatch } from "./lib/r2-uploader.mjs";
import { computeRelatedClips } from "./lib/similarity.mjs";
import { buildBrowseArtifacts, writeBrowseArtifacts } from "./lib/browse-artifacts.mjs";
import { runExportPipeline } from "./lib/export-pipeline.mjs";

const DIRECT_RUN_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(DIRECT_RUN_PATH);
const DEFAULT_PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");

export { resolveEagleLibraryPath };

export function parseFlags(args) {
  const idsIdx = args.indexOf("--ids");
  const batchIdx = args.indexOf("--batch");
  const limitIdx = args.indexOf("--limit");
  const mediaConcurrencyIdx = args.indexOf("--media-concurrency");
  const uploadConcurrencyIdx = args.indexOf("--upload-concurrency");
  const resumeRunIdx = args.indexOf("--resume-run");
  const parsedLimit = limitIdx !== -1 && args[limitIdx + 1] ? Number.parseInt(args[limitIdx + 1], 10) : null;
  const parsedMediaConcurrency =
    mediaConcurrencyIdx !== -1 && args[mediaConcurrencyIdx + 1]
      ? Number.parseInt(args[mediaConcurrencyIdx + 1], 10)
      : null;
  const parsedUploadConcurrency =
    uploadConcurrencyIdx !== -1 && args[uploadConcurrencyIdx + 1]
      ? Number.parseInt(args[uploadConcurrencyIdx + 1], 10)
      : null;

  return {
    full: args.includes("--full"),
    confirmFullExport: args.includes("--confirm-full-export"),
    dryRun: args.includes("--dry-run"),
    prune: args.includes("--prune"),
    local: args.includes("--local"),
    r2: args.includes("--r2"),
    batchPath: batchIdx !== -1 && args[batchIdx + 1] ? args[batchIdx + 1] : null,
    ids:
      idsIdx !== -1 && args[idsIdx + 1]
        ? args[idsIdx + 1]
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : null,
    limit: Number.isNaN(parsedLimit) ? null : parsedLimit,
    mediaConcurrency: Number.isNaN(parsedMediaConcurrency) || parsedMediaConcurrency === null ? 4 : parsedMediaConcurrency,
    uploadConcurrency:
      Number.isNaN(parsedUploadConcurrency) || parsedUploadConcurrency === null ? 6 : parsedUploadConcurrency,
    freshRun: args.includes("--fresh-run"),
    resumeRun: resumeRunIdx !== -1 && args[resumeRunIdx + 1] ? args[resumeRunIdx + 1] : null,
    forceRelatedFullRebuild: args.includes("--force-related-full-rebuild"),
  };
}

export function buildMediaUploadEntries(clipIds, projectRoot) {
  const mediaRoot = path.join(projectRoot, "public");

  return clipIds.flatMap((clipId) => [
    {
      localPath: path.join(mediaRoot, "videos", `${clipId}.mp4`),
      publicPath: `/videos/${clipId}.mp4`,
    },
    {
      localPath: path.join(mediaRoot, "previews", `${clipId}.mp4`),
      publicPath: `/previews/${clipId}.mp4`,
    },
    {
      localPath: path.join(mediaRoot, "thumbnails", `${clipId}.webp`),
      publicPath: `/thumbnails/${clipId}.webp`,
    },
  ]);
}

export function buildMergedKeepIds(existingIndex, batchItems) {
  const existingIds = (existingIndex?.clips || []).map((clip) => clip.id);
  const batchIds = batchItems.map((item) => item.id);
  return [...new Set([...existingIds, ...batchIds])];
}

export function recomputePublishedRelatedClips(
  indexEntries,
  projectRoot,
  { warn = console.warn } = {}
) {
  const allClips = [];

  for (const entry of indexEntries) {
    const clipPath = path.join(projectRoot, "public", "data", "clips", `${entry.id}.json`);
    if (!fs.existsSync(clipPath)) {
      warn(`  ⚠️ Missing clip JSON for ${entry.id}, skipping related computation`);
      continue;
    }

    allClips.push(JSON.parse(fs.readFileSync(clipPath, "utf-8")));
  }

  const relatedMap = computeRelatedClips(allClips);
  for (const clip of allClips) {
    clip.relatedClips = relatedMap.get(clip.id) || [];
    const clipPath = path.join(projectRoot, "public", "data", "clips", `${clip.id}.json`);
    fs.writeFileSync(clipPath, JSON.stringify(clip, null, 2));
  }

  return allClips;
}

function ensureMediaDirectories(mediaRoot) {
  fs.mkdirSync(path.join(mediaRoot, "videos"), { recursive: true });
  fs.mkdirSync(path.join(mediaRoot, "previews"), { recursive: true });
  fs.mkdirSync(path.join(mediaRoot, "thumbnails"), { recursive: true });
}

function readItems(flags, eagleLibraryPath, requestedIds = null) {
  return readEagleLibrary(eagleLibraryPath, {
    ids: requestedIds,
    limit: flags.limit,
  });
}

export function resolveRequestedClipIds(
  flags,
  { projectRoot = DEFAULT_PROJECT_ROOT, loadBatch = loadReleaseBatch } = {}
) {
  if (flags.ids?.length) {
    return {
      ids: flags.ids,
      source: "ids",
      label: `--ids override (${flags.ids.length} ids)`,
      batchName: null,
      batchPath: null,
    };
  }

  if (flags.full) {
    if (!flags.confirmFullExport) {
      throw new Error("Full export requires --confirm-full-export");
    }

    return {
      ids: null,
      source: "full",
      label: "full library",
      batchName: null,
      batchPath: null,
    };
  }

  const explicitBatchPath = flags.batchPath?.trim() || null;
  const configuredBatchPath =
    explicitBatchPath || resolveReleaseBatchPath({ projectRoot });
  const batch = loadBatch(configuredBatchPath);
  const displayBatchPath = explicitBatchPath || "config/release-batch.json";

  return {
    ids: batch.ids,
    source: "batch",
    label: `${displayBatchPath} (${batch.ids.length} ids)`,
    batchName: batch.name,
    batchPath: batch.path,
  };
}

function logDryRunItems(items) {
  console.log("\n🏃 DRY RUN — no files will be written\n");
  for (const item of items) {
    console.log(
      `  ${item.id} | ${item.name} | ${item.ext} | ${item.star}★ | ${item.tags.slice(0, 3).join(", ")}`
    );
  }
}

async function logDryRunUploads(items, projectRoot) {
  const uploadSummary = await uploadBatch(buildMediaUploadEntries(items.map((item) => item.id), projectRoot), {
    dryRun: true,
  });

  if (uploadSummary.total === 0) {
    console.log("\n☁️ No R2 uploads planned");
    return uploadSummary;
  }

  console.log("\n☁️ Planned R2 uploads");
  for (const entry of uploadSummary.entries.slice(0, 9)) {
    console.log(`  ${entry.key} (${entry.contentType})`);
  }
  if (uploadSummary.entries.length > 9) {
    console.log(`  ... ${uploadSummary.entries.length - 9} more`);
  }
  console.log(`   Planned uploads: ${uploadSummary.total}`);

  return uploadSummary;
}

function countGeneratedAsset(summary, assetType) {
  summary.generated += 1;
  summary[assetType] += 1;
}

async function materializeClipAssets(item, mediaRoot, generationSummary) {
  if (!item._mediaPath || !fs.existsSync(item._mediaPath)) {
    throw new Error("Missing source media file");
  }

  if (!item._thumbnailPath || !fs.existsSync(item._thumbnailPath)) {
    throw new Error("Missing source thumbnail file");
  }

  const videoOut = path.join(mediaRoot, "videos", `${item.id}.mp4`);
  const previewOut = path.join(mediaRoot, "previews", `${item.id}.mp4`);
  const thumbOut = path.join(mediaRoot, "thumbnails", `${item.id}.webp`);

  if (!fs.existsSync(videoOut)) {
    console.log("  → Processing video...");
    await processVideo(item._mediaPath, videoOut);
    countGeneratedAsset(generationSummary, "videos");
  } else {
    console.log("  → Video exists, skipping");
    generationSummary.skipped += 1;
  }

  if (!fs.existsSync(previewOut)) {
    console.log("  → Generating MP4 preview...");
    const previewSource = fs.existsSync(videoOut) ? videoOut : item._mediaPath;
    await generatePreview(previewSource, previewOut);
    countGeneratedAsset(generationSummary, "previews");
  } else {
    console.log("  → Preview exists, skipping");
    generationSummary.skipped += 1;
  }

  if (!fs.existsSync(thumbOut)) {
    console.log("  → Converting thumbnail to static WebP...");
    await processThumbnail(item._thumbnailPath, thumbOut);
    countGeneratedAsset(generationSummary, "thumbnails");
  } else {
    console.log("  → Thumbnail exists, skipping");
    generationSummary.skipped += 1;
  }

  for (const requiredOutput of [videoOut, previewOut, thumbOut]) {
    if (!fs.existsSync(requiredOutput)) {
      throw new Error(`Missing generated output: ${path.basename(requiredOutput)}`);
    }
    const stat = fs.statSync(requiredOutput);
    if (stat.size === 0) {
      fs.unlinkSync(requiredOutput);
      throw new Error(`Generated output is 0 bytes: ${path.basename(requiredOutput)}`);
    }
  }
}

export async function runExport(
  flags,
  {
    env = process.env,
    projectRoot = DEFAULT_PROJECT_ROOT,
    eagleLibraryPath = resolveEagleLibraryPath({ env }),
  } = {}
) {
  return runExportPipeline(flags, {
    env,
    projectRoot,
    eagleLibraryPath,
  });
}

async function main() {
  const result = await runExport(parseFlags(process.argv.slice(2)));
  if (result.failed > 0 || result.uploadSummary?.failed > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === DIRECT_RUN_PATH) {
  main().catch((error) => {
    console.error(`\n❌ Export failed: ${error.message}`);
    process.exitCode = 1;
  });
}
