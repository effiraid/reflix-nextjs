import fs from "fs";
import path from "path";

/**
 * Build category tree from Eagle folder structure.
 * Uses the hardcoded mapping from the spec since Eagle folder IDs
 * are stable and the category slugs/i18n are manually defined.
 */
export function buildCategoryTree() {
  // For now, use the existing categories.json as-is.
  // The full implementation would map Eagle folder IDs to slugs.
  // This is fine because categories rarely change.
  return null; // Signal to keep existing file
}

/**
 * Get category slug for a given folder ID.
 */
const FOLDER_TO_CATEGORY = {};
const REFLIX_TAG_PREFIX = "reflix:";

function toPublicTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags.filter(
    (tag) => typeof tag === "string" && !tag.startsWith(REFLIX_TAG_PREFIX)
  );
}

export function loadCategoryMap(categoriesPath) {
  const data = JSON.parse(fs.readFileSync(categoriesPath, "utf-8"));
  function walk(tree) {
    for (const [id, node] of Object.entries(tree)) {
      FOLDER_TO_CATEGORY[id] = node.slug;
      if (node.children) {
        walk(node.children);
      }
    }
  }
  walk(data);
}

export function getCategoryForFolders(folderIds) {
  for (const id of folderIds) {
    if (FOLDER_TO_CATEGORY[id]) return FOLDER_TO_CATEGORY[id];
  }
  return "uncategorized";
}

/**
 * Build a ClipIndex entry from Eagle metadata.
 */
export function buildClipIndex(meta, lqipBase64) {
  return {
    id: meta.id,
    name: meta.name,
    tags: toPublicTags(meta.tags),
    folders: meta.folders || [],
    star: meta.star || 0,
    category: getCategoryForFolders(meta.folders || []),
    width: meta.width || 640,
    height: meta.height || 360,
    duration: meta.duration || 0,
    previewUrl: `/previews/${meta.id}.mp4`,
    thumbnailUrl: `/thumbnails/${meta.id}.webp`,
    lqipBase64: lqipBase64 || "",
  };
}

/**
 * Build a full Clip object from Eagle metadata.
 */
export function buildFullClip(meta, lqipBase64) {
  const palettes = (meta.palettes || []).map((p) => ({
    color: p.color,
    ratio: p.ratio,
  }));

  return {
    id: meta.id,
    name: meta.name,
    ext: meta.ext || "mp4",
    size: meta.size || 0,
    width: meta.width || 640,
    height: meta.height || 360,
    duration: meta.duration || 0,
    tags: toPublicTags(meta.tags),
    folders: meta.folders || [],
    star: meta.star || 0,
    annotation: meta.annotation || "",
    url: meta.url || "",
    palettes,
    btime: meta.btime || 0,
    mtime: meta.mtime || 0,
    i18n: {
      title: { ko: meta.name, en: "" },
      description: { ko: "", en: "" },
    },
    videoUrl: `/videos/${meta.id}.mp4`,
    thumbnailUrl: `/thumbnails/${meta.id}.webp`,
    previewUrl: `/previews/${meta.id}.mp4`,
    lqipBase64: lqipBase64 || "",
    category: getCategoryForFolders(meta.folders || []),
    relatedClips: [],
  };
}

/**
 * Write all output files.
 */
export function writeOutputFiles(clips, clipIndexEntries, outputDir) {
  // Ensure directories
  fs.mkdirSync(path.join(outputDir, "src", "data", "clips"), { recursive: true });
  fs.mkdirSync(path.join(outputDir, "public", "data", "clips"), { recursive: true });

  // Write individual clip JSONs (to public/ only — eng review #3)
  for (const clip of clips) {
    const clipPath = path.join(outputDir, "public", "data", "clips", `${clip.id}.json`);
    fs.writeFileSync(clipPath, JSON.stringify(clip, null, 2));
  }

  // Merge with any existing index so batch exports are incremental by default.
  const indexPath = path.join(outputDir, "src", "data", "index.json");
  let existingEntries = [];
  if (fs.existsSync(indexPath)) {
    const existingIndex = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    existingEntries = existingIndex.clips || [];
  }

  const mergedEntries = new Map(existingEntries.map((entry) => [entry.id, entry]));
  for (const entry of clipIndexEntries) {
    mergedEntries.set(entry.id, entry);
  }

  const indexData = {
    clips: Array.from(mergedEntries.values()),
    totalCount: mergedEntries.size,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));

  console.log(`Wrote ${clips.length} clip JSONs + index.json (${mergedEntries.size} entries)`);
}
