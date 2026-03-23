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

function createTempEagleLibrary(items) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eagle-phase2-lib-"));
  const imagesDir = path.join(root, "images");
  fs.mkdirSync(imagesDir, { recursive: true });

  for (const item of items) {
    const infoDir = path.join(imagesDir, `${item.id}.info`);
    fs.mkdirSync(infoDir, { recursive: true });
    fs.writeFileSync(path.join(infoDir, "metadata.json"), JSON.stringify(item.metadata, null, 2));
    fs.writeFileSync(path.join(infoDir, item.mediaFile || `${item.id}.mp4`), "video");
    fs.writeFileSync(path.join(infoDir, item.thumbnailFile || `${item.id}_thumbnail.png`), "thumb");
  }

  return root;
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

test("eagle phase2 review writes real target and folder reports", () => {
  const timestamp = `review-contract-${Date.now()}`;
  const libraryPath = createTempEagleLibrary([
    {
      id: "ITEM1",
      metadata: {
        id: "ITEM1",
        name: "원신 승리",
        ext: "mp4",
        folders: [],
        tags: ["원신", "승리"],
      },
    },
    {
      id: "ITEM2",
      metadata: {
        id: "ITEM2",
        name: "검 레이아웃",
        ext: "mp4",
        folders: [],
        tags: ["검", "레이아웃"],
      },
    },
    {
      id: "ITEM3",
      metadata: {
        id: "ITEM3",
        name: "이미 분류됨",
        ext: "mp4",
        folders: ["SOME_FOLDER"],
        tags: ["이미", "분류됨"],
      },
    },
  ]);
  const reviewDir = path.join(projectRoot, ".tmp", "eagle-phase2", timestamp);
  const backupDir = path.join(projectRoot, ".tmp", "eagle-phase2-backups", timestamp);

  removePhase2Artifacts(timestamp);

  try {
    const result = runPhase2Cli([
      "review",
      "--library",
      libraryPath,
      "--timestamp",
      timestamp,
    ]);

    assert.equal(result.status, 0);
    assert.equal(fs.existsSync(reviewDir), true);
    assert.equal(fs.existsSync(backupDir), true);
    const nameReview = JSON.parse(
      fs.readFileSync(path.join(reviewDir, "name-review.json"), "utf8")
    );
    const targetSnapshot = JSON.parse(
      fs.readFileSync(path.join(reviewDir, "target-snapshot.json"), "utf8")
    );
    const folderRuleReport = JSON.parse(
      fs.readFileSync(path.join(reviewDir, "folder-rule-report.json"), "utf8")
    );

    assert.equal(nameReview.libraryPath, libraryPath);
    assert.equal(nameReview.summary.targetCount, 2);
    assert.deepEqual(nameReview.entries, []);
    assert.equal(targetSnapshot.summary.targetCount, 2);
    assert.deepEqual(
      targetSnapshot.entries.map((entry) => entry.id),
      ["ITEM1", "ITEM2"]
    );
    assert.equal(folderRuleReport.summary.targetCount, 2);
    assert.equal(folderRuleReport.summary.matchedAtLeastOneFolder, 2);
    assert.deepEqual(folderRuleReport.entries[0].matchedTokens, ["원신", "승리"]);
    assert.deepEqual(folderRuleReport.entries[0].appliedFolderIds, [
      "LBLQQF3DATC0J",
      "LE51CIF3FN5KM",
    ]);
    assert.deepEqual(folderRuleReport.entries[0].unresolvedTokens, []);
    assert.deepEqual(folderRuleReport.entries[1].matchedTokens, ["검"]);
    assert.deepEqual(folderRuleReport.entries[1].appliedFolderIds, ["L951YJXMED230"]);
    assert.deepEqual(folderRuleReport.entries[1].unresolvedTokens, []);
  } finally {
    fs.rmSync(libraryPath, { recursive: true, force: true });
    removePhase2Artifacts(timestamp);
  }
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
