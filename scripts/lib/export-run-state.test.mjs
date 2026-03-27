import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildSelectionSignature,
  createRunManifest,
  findLatestResumableRun,
  loadItemState,
  loadRunManifest,
  resolveRunPaths,
  saveItemState,
  saveRunManifest,
  saveRunSummary,
  saveStageSummary,
  verifyOutputFile,
} from "./export-run-state.mjs";

function createTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "reflix-export-run-state-"));
}

test("resolveRunPaths places export artifacts under .tmp/export-runs/<run-id>", () => {
  assert.deepEqual(resolveRunPaths("/repo", "run-1"), {
    runDir: "/repo/.tmp/export-runs/run-1",
    manifestPath: "/repo/.tmp/export-runs/run-1/manifest.json",
    summaryPath: "/repo/.tmp/export-runs/run-1/summary.json",
    stagesDir: "/repo/.tmp/export-runs/run-1/stages",
    itemsDir: "/repo/.tmp/export-runs/run-1/items",
  });
});

test("loadRunManifest returns null when the run does not exist", () => {
  const projectRoot = createTempProject();
  assert.equal(loadRunManifest({ projectRoot, runId: "missing-run" }), null);
});

test("findLatestResumableRun returns the newest incomplete matching run", () => {
  const projectRoot = createTempProject();
  const selectionSignature = buildSelectionSignature(
    { source: "batch", ids: ["A1", "A2"] },
    { r2: true, prune: false }
  );

  saveRunManifest({
    projectRoot,
    manifest: createRunManifest({
      runId: "2026-03-27T10-10-00-000Z",
      selectionSignature,
      selection: { source: "batch", label: "batch-a", ids: ["A1", "A2"] },
      flags: { r2: true, prune: false },
      startedAt: "2026-03-27T10:10:00.000Z",
      status: "running",
    }),
  });
  saveRunManifest({
    projectRoot,
    manifest: createRunManifest({
      runId: "2026-03-27T10-11-00-000Z",
      selectionSignature,
      selection: { source: "batch", label: "batch-a", ids: ["A1", "A2"] },
      flags: { r2: true, prune: false },
      startedAt: "2026-03-27T10:11:00.000Z",
      status: "completed",
    }),
  });
  saveRunManifest({
    projectRoot,
    manifest: createRunManifest({
      runId: "2026-03-27T10-12-00-000Z",
      selectionSignature,
      selection: { source: "batch", label: "batch-a", ids: ["A1", "A2"] },
      flags: { r2: true, prune: false },
      startedAt: "2026-03-27T10:12:00.000Z",
      status: "running",
    }),
  });

  const run = findLatestResumableRun({ projectRoot, selectionSignature });
  assert.equal(run?.runId, "2026-03-27T10-12-00-000Z");
});

test("saveItemState persists item checkpoints and loadItemState reads them back", () => {
  const projectRoot = createTempProject();
  const runId = "2026-03-27T10-20-00-000Z";

  saveItemState({
    projectRoot,
    runId,
    clipId: "A1",
    itemState: {
      id: "A1",
      media: {
        status: "completed",
      },
    },
  });

  assert.deepEqual(loadItemState({ projectRoot, runId, clipId: "A1" }), {
    id: "A1",
    media: {
      status: "completed",
    },
  });
});

test("saveStageSummary writes stage summaries under the run stages directory", () => {
  const projectRoot = createTempProject();
  const runId = "2026-03-27T10-30-00-000Z";

  saveStageSummary({
    projectRoot,
    runId,
    stageName: "process-media",
    summary: {
      completed: 3,
      failed: 1,
    },
  });

  const summaryPath = path.join(
    projectRoot,
    ".tmp",
    "export-runs",
    runId,
    "stages",
    "process-media.json"
  );

  assert.deepEqual(JSON.parse(fs.readFileSync(summaryPath, "utf-8")), {
    completed: 3,
    failed: 1,
  });
});

test("saveRunSummary persists a run-level summary file", () => {
  const projectRoot = createTempProject();
  const runId = "2026-03-27T10-40-00-000Z";

  saveRunSummary({
    projectRoot,
    runId,
    summary: {
      status: "failed",
      failedItems: 2,
    },
  });

  const summary = JSON.parse(
    fs.readFileSync(
      path.join(projectRoot, ".tmp", "export-runs", runId, "summary.json"),
      "utf-8"
    )
  );

  assert.deepEqual(summary, {
    status: "failed",
    failedItems: 2,
  });
});

test("verifyOutputFile rejects missing and zero-byte files, and returns metadata for valid outputs", () => {
  const projectRoot = createTempProject();
  const zeroBytePath = path.join(projectRoot, "zero.bin");
  const validPath = path.join(projectRoot, "valid.bin");

  fs.writeFileSync(zeroBytePath, "");
  fs.writeFileSync(validPath, "content");

  assert.equal(verifyOutputFile(path.join(projectRoot, "missing.bin")), null);
  assert.equal(verifyOutputFile(zeroBytePath), null);
  assert.deepEqual(verifyOutputFile(validPath), {
    path: validPath,
    size: 7,
  });
});
