import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  loadReleaseBatch,
  normalizeReleaseBatchIds,
  resolveReleaseBatchPath,
} from "./release-batch.mjs";

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "release-batch-test-"));
}

test("resolveReleaseBatchPath prefers explicit batchPath", () => {
  const resolved = resolveReleaseBatchPath({
    batchPath: "/tmp/custom-batch.json",
    projectRoot: "/repo",
  });

  assert.equal(resolved, "/tmp/custom-batch.json");
});

test("resolveReleaseBatchPath falls back to config/release-batch.json", () => {
  const resolved = resolveReleaseBatchPath({
    projectRoot: "/repo",
  });

  assert.equal(resolved, "/repo/config/release-batch.json");
});

test("normalizeReleaseBatchIds preserves order and rejects blanks", () => {
  assert.deepEqual(normalizeReleaseBatchIds(["A1", "B2", "C3"]), [
    "A1",
    "B2",
    "C3",
  ]);

  assert.throws(() => normalizeReleaseBatchIds(["A1", "   "]), /blank/i);
});

test("normalizeReleaseBatchIds rejects duplicate ids", () => {
  assert.throws(
    () => normalizeReleaseBatchIds(["A1", "B2", "A1"]),
    /duplicate/i
  );
});

test("loadReleaseBatch loads name and ordered ids from a valid JSON file", () => {
  const tempDir = createTempDir();
  const batchPath = path.join(tempDir, "batch.json");

  fs.writeFileSync(
    batchPath,
    JSON.stringify(
      {
        name: "canary",
        ids: ["L1", "L2", "L3"],
      },
      null,
      2
    )
  );

  const batch = loadReleaseBatch(batchPath);

  assert.deepEqual(batch, {
    name: "canary",
    ids: ["L1", "L2", "L3"],
    path: batchPath,
  });
});

test("loadReleaseBatch rejects an empty ids list", () => {
  const tempDir = createTempDir();
  const batchPath = path.join(tempDir, "batch.json");

  fs.writeFileSync(
    batchPath,
    JSON.stringify(
      {
        name: "empty",
        ids: [],
      },
      null,
      2
    )
  );

  assert.throws(() => loadReleaseBatch(batchPath), /at least one id/i);
});

test("loadReleaseBatch throws a clear error when the file is missing", () => {
  assert.throws(
    () => loadReleaseBatch("/tmp/does-not-exist.json"),
    /release batch/i
  );
});
