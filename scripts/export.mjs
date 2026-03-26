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
 *   node scripts/export.mjs --prune             # Remove stale local artifacts outside the batch
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

const DIRECT_RUN_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(DIRECT_RUN_PATH);
const DEFAULT_PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");

export { resolveEagleLibraryPath };

export function parseFlags(args) {
  const idsIdx = args.indexOf("--ids");
  const batchIdx = args.indexOf("--batch");
  const limitIdx = args.indexOf("--limit");
  const parsedLimit = limitIdx !== -1 && args[limitIdx + 1] ? Number.parseInt(args[limitIdx + 1], 10) : null;

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
  console.log(`\n📂 Eagle Library: ${eagleLibraryPath}`);
  console.log(`📁 Project Root: ${projectRoot}`);
  if (flags.local) {
    console.log("ℹ️  --local is retained for compatibility; local media generation is now the default.");
  }

  const requestedClipIds = resolveRequestedClipIds(flags, {
    projectRoot,
  });
  console.log(`🧾 Batch source: ${requestedClipIds.label}`);

  const categoriesPath = path.join(projectRoot, "src", "data", "categories.json");
  if (fs.existsSync(categoriesPath)) {
    loadCategoryMap(categoriesPath);
    console.log("✅ Category map loaded");
  } else {
    console.warn("⚠️  No categories.json found — all clips will be 'uncategorized'");
  }

  console.log("\n🔍 Reading Eagle library...");
  const items = readItems(flags, eagleLibraryPath, requestedClipIds.ids);
  console.log(`   Found ${items.length} items`);

  if (flags.dryRun) {
    logDryRunItems(items);
    const uploadSummary = flags.r2 ? await logDryRunUploads(items, projectRoot) : null;
    const pruneSummary = flags.prune
      ? await prunePublishedArtifacts({
          keepIds: items.map((item) => item.id),
          projectRoot,
          dryRun: true,
        })
      : null;
    if (pruneSummary) {
      console.log(`\n🧹 Planned stale local removals: ${pruneSummary.planned}`);
    }
    console.log(`\nTotal: ${items.length} items would be processed`);
    return {
      dryRun: true,
      items: items.length,
      uploadSummary,
      pruneSummary,
    };
  }

  const mediaRoot = path.join(projectRoot, "public");
  ensureMediaDirectories(mediaRoot);

  const clips = [];
  const clipIndexEntries = [];
  const clipIds = [];
  const generationSummary = {
    generated: 0,
    skipped: 0,
    failed: 0,
    videos: 0,
    previews: 0,
    thumbnails: 0,
  };
  let processed = 0;

  for (const item of items) {
    try {
      console.log(`\n[${processed + generationSummary.failed + 1}/${items.length}] ${item.id} — ${item.name}`);

      // Override Eagle's thumbnail resolution with actual video resolution
      const resolution = await getVideoResolution(item._mediaPath);
      item.width = resolution.width;
      item.height = resolution.height;

      console.log("  → Generating LQIP...");
      const lqipBase64 = await generateLQIP(item._mediaPath);

      await materializeClipAssets(item, mediaRoot, generationSummary);

      const clipIndex = buildClipIndex(item, lqipBase64);
      const fullClip = buildFullClip(item, lqipBase64);

      clipIndexEntries.push(clipIndex);
      clips.push(fullClip);
      clipIds.push(item.id);
      processed += 1;
    } catch (error) {
      console.error(`  ❌ FAILED: ${error.message}`);
      generationSummary.failed += 1;
    }
  }

  console.log("\n🔗 Computing related clips...");
  const relatedMap = computeRelatedClips(clips);
  for (const clip of clips) {
    clip.relatedClips = relatedMap.get(clip.id) || [];
  }

  console.log("\n💾 Writing output files...");
  writeOutputFiles(clips, clipIndexEntries, projectRoot);

  let pruneSummary = null;
  if (flags.prune) {
    if (generationSummary.failed > 0) {
      console.warn("\n⚠️  Skipping prune because some items failed during export.");
    } else {
      pruneSummary = await prunePublishedArtifacts({
        keepIds: clipIds,
        projectRoot,
      });
    }
  }

  let uploadSummary = null;
  if (flags.r2) {
    console.log("\n☁️ Uploading generated media to R2...");
    uploadSummary = await uploadBatch(buildMediaUploadEntries(clipIds, projectRoot), {
      env,
    });
  }

  console.log("\n✅ Export complete!");
  console.log(`   Processed items: ${processed}`);
  console.log(`   Item failures: ${generationSummary.failed}`);
  console.log(
    `   Generated files: ${generationSummary.generated} (${generationSummary.videos} videos, ${generationSummary.previews} previews, ${generationSummary.thumbnails} thumbnails)`
  );
  console.log(`   Local skipped: ${generationSummary.skipped}`);
  if (pruneSummary) {
    console.log(`   Stale local files removed: ${pruneSummary.removed}`);
  }
  if (uploadSummary) {
    console.log(`   Uploaded: ${uploadSummary.uploaded}`);
    console.log(`   Upload failed: ${uploadSummary.failed}`);
    console.log(`   Upload skipped: ${uploadSummary.skipped}`);
  }
  console.log(`   Index entries: ${clipIndexEntries.length}`);
  console.log(`   Clip JSONs: ${clips.length}`);

  return {
    processed,
    failed: generationSummary.failed,
    generationSummary,
    pruneSummary,
    uploadSummary,
  };
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
