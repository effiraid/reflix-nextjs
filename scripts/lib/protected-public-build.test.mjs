import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { pruneProtectedPublicBuild } from "./protected-public-build.mjs";

function createPublicTree(projectRoot) {
  for (const relativeDir of [
    "public/videos",
    "public/previews",
    "public/thumbnails",
  ]) {
    fs.mkdirSync(path.join(projectRoot, relativeDir), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, relativeDir, "clip-1.bin"), "test");
  }
}

test("pruneProtectedPublicBuild leaves public videos and previews alone when protection is disabled", async () => {
  const projectRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "protected-public-build-disabled-")
  );
  createPublicTree(projectRoot);

  const summary = await pruneProtectedPublicBuild({
    projectRoot,
    enabled: false,
  });

  assert.equal(summary.pruned, false);
  assert.deepEqual(summary.removedDirs, []);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "videos")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "previews")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "thumbnails")), true);
});

test("pruneProtectedPublicBuild removes only public videos and previews when protection is enabled", async () => {
  const projectRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "protected-public-build-enabled-")
  );
  createPublicTree(projectRoot);

  const summary = await pruneProtectedPublicBuild({
    projectRoot,
    enabled: true,
  });

  assert.equal(summary.pruned, true);
  assert.deepEqual(summary.removedDirs, ["public/videos", "public/previews"]);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "videos")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "previews")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "thumbnails")), true);
});
