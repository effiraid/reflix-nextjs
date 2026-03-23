import fs from "fs";
import path from "path";

import { readEagleLibrary } from "./eagle-reader.mjs";
import {
  generateAnimatedThumbnail,
  inspectWebP,
} from "./media-processor.mjs";

export const PILOT_IDS = [
  "LNLIC9Q06344T",
  "LNLIC9Q09YNE1",
  "LNLIC9Q0F5HFB",
  "LNLIC9Q0YKGZH",
  "LNLIC9Q0Z93I8",
  "MJPTGPWFDYG2P",
  "MJPTGPWGI9BE1",
  "MJPTGPWGMIW9O",
  "MJPTGPWGZ5MGX",
  "MJPTGPWH0SR5Q",
];

function buildCategoryResolver(categoriesPath) {
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

export function collectEligibleItems(items, options = {}) {
  const resolveCategory = options.resolveCategory;
  const inspectThumbnail = options.inspectThumbnail || inspectWebP;
  const excludeIds = new Set(options.excludeIds || []);

  if (typeof resolveCategory !== "function") {
    throw new TypeError("collectEligibleItems requires a resolveCategory function");
  }

  return items
    .filter((item) => !excludeIds.has(item.id))
    .filter((item) => (item.ext || "").toLowerCase() === "mp4")
    .filter((item) => resolveCategory(item.folders || []) === "uncategorized")
    .filter((item) => item._thumbnailPath && item._mediaPath && item._infoDir)
    .map((item) => ({
      ...item,
      thumbnailInfo: inspectThumbnail(item._thumbnailPath),
    }))
    .filter((item) => item.thumbnailInfo.isWebP)
    .filter((item) => !item.thumbnailInfo.isAnimated);
}

export function selectPilotItems(items, options = {}) {
  const pilotIds = options.pilotIds || PILOT_IDS;
  const resolveCategory = options.resolveCategory;
  const inspectThumbnail = options.inspectThumbnail || inspectWebP;

  if (typeof resolveCategory !== "function") {
    throw new TypeError("selectPilotItems requires a resolveCategory function");
  }

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const selectedItems = [];
  const errors = [];

  for (const pilotId of pilotIds) {
    const item = itemsById.get(pilotId);

    if (!item) {
      errors.push(`Pilot item ${pilotId} was not found in the Eagle library`);
      continue;
    }

    if ((item.ext || "").toLowerCase() !== "mp4") {
      errors.push(`Pilot item ${pilotId} must be an mp4`);
      continue;
    }

    const category = resolveCategory(item.folders || []);
    if (category !== "uncategorized") {
      errors.push(`Pilot item ${pilotId} must be uncategorized`);
      continue;
    }

    if (!item._thumbnailPath) {
      errors.push(`Pilot item ${pilotId} is missing _thumbnail.png`);
      continue;
    }

    if (!item._mediaPath) {
      errors.push(`Pilot item ${pilotId} is missing its source media file`);
      continue;
    }

    if (!item._infoDir) {
      errors.push(`Pilot item ${pilotId} is missing its Eagle info directory`);
      continue;
    }

    const eligibleItems = collectEligibleItems([item], {
      resolveCategory,
      inspectThumbnail,
    });
    const eligibleItem = eligibleItems[0];

    if (!eligibleItem) {
      const thumbnailInfo = inspectThumbnail(item._thumbnailPath);
      if (!thumbnailInfo.isWebP) {
        errors.push(`Pilot item ${pilotId} thumbnail is not a WebP container`);
        continue;
      }

      if (thumbnailInfo.isAnimated) {
        errors.push(`Pilot item ${pilotId} must currently be static`);
        continue;
      }

      errors.push(`Pilot item ${pilotId} is not eligible for thumbnail replacement`);
      continue;
    }

    if (!eligibleItem.thumbnailInfo.isWebP) {
      errors.push(`Pilot item ${pilotId} thumbnail is not a WebP container`);
      continue;
    }

    if (eligibleItem.thumbnailInfo.isAnimated) {
      errors.push(`Pilot item ${pilotId} must currently be static`);
      continue;
    }

    selectedItems.push({
      ...eligibleItem,
      category,
    });
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return selectedItems;
}

export function getRemainingEligibleIds(items, options = {}) {
  return collectEligibleItems(items, options).map((item) => item.id);
}

function writeManifest(manifestPath, manifest) {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

export async function runThumbnailPilot(options) {
  const pilotIds = options.pilotIds || PILOT_IDS;
  const libraryPath = options.libraryPath;
  const projectRoot = options.projectRoot;
  const timestamp = options.timestamp || new Date().toISOString().replace(/[:.]/g, "-");
  const readLibrary = options.readLibrary || readEagleLibrary;
  const inspectThumbnail = options.inspectThumbnail || inspectWebP;
  const generateThumbnail = options.generateThumbnail || generateAnimatedThumbnail;
  const resolveCategory =
    options.resolveCategory ||
    buildCategoryResolver(path.join(projectRoot, "src", "data", "categories.json"));

  if (!libraryPath) {
    throw new Error("runThumbnailPilot requires a libraryPath");
  }

  if (!projectRoot) {
    throw new Error("runThumbnailPilot requires a projectRoot");
  }

  const backupDir = path.join(
    projectRoot,
    ".tmp",
    "eagle-thumbnail-backups",
    timestamp
  );
  const manifestPath = path.join(backupDir, "manifest.json");

  fs.mkdirSync(backupDir, { recursive: true });

  const items = readLibrary(libraryPath, { ids: pilotIds });
  const selectedItems = selectPilotItems(items, {
    pilotIds,
    resolveCategory,
    inspectThumbnail,
  });

  const manifest = {
    libraryPath,
    projectRoot,
    backupDir,
    manifestPath,
    pilotIds,
    startedAt: new Date().toISOString(),
    entries: [],
  };

  writeManifest(manifestPath, manifest);

  for (const item of selectedItems) {
    const backupPath = path.join(backupDir, `${item.id}_thumbnail.png`);
    const tempOutputPath = path.join(item._infoDir, `${item.id}.thumbnail.tmp.webp`);
    const entry = {
      id: item.id,
      name: item.name,
      mediaPath: item._mediaPath,
      thumbnailPath: item._thumbnailPath,
      backupPath,
      originalSize: item.thumbnailInfo.fileSize,
      status: "pending",
    };

    let replacedThumbnail = false;

    try {
      fs.copyFileSync(item._thumbnailPath, backupPath);

      const generatedInfo = await generateThumbnail(item._mediaPath, tempOutputPath);
      if (!generatedInfo.isAnimated || generatedInfo.frameCount < 2) {
        throw new Error("Generated thumbnail failed animation validation");
      }

      const tempInfo = inspectThumbnail(tempOutputPath);
      if (!tempInfo.isAnimated || tempInfo.frameCount < 2) {
        throw new Error("Temporary thumbnail is not animated");
      }

      fs.renameSync(tempOutputPath, item._thumbnailPath);
      replacedThumbnail = true;

      const finalInfo = inspectThumbnail(item._thumbnailPath);
      if (!finalInfo.isAnimated || finalInfo.frameCount < 2) {
        throw new Error("Final Eagle thumbnail verification failed after replacement");
      }

      entry.status = "success";
      entry.frameCount = finalInfo.frameCount;
      entry.width = finalInfo.width;
      entry.height = finalInfo.height;
      entry.newSize = finalInfo.fileSize;
    } catch (error) {
      if (fs.existsSync(tempOutputPath)) {
        fs.rmSync(tempOutputPath, { force: true });
      }

      if (replacedThumbnail && fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, item._thumbnailPath);
        entry.rolledBack = true;
      }

      entry.status = "failed";
      entry.error = error.message;
    }

    manifest.entries.push(entry);
    writeManifest(manifestPath, manifest);
  }

  manifest.completedAt = new Date().toISOString();
  manifest.summary = {
    processed: manifest.entries.length,
    succeeded: manifest.entries.filter((entry) => entry.status === "success").length,
    failed: manifest.entries.filter((entry) => entry.status === "failed").length,
  };

  writeManifest(manifestPath, manifest);
  return manifest;
}
