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

test("parsePhase2CliArgs prefers --library over env defaults", () => {
  const result = parsePhase2CliArgs([
    "review",
    "--library",
    "/flag/library",
    "--timestamp",
    "2026-03-23T22-00-00-000Z",
  ], {
    env: {
      EAGLE_LIBRARY_PATH: "/env/library",
    },
    homedir: () => "/home/tester",
    pathExists: () => true,
  });

  assert.equal(result.mode, "review");
  assert.equal(result.libraryPath, "/flag/library");
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

test("parsePhase2CliArgs uses EAGLE_LIBRARY_PATH when flag is absent", () => {
  const result = parsePhase2CliArgs(["review"], {
    env: {
      EAGLE_LIBRARY_PATH: "/env/library",
    },
    homedir: () => "/home/tester",
    pathExists: () => false,
  });

  assert.equal(result.libraryPath, "/env/library");
});

test("parsePhase2CliArgs discovers the Desktop library from homedir", () => {
  const result = parsePhase2CliArgs(["review"], {
    env: {},
    homedir: () => "/home/tester",
    pathExists: (candidatePath) =>
      candidatePath === "/home/tester/Desktop/라이브러리/레퍼런스 - 게임,연출.library",
  });

  assert.equal(
    result.libraryPath,
    "/home/tester/Desktop/라이브러리/레퍼런스 - 게임,연출.library"
  );
});

test("parsePhase2CliArgs fails clearly when no library path can be resolved", () => {
  assert.throws(
    () =>
      parsePhase2CliArgs(["review"], {
        env: {},
        homedir: () => "/home/tester",
        pathExists: () => false,
      }),
    /--library|EAGLE_LIBRARY_PATH/
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

  const result = runPhase2Cli([
    "review",
    "--library",
    "/tmp/test-library",
    "--timestamp",
    timestamp,
  ]);

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

  fs.writeFileSync(reviewFile, JSON.stringify({ mode: "parsed-review-mode" }));

  const result = runPhase2Cli([
    "apply",
    "--review-file",
    reviewFile,
    "--library",
    "/tmp/test-library",
    "--timestamp",
    timestamp,
  ]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /parsed-review-mode/);
});
