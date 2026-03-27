import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { writeAtomicJson } from "./release-approval-state.mjs";

export const EXPORT_RUN_SCHEMA_VERSION = 1;

function toStringValue(value) {
  return String(value ?? "");
}

function normalizeIds(ids) {
  if (!Array.isArray(ids)) {
    return null;
  }

  return ids.map((id) => String(id ?? "").trim()).filter(Boolean);
}

export function buildSelectionSignature(selection, flags) {
  const payload = JSON.stringify({
    source: toStringValue(selection?.source),
    ids: normalizeIds(selection?.ids) ?? [],
    r2: Boolean(flags?.r2),
    prune: Boolean(flags?.prune),
  });

  return `sha256:${crypto.createHash("sha256").update(payload).digest("hex")}`;
}

export function resolveRunPaths(projectRoot, runId) {
  const runDir = path.join(projectRoot, ".tmp", "export-runs", runId);

  return {
    runDir,
    manifestPath: path.join(runDir, "manifest.json"),
    summaryPath: path.join(runDir, "summary.json"),
    stagesDir: path.join(runDir, "stages"),
    itemsDir: path.join(runDir, "items"),
  };
}

function ensureRunDirectories(projectRoot, runId) {
  const paths = resolveRunPaths(projectRoot, runId);
  fs.mkdirSync(paths.runDir, { recursive: true });
  fs.mkdirSync(paths.stagesDir, { recursive: true });
  fs.mkdirSync(paths.itemsDir, { recursive: true });
  return paths;
}

export function createRunManifest({
  runId,
  selectionSignature,
  selection,
  flags,
  startedAt,
  status = "running",
}) {
  return {
    schemaVersion: EXPORT_RUN_SCHEMA_VERSION,
    runId,
    selectionSignature,
    startedAt: toStringValue(startedAt),
    status,
    flags: {
      r2: Boolean(flags?.r2),
      prune: Boolean(flags?.prune),
      dryRun: Boolean(flags?.dryRun),
      mediaConcurrency: Number(flags?.mediaConcurrency ?? 0),
      uploadConcurrency: Number(flags?.uploadConcurrency ?? 0),
      forceRelatedFullRebuild: Boolean(flags?.forceRelatedFullRebuild),
    },
    selection: {
      source: toStringValue(selection?.source),
      label: toStringValue(selection?.label),
      ids: normalizeIds(selection?.ids),
    },
  };
}

export function loadRunManifest({ projectRoot, runId }) {
  const { manifestPath } = resolveRunPaths(projectRoot, runId);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
}

export function saveRunManifest({ projectRoot, manifest }) {
  const paths = ensureRunDirectories(projectRoot, manifest.runId);
  writeAtomicJson(paths.manifestPath, manifest);
  return paths.manifestPath;
}

export function saveRunSummary({ projectRoot, runId, summary }) {
  const paths = ensureRunDirectories(projectRoot, runId);
  writeAtomicJson(paths.summaryPath, summary);
  return paths.summaryPath;
}

export function saveStageSummary({ projectRoot, runId, stageName, summary }) {
  const paths = ensureRunDirectories(projectRoot, runId);
  const stagePath = path.join(paths.stagesDir, `${stageName}.json`);
  writeAtomicJson(stagePath, summary);
  return stagePath;
}

export function loadItemState({ projectRoot, runId, clipId }) {
  const { itemsDir } = resolveRunPaths(projectRoot, runId);
  const itemPath = path.join(itemsDir, `${clipId}.json`);
  if (!fs.existsSync(itemPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(itemPath, "utf-8"));
}

export function saveItemState({ projectRoot, runId, clipId, itemState }) {
  const paths = ensureRunDirectories(projectRoot, runId);
  const itemPath = path.join(paths.itemsDir, `${clipId}.json`);
  writeAtomicJson(itemPath, itemState);
  return itemPath;
}

export function findLatestResumableRun({ projectRoot, selectionSignature }) {
  const runsRoot = path.join(projectRoot, ".tmp", "export-runs");
  if (!fs.existsSync(runsRoot)) {
    return null;
  }

  const runIds = fs
    .readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  for (const runId of runIds) {
    const manifest = loadRunManifest({ projectRoot, runId });
    if (!manifest) {
      continue;
    }

    if (
      manifest.selectionSignature === selectionSignature &&
      manifest.status !== "completed"
    ) {
      return manifest;
    }
  }

  return null;
}

export function verifyOutputFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  const stat = fs.statSync(filePath);
  if (stat.size <= 0) {
    return null;
  }

  return {
    path: filePath,
    size: stat.size,
  };
}
