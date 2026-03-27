import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildSelectionSignature,
  createRunManifest,
  loadRunManifest,
  saveRunManifest,
} from "./export-run-state.mjs";
import { runExportPipeline } from "./export-pipeline.mjs";

function createTempProject() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-export-pipeline-"));
  fs.mkdirSync(path.join(projectRoot, "src", "data"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "data", "clips"), { recursive: true });
  return projectRoot;
}

function createFlags(overrides = {}) {
  return {
    full: false,
    confirmFullExport: false,
    dryRun: false,
    prune: false,
    local: false,
    r2: false,
    batchPath: null,
    ids: ["A1"],
    limit: null,
    mediaConcurrency: 2,
    uploadConcurrency: 2,
    freshRun: false,
    resumeRun: null,
    forceRelatedFullRebuild: false,
    ...overrides,
  };
}

function createItem(id = "A1") {
  return {
    id,
    name: `Clip ${id}`,
    ext: "mp4",
    tags: ["tag"],
    folders: ["F1"],
    mtime: 1,
    _mediaPath: `/library/${id}.mp4`,
    _thumbnailPath: `/library/${id}_thumbnail.png`,
  };
}

test("runExportPipeline resumes the newest matching incomplete run unless fresh-run is requested", async () => {
  const projectRoot = createTempProject();
  const flags = createFlags();
  const selectionSignature = buildSelectionSignature(
    { source: "ids", ids: ["A1"] },
    { r2: false, prune: false }
  );

  saveRunManifest({
    projectRoot,
    manifest: createRunManifest({
      runId: "2026-03-27T10-10-00-000Z",
      selectionSignature,
      selection: { source: "ids", label: "--ids override (1 ids)", ids: ["A1"] },
      flags,
      startedAt: "2026-03-27T10:10:00.000Z",
      status: "running",
    }),
  });

  const resumed = await runExportPipeline(flags, {
    projectRoot,
    eagleLibraryPath: "/library",
    readLibraryImpl: () => [createItem("A1")],
    runMediaStageImpl: async () => ({ completed: 1, reused: 1, rebuilt: 0, failed: 0 }),
    runArtifactStageImpl: async () => ({ writtenClips: 1, indexCount: 1 }),
    runRelatedStageImpl: async () => ({ mode: "partial", rewrittenCount: 1 }),
    runUploadStageImpl: async () => ({ uploaded: 0, failed: 0, skipped: 0, reused: 0 }),
  });

  const fresh = await runExportPipeline({ ...flags, freshRun: true }, {
    projectRoot,
    eagleLibraryPath: "/library",
    readLibraryImpl: () => [createItem("A1")],
    runMediaStageImpl: async () => ({ completed: 1, reused: 1, rebuilt: 0, failed: 0 }),
    runArtifactStageImpl: async () => ({ writtenClips: 1, indexCount: 1 }),
    runRelatedStageImpl: async () => ({ mode: "partial", rewrittenCount: 1 }),
    runUploadStageImpl: async () => ({ uploaded: 0, failed: 0, skipped: 0, reused: 0 }),
  });

  assert.equal(resumed.runId, "2026-03-27T10-10-00-000Z");
  assert.notEqual(fresh.runId, resumed.runId);
});

test("runExportPipeline marks the run as failed when stage failures remain", async () => {
  const projectRoot = createTempProject();
  const flags = createFlags();

  const result = await runExportPipeline(flags, {
    projectRoot,
    eagleLibraryPath: "/library",
    readLibraryImpl: () => [createItem("A1")],
    runMediaStageImpl: async () => ({ completed: 0, reused: 0, rebuilt: 0, failed: 1 }),
    runArtifactStageImpl: async () => ({ writtenClips: 0, indexCount: 0 }),
    runRelatedStageImpl: async () => ({ mode: "partial", rewrittenCount: 0 }),
    runUploadStageImpl: async () => ({ uploaded: 0, failed: 0, skipped: 0, reused: 0 }),
  });

  const manifest = loadRunManifest({ projectRoot, runId: result.runId });
  assert.equal(result.failed, 1);
  assert.equal(manifest.status, "failed");
});
