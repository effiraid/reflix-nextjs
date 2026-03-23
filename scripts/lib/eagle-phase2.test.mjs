import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { parsePhase2CliArgs } from "../eagle-phase2.mjs";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..", "..");
const cliPath = path.join(projectRoot, "scripts", "eagle-phase2.mjs");

function runPhase2Cli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
  });
}

function removePhase2Artifacts(timestamp) {
  fs.rmSync(path.join(projectRoot, ".tmp", "eagle-phase2", timestamp), {
    recursive: true,
    force: true,
  });
  fs.rmSync(path.join(projectRoot, ".tmp", "eagle-phase2-backups", timestamp), {
    recursive: true,
    force: true,
  });
}

test("parsePhase2CliArgs requires a review file for apply mode", () => {
  assert.throws(() => parsePhase2CliArgs(["apply"]), /--review-file/);
});

test("parsePhase2CliArgs returns help mode without side effects", () => {
  const result = parsePhase2CliArgs(["--help"]);

  assert.equal(result.mode, "help");
});

test("parsePhase2CliArgs resolves review artifact defaults", () => {
  const result = parsePhase2CliArgs([
    "review",
    "--timestamp",
    "2026-03-23T22-00-00-000Z",
  ]);

  assert.equal(result.mode, "review");
  assert.equal(result.artifacts.reviewDir, ".tmp/eagle-phase2/2026-03-23T22-00-00-000Z/");
  assert.equal(
    result.artifacts.backupDir,
    ".tmp/eagle-phase2-backups/2026-03-23T22-00-00-000Z/"
  );
  assert.equal(
    result.artifacts.nameReviewJson,
    ".tmp/eagle-phase2/2026-03-23T22-00-00-000Z/name-review.json"
  );
  assert.equal(
    result.artifacts.targetSnapshotJson,
    ".tmp/eagle-phase2/2026-03-23T22-00-00-000Z/target-snapshot.json"
  );
  assert.equal(
    result.artifacts.folderRuleReportJson,
    ".tmp/eagle-phase2/2026-03-23T22-00-00-000Z/folder-rule-report.json"
  );
});

test("eagle phase2 help prints usage and avoids side effects", () => {
  const timestamp = `help-contract-${Date.now()}`;
  const reviewDir = path.join(projectRoot, ".tmp", "eagle-phase2", timestamp);
  const backupDir = path.join(projectRoot, ".tmp", "eagle-phase2-backups", timestamp);

  removePhase2Artifacts(timestamp);

  const result = runPhase2Cli([
    "--help",
    "--library",
    "/definitely/not/a/real/library",
    "--timestamp",
    timestamp,
  ]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.equal(fs.existsSync(reviewDir), false);
  assert.equal(fs.existsSync(backupDir), false);
});

test("eagle phase2 review writes stub artifacts", () => {
  const timestamp = `review-contract-${Date.now()}`;
  const reviewDir = path.join(projectRoot, ".tmp", "eagle-phase2", timestamp);
  const backupDir = path.join(projectRoot, ".tmp", "eagle-phase2-backups", timestamp);

  removePhase2Artifacts(timestamp);

  const result = runPhase2Cli(["review", "--timestamp", timestamp]);

  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(reviewDir), true);
  assert.equal(fs.existsSync(backupDir), true);
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(reviewDir, "name-review.json"), "utf8")));
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(reviewDir, "target-snapshot.json"), "utf8")));
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(reviewDir, "folder-rule-report.json"), "utf8")));
});

test("eagle phase2 apply consumes a review file", () => {
  const timestamp = `apply-contract-${Date.now()}`;
  const reviewFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "eagle-phase2-review-")), "name-review.json");

  fs.writeFileSync(reviewFile, JSON.stringify({ mode: "review" }));

  const result = runPhase2Cli([
    "apply",
    "--review-file",
    reviewFile,
    "--timestamp",
    timestamp,
  ]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /apply/i);
});
