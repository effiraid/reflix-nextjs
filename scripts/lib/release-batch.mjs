import fs from "node:fs";
import path from "node:path";

export function resolveReleaseBatchPath({ batchPath = null, projectRoot }) {
  if (batchPath?.trim()) {
    return batchPath.trim();
  }

  if (!projectRoot) {
    throw new Error("resolveReleaseBatchPath requires a projectRoot");
  }

  return path.join(projectRoot, "config", "release-batch.json");
}

export function normalizeReleaseBatchIds(rawIds) {
  if (!Array.isArray(rawIds)) {
    throw new TypeError("Release batch ids must be an array");
  }

  if (rawIds.length === 0) {
    throw new Error("Release batch must contain at least one id");
  }

  const seen = new Set();

  return rawIds.map((value, index) => {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
      throw new Error(`Release batch ids must not contain blank values (index ${index})`);
    }

    if (seen.has(normalized)) {
      throw new Error(`Release batch contains duplicate id: ${normalized}`);
    }

    seen.add(normalized);
    return normalized;
  });
}

export function loadReleaseBatch(batchPath) {
  const resolvedPath = path.resolve(batchPath);

  if (path.extname(resolvedPath) !== ".json") {
    throw new Error(`Release batch file must be JSON: ${resolvedPath}`);
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Release batch file was not found: ${resolvedPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  const name = String(raw.name ?? "").trim();
  const ids = normalizeReleaseBatchIds(raw.ids);

  return {
    name: name || path.basename(resolvedPath, ".json"),
    ids,
    path: resolvedPath,
  };
}
