import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { prunePublishedArtifacts } from "./published-artifacts.mjs";

function makeTempProject() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-published-artifacts-"));

  fs.mkdirSync(path.join(projectRoot, "public", "videos"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "previews"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "thumbnails"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "data", "clips"), { recursive: true });

  return projectRoot;
}

function writeManagedFiles(projectRoot, clipId) {
  fs.writeFileSync(path.join(projectRoot, "public", "videos", `${clipId}.mp4`), "video");
  fs.writeFileSync(path.join(projectRoot, "public", "previews", `${clipId}.mp4`), "preview");
  fs.writeFileSync(path.join(projectRoot, "public", "thumbnails", `${clipId}.webp`), "thumbnail");
  fs.writeFileSync(path.join(projectRoot, "public", "data", "clips", `${clipId}.json`), "{}");
}

test("prunePublishedArtifacts keeps managed files whose ids are in the keep set", async () => {
  const projectRoot = makeTempProject();
  writeManagedFiles(projectRoot, "KEEP001");

  const summary = await prunePublishedArtifacts({
    keepIds: ["KEEP001"],
    projectRoot,
  });

  assert.equal(summary.planned, 0);
  assert.equal(summary.removed, 0);
  assert.equal(summary.entries.length, 0);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "videos", "KEEP001.mp4")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "previews", "KEEP001.mp4")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "thumbnails", "KEEP001.webp")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "data", "clips", "KEEP001.json")), true);
});

test("prunePublishedArtifacts removes managed files outside the keep set", async () => {
  const projectRoot = makeTempProject();
  writeManagedFiles(projectRoot, "KEEP001");
  writeManagedFiles(projectRoot, "DROP001");

  const summary = await prunePublishedArtifacts({
    keepIds: ["KEEP001"],
    projectRoot,
  });

  assert.equal(summary.planned, 4);
  assert.equal(summary.removed, 4);
  assert.deepEqual(
    summary.entries.map((entry) => entry.relativePath).sort(),
    [
      "public/data/clips/DROP001.json",
      "public/previews/DROP001.mp4",
      "public/thumbnails/DROP001.webp",
      "public/videos/DROP001.mp4",
    ]
  );
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "videos", "KEEP001.mp4")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "videos", "DROP001.mp4")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "previews", "DROP001.mp4")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "thumbnails", "DROP001.webp")), false);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "data", "clips", "DROP001.json")), false);
});

test("prunePublishedArtifacts dry-run reports removals without deleting files", async () => {
  const projectRoot = makeTempProject();
  writeManagedFiles(projectRoot, "KEEP001");
  writeManagedFiles(projectRoot, "DROP001");

  const summary = await prunePublishedArtifacts({
    keepIds: ["KEEP001"],
    projectRoot,
    dryRun: true,
  });

  assert.equal(summary.planned, 4);
  assert.equal(summary.removed, 0);
  assert.equal(summary.entries.length, 4);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "videos", "DROP001.mp4")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "previews", "DROP001.mp4")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "thumbnails", "DROP001.webp")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "data", "clips", "DROP001.json")), true);
});
