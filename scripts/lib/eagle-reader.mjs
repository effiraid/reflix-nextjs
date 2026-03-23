import fs from "fs";
import path from "path";

/**
 * Read Eagle library metadata from disk.
 * @param {string} libraryPath - Path to .library directory
 * @param {object} options
 * @param {string[]} [options.ids] - Specific item IDs to read (all if omitted)
 * @param {number} [options.limit] - Max items to read
 * @returns {Array} Array of Eagle metadata objects
 */
export function readEagleLibrary(libraryPath, options = {}) {
  const imagesDir = path.join(libraryPath, "images");
  if (!fs.existsSync(imagesDir)) {
    throw new Error(`Eagle images directory not found: ${imagesDir}`);
  }

  let dirs = fs.readdirSync(imagesDir).filter((d) => d.endsWith(".info"));

  // Filter by specific IDs if provided
  if (options.ids) {
    const idSet = new Set(options.ids);
    dirs = dirs.filter((d) => idSet.has(d.replace(".info", "")));
  }

  // Limit
  if (options.limit) {
    dirs = dirs.slice(0, options.limit);
  }

  const items = [];
  for (const dir of dirs) {
    const metadataPath = path.join(imagesDir, dir, "metadata.json");
    if (!fs.existsSync(metadataPath)) continue;

    try {
      const raw = fs.readFileSync(metadataPath, "utf-8");
      const meta = JSON.parse(raw);

      // Skip deleted items
      if (meta.isDeleted) continue;

      // Find the media file
      const infoDir = path.join(imagesDir, dir);
      const files = fs.readdirSync(infoDir);
      const mediaFile = files.find(
        (f) => !f.startsWith(".") && f !== "metadata.json" && !f.includes("_thumbnail")
      );
      const thumbnailFile = files.find((f) => f.includes("_thumbnail"));

      items.push({
        ...meta,
        _mediaPath: mediaFile ? path.join(infoDir, mediaFile) : null,
        _thumbnailPath: thumbnailFile
          ? path.join(infoDir, thumbnailFile)
          : null,
        _infoDir: infoDir,
      });
    } catch (err) {
      console.error(`Failed to read ${dir}: ${err.message}`);
    }
  }

  return items;
}

/**
 * Read Eagle folder structure from library metadata.
 */
export function readEagleFolders(libraryPath) {
  const metadataPath = path.join(libraryPath, "metadata.json");
  if (!fs.existsSync(metadataPath)) return [];

  const raw = fs.readFileSync(metadataPath, "utf-8");
  const data = JSON.parse(raw);
  return data.folders || [];
}

/**
 * Read Eagle tag groups from library.
 */
export function readEagleTagGroups(libraryPath) {
  const tagsPath = path.join(libraryPath, "tags.json");
  if (!fs.existsSync(tagsPath)) return [];

  const raw = fs.readFileSync(tagsPath, "utf-8");
  return JSON.parse(raw);
}
