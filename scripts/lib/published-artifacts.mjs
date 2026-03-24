import fs from "node:fs";
import path from "node:path";

const MANAGED_ARTIFACTS = [
  { relativeDir: path.join("public", "videos"), extension: ".mp4" },
  { relativeDir: path.join("public", "previews"), extension: ".mp4" },
  { relativeDir: path.join("public", "thumbnails"), extension: ".webp" },
  { relativeDir: path.join("public", "data", "clips"), extension: ".json" },
];

function normalizeKeepIds(keepIds) {
  if (!Array.isArray(keepIds)) {
    throw new TypeError("prunePublishedArtifacts requires keepIds to be an array");
  }

  return new Set(keepIds.map((value) => String(value ?? "").trim()).filter(Boolean));
}

function toRelativeProjectPath(projectRoot, absolutePath) {
  return path.relative(projectRoot, absolutePath).split(path.sep).join("/");
}

export async function prunePublishedArtifacts({ keepIds, projectRoot, dryRun = false }) {
  if (!projectRoot) {
    throw new Error("prunePublishedArtifacts requires a projectRoot");
  }

  const keepSet = normalizeKeepIds(keepIds);
  const entries = [];

  for (const artifact of MANAGED_ARTIFACTS) {
    const absoluteDir = path.join(projectRoot, artifact.relativeDir);
    if (!fs.existsSync(absoluteDir)) {
      continue;
    }

    const directoryEntries = await fs.promises.readdir(absoluteDir, {
      withFileTypes: true,
    });

    for (const entry of directoryEntries) {
      if (!entry.isFile()) {
        continue;
      }

      if (path.extname(entry.name) !== artifact.extension) {
        continue;
      }

      const clipId = path.basename(entry.name, artifact.extension).trim();
      if (!clipId || keepSet.has(clipId)) {
        continue;
      }

      const absolutePath = path.join(absoluteDir, entry.name);
      entries.push({
        id: clipId,
        filePath: absolutePath,
        relativePath: toRelativeProjectPath(projectRoot, absolutePath),
      });
    }
  }

  if (!dryRun) {
    await Promise.all(entries.map((entry) => fs.promises.rm(entry.filePath)));
  }

  return {
    removed: dryRun ? 0 : entries.length,
    planned: entries.length,
    entries,
  };
}
