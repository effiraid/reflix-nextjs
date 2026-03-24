import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function resolveProjectPath(relativePath) {
  return path.join(PROJECT_ROOT, relativePath);
}

function normalizeTags(tags) {
  return Array.isArray(tags) ? tags : [];
}

export function applyStatusTagMutation(currentTags, { addTags = [], removeTags = [] } = {}) {
  const removeSet = new Set(normalizeTags(removeTags));
  const nextTags = normalizeTags(currentTags).filter((tag) => !removeSet.has(tag));
  const existingTags = new Set(nextTags);

  for (const tag of normalizeTags(addTags)) {
    if (removeSet.has(tag) || existingTags.has(tag)) {
      continue;
    }

    existingTags.add(tag);
    nextTags.push(tag);
  }

  return nextTags;
}

export function writeMetadataWithBackup(entry, metadataPatch, backupDir, io = fs) {
  const originalRaw = io.readFileSync(entry.metadataPath, "utf8");
  const originalMetadata = JSON.parse(originalRaw);
  const absoluteBackupDir = path.isAbsolute(backupDir)
    ? backupDir
    : resolveProjectPath(backupDir);
  const backupPath = path.join(absoluteBackupDir, `${entry.id}-metadata.json`);
  const tempMetadataPath = `${entry.metadataPath}.tmp`;
  const nextMetadata = { ...originalMetadata };

  for (const [key, value] of Object.entries(metadataPatch || {})) {
    if (value !== undefined) {
      nextMetadata[key] = value;
    }
  }

  io.mkdirSync(absoluteBackupDir, { recursive: true });
  io.writeFileSync(backupPath, originalRaw);

  try {
    io.writeFileSync(tempMetadataPath, JSON.stringify(nextMetadata, null, 2));
    io.renameSync(tempMetadataPath, entry.metadataPath);
  } catch (error) {
    try {
      io.rmSync(tempMetadataPath, { force: true });
      io.writeFileSync(`${entry.metadataPath}.restore`, originalRaw);
      io.renameSync(`${entry.metadataPath}.restore`, entry.metadataPath);
    } catch (restoreError) {
      error.message = `${error.message}; restore failed: ${restoreError.message}`;
    } finally {
      io.rmSync(`${entry.metadataPath}.restore`, { force: true });
    }

    throw error;
  }

  return {
    backupPath,
    metadataPath: entry.metadataPath,
  };
}
