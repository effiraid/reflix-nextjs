#!/usr/bin/env node

/**
 * Eagle → Reflix Export Pipeline
 *
 * Usage:
 *   node scripts/export.mjs --full          # Full export
 *   node scripts/export.mjs                 # Incremental (default)
 *   node scripts/export.mjs --dry-run       # Preview changes
 *   node scripts/export.mjs --ids ID1,ID2   # Specific items
 *   node scripts/export.mjs --limit 5       # First N items
 *   node scripts/export.mjs --local         # Skip R2, copy media to public/
 */

import fs from "fs";
import path from "path";
import { readEagleLibrary } from "./lib/eagle-reader.mjs";
import { generateLQIP, generatePreview, processThumbnail, processVideo } from "./lib/media-processor.mjs";
import {
  loadCategoryMap,
  buildClipIndex,
  buildFullClip,
  writeOutputFiles,
} from "./lib/index-builder.mjs";
import { computeRelatedClips } from "./lib/similarity.mjs";

// Parse CLI args
const args = process.argv.slice(2);
const flags = {
  full: args.includes("--full"),
  dryRun: args.includes("--dry-run"),
  local: args.includes("--local"),
  ids: null,
  limit: null,
};

const idsIdx = args.indexOf("--ids");
if (idsIdx !== -1 && args[idsIdx + 1]) {
  flags.ids = args[idsIdx + 1].split(",");
}
const limitIdx = args.indexOf("--limit");
if (limitIdx !== -1 && args[limitIdx + 1]) {
  flags.limit = parseInt(args[limitIdx + 1]);
}

// Config
const EAGLE_LIB =
  process.env.EAGLE_LIBRARY_PATH ||
  "/Users/macbook/Library/CloudStorage/Dropbox/!/레퍼런스 - 게임,연출.library";
const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");

console.log(`\n📂 Eagle Library: ${EAGLE_LIB}`);
console.log(`📁 Project Root: ${PROJECT_ROOT}`);

// Load category mapping
const categoriesPath = path.join(PROJECT_ROOT, "src", "data", "categories.json");
if (fs.existsSync(categoriesPath)) {
  loadCategoryMap(categoriesPath);
  console.log("✅ Category map loaded");
} else {
  console.warn("⚠️  No categories.json found — all clips will be 'uncategorized'");
}

// Read Eagle library
console.log(`\n🔍 Reading Eagle library...`);
const items = readEagleLibrary(EAGLE_LIB, {
  ids: flags.ids,
  limit: flags.limit,
});
console.log(`   Found ${items.length} items`);

if (flags.dryRun) {
  console.log("\n🏃 DRY RUN — no files will be written\n");
  for (const item of items) {
    console.log(
      `  ${item.id} | ${item.name} | ${item.ext} | ${item.star}★ | ${item.tags.slice(0, 3).join(", ")}`
    );
  }
  console.log(`\nTotal: ${items.length} items would be processed`);
  process.exit(0);
}

// Process items
const mediaDir = path.join(PROJECT_ROOT, "public");
fs.mkdirSync(path.join(mediaDir, "videos"), { recursive: true });
fs.mkdirSync(path.join(mediaDir, "thumbnails"), { recursive: true });
fs.mkdirSync(path.join(mediaDir, "previews"), { recursive: true });

const clips = [];
const clipIndexEntries = [];
let processed = 0;
let failed = 0;

for (const item of items) {
  try {
    console.log(
      `\n[${processed + 1}/${items.length}] ${item.id} — ${item.name}`
    );

    // 1. Generate LQIP
    let lqipBase64 = "";
    if (item._mediaPath && fs.existsSync(item._mediaPath)) {
      console.log("  → Generating LQIP...");
      lqipBase64 = await generateLQIP(item._mediaPath);
    }

    // 2. Copy/transcode video (local mode)
    if (flags.local && item._mediaPath && fs.existsSync(item._mediaPath)) {
      const videoOut = path.join(mediaDir, "videos", `${item.id}.mp4`);
      if (!fs.existsSync(videoOut)) {
        console.log("  → Processing video...");
        await processVideo(item._mediaPath, videoOut);
      } else {
        console.log("  → Video exists, skipping");
      }
    }

    // 3. Generate short MP4 loop preview
    if (item._mediaPath && fs.existsSync(item._mediaPath)) {
      const previewOut = path.join(mediaDir, "previews", `${item.id}.mp4`);
      if (!fs.existsSync(previewOut)) {
        console.log("  → Generating MP4 preview...");
        const videoSource = flags.local
          ? path.join(mediaDir, "videos", `${item.id}.mp4`)
          : item._mediaPath;
        const source = fs.existsSync(videoSource) ? videoSource : item._mediaPath;
        await generatePreview(source, previewOut);
      } else {
        console.log("  → Preview exists, skipping");
      }
    }

    // 4. Convert Eagle thumbnail to static WebP
    if (item._thumbnailPath && fs.existsSync(item._thumbnailPath)) {
      const thumbOut = path.join(mediaDir, "thumbnails", `${item.id}.webp`);
      if (!fs.existsSync(thumbOut)) {
        console.log("  → Converting thumbnail to static WebP...");
        await processThumbnail(item._thumbnailPath, thumbOut);
      } else {
        console.log("  → Thumbnail exists, skipping");
      }
    }

    // 5. Build data objects
    const clipIndex = buildClipIndex(item, lqipBase64);
    const fullClip = buildFullClip(item, lqipBase64);

    clipIndexEntries.push(clipIndex);
    clips.push(fullClip);
    processed++;
  } catch (err) {
    console.error(`  ❌ FAILED: ${err.message}`);
    failed++;
  }
}

// 6. Compute related clips
console.log("\n🔗 Computing related clips...");
const relatedMap = computeRelatedClips(clips);
for (const clip of clips) {
  clip.relatedClips = relatedMap.get(clip.id) || [];
}

// 7. Write output
console.log("\n💾 Writing output files...");
writeOutputFiles(clips, clipIndexEntries, PROJECT_ROOT);

// Summary
console.log(`\n✅ Export complete!`);
console.log(`   Processed: ${processed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Index entries: ${clipIndexEntries.length}`);
console.log(`   Clip JSONs: ${clips.length}`);
