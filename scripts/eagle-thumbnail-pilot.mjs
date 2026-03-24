#!/usr/bin/env node

import fs from "fs";
import path from "path";

import { resolveEagleLibraryPath } from "./lib/eagle-library-path.mjs";
import { readEagleLibrary } from "./lib/eagle-reader.mjs";
import {
  getRemainingEligibleIds,
  runThumbnailPilot,
} from "./lib/eagle-thumbnail-pilot.mjs";
import { inspectWebP } from "./lib/media-processor.mjs";

const EAGLE_LIB = resolveEagleLibraryPath();
const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);

function createCategoryResolver() {
  const categoriesPath = path.join(PROJECT_ROOT, "src", "data", "categories.json");
  const categoryMap = {};
  const categories = JSON.parse(fs.readFileSync(categoriesPath, "utf-8"));

  function walk(tree) {
    for (const [folderId, node] of Object.entries(tree)) {
      categoryMap[folderId] = node.slug;
      if (node.children) {
        walk(node.children);
      }
    }
  }

  walk(categories);

  return (folderIds = []) => {
    for (const folderId of folderIds) {
      if (categoryMap[folderId]) {
        return categoryMap[folderId];
      }
    }
    return "uncategorized";
  };
}

console.log(`\n📂 Eagle Library: ${EAGLE_LIB}`);
console.log(`📁 Project Root: ${PROJECT_ROOT}`);
console.log("🎬 Running Eagle animated thumbnail replacement...");

let pilotIds;

if (args.includes("--remaining")) {
  const resolveCategory = createCategoryResolver();
  const items = readEagleLibrary(EAGLE_LIB);
  pilotIds = getRemainingEligibleIds(items, {
    resolveCategory,
    inspectThumbnail: inspectWebP,
  });
  console.log(`   Mode: remaining static uncategorized mp4s (${pilotIds.length})`);
} else {
  console.log("   Mode: pilot");
}

const manifest = await runThumbnailPilot({
  libraryPath: EAGLE_LIB,
  projectRoot: PROJECT_ROOT,
  pilotIds,
});

console.log(`\n🧾 Manifest: ${manifest.manifestPath}`);
console.log(`   Processed: ${manifest.summary.processed}`);
console.log(`   Succeeded: ${manifest.summary.succeeded}`);
console.log(`   Failed: ${manifest.summary.failed}`);

if (manifest.summary.failed > 0) {
  process.exitCode = 1;
}
