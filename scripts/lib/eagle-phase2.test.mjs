import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  collectPhase2Targets,
  buildNameReviewEntries,
  createNameReviewArtifact,
  normalizeReviewProposal,
  parsePhase2CliArgs,
  tokenizeName,
} from "./eagle-phase2.mjs";

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
    fs.writeFileSync(
      path.join(infoDir, "metadata.json"),
      JSON.stringify(item.metadata, null, 2)
    );
    fs.writeFileSync(path.join(infoDir, item.mediaFile || `${item.id}.mp4`), "video");
    fs.writeFileSync(
      path.join(infoDir, item.thumbnailFile || `${item.id}_thumbnail.png`),
      "thumb"
    );
  }

  return root;
}

test("collectPhase2Targets keeps only uncategorized mp4 items", () => {
  const targets = collectPhase2Targets([
    { id: "A", ext: "mp4", folders: [], isDeleted: false },
    { id: "B", ext: "jpg", folders: [], isDeleted: false },
    { id: "C", ext: "mp4", folders: ["X"], isDeleted: false },
  ]);

  assert.deepEqual(targets.map((item) => item.id), ["A"]);
});

test("tokenizeName preserves review-allowlist tokens", () => {
  const tokens = tokenizeName("33원정대 2d pov pv 오브 손 발");

  assert.ok(tokens.includes("33원정대"));
  assert.ok(tokens.includes("2d"));
  assert.ok(tokens.includes("pov"));
  assert.ok(tokens.includes("pv"));
  assert.ok(tokens.includes("오브"));
  assert.ok(tokens.includes("손"));
  assert.ok(tokens.includes("발"));
});

test("normalizeReviewProposal strips repeat markers and parenthesized suffixes", () => {
  assert.equal(normalizeReviewProposal("게임 게임 승리 (2)"), "게임 승리");
});

test("buildNameReviewEntries flags repeated words and parenthesized sequence suffixes", () => {
  const entries = buildNameReviewEntries([
    { id: "A", name: "게임 게임 승리 (2)" },
    { id: "B", name: "게임 스타세일러 승리" },
  ]);

  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  assert.equal(byId.get("A").approved, false);
  assert.equal(byId.get("A").proposedName, "게임 승리");
  assert.match(byId.get("A").reason, /repeat|suffix|sequence/i);
});

test("buildNameReviewEntries flags series-consistency outliers in a shared prefix group", () => {
  const entries = buildNameReviewEntries([
    { id: "A", name: "게임 스타세일러 마법사 승리" },
    { id: "B", name: "게임 스타세일러 마법사 승리" },
    { id: "C", name: "게임 스타세일러 마법사 승리" },
    { id: "D", name: "게임 스타세일러 마볍사 승리" },
  ]);

  const outlier = entries.find((entry) => entry.id === "D");

  assert.ok(outlier);
  assert.equal(outlier.approved, false);
  assert.equal(outlier.proposedName, "게임 스타세일러 마법사 승리");
  assert.match(outlier.reason, /series/i);
});

test("buildNameReviewEntries flags rare-token near-match outliers", () => {
  const entries = buildNameReviewEntries([
    { id: "A", name: "게임 스타세일러 마법사 승리" },
    { id: "B", name: "게임 스타세일러 마법사 승리" },
    { id: "C", name: "게임 스타세일러 마법사 승리" },
    { id: "D", name: "게임 스타세일러 마볍사 승리" },
  ]);

  assert.equal(entries.some((entry) => entry.id === "D"), true);
});

test("createNameReviewArtifact writes the review contract files", () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "eagle-phase2-review-"));

  try {
    const artifact = createNameReviewArtifact({
      libraryPath: "/library/root",
      entries: [
        {
          id: "B",
          currentName: "게임 스타세일러 마법사 승리",
          proposedName: "게임 스타세일러 마법사 승리",
          reason: "token review",
          confidence: 0.5,
          approved: false,
        },
        {
          id: "A",
          currentName: "게임 스타세일러 마볍사 승리",
          proposedName: "게임 스타세일러 마법사 승리",
          reason: "series-consistency outlier",
          confidence: 0.9,
          approved: false,
        },
      ],
      targetCount: 2,
      outputDir,
    });

    const nameReview = JSON.parse(
      fs.readFileSync(path.join(outputDir, "name-review.json"), "utf8")
    );
    const markdown = fs.readFileSync(path.join(outputDir, "name-review.md"), "utf8");

    assert.equal(nameReview.summary.targetCount, 2);
    assert.equal(nameReview.summary.candidateCount, 2);
    assert.equal(nameReview.entries.every((entry) => entry.approved === false), true);
    assert.match(markdown, /\| id \| currentName \| proposedName \| reason \| confidence \| approved \|/);
    assert.ok(markdown.indexOf("| A |") < markdown.indexOf("| B |"));
    assert.equal(artifact.nameReviewJson.endsWith("name-review.json"), true);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test("parsePhase2CliArgs requires a review file for apply mode", () => {
  assert.throws(() => parsePhase2CliArgs(["apply"]), /--review-file/);
});

test("parsePhase2CliArgs returns help mode without side effects", () => {
  const result = parsePhase2CliArgs(["--help"]);

  assert.equal(result.mode, "help");
});

test("parsePhase2CliArgs prefers --library over env defaults", () => {
  const result = parsePhase2CliArgs(
    ["review", "--library", "/flag/library", "--timestamp", "2026-03-23T22-00-00-000Z"],
    {
      env: {
        EAGLE_LIBRARY_PATH: "/env/library",
      },
      homedir: () => "/home/tester",
      pathExists: () => true,
    }
  );

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
    assert.equal(targetSnapshot.summary.targetCount, 2);
    assert.match(targetSnapshot.entries[0].metadataPath, /ITEM1\.info\/metadata\.json$/);
    assert.deepEqual(
      targetSnapshot.entries.map((entry) => entry.id),
      ["ITEM1", "ITEM2"]
    );

    assert.equal(folderRuleReport.summary.targetCount, 2);
    assert.equal(folderRuleReport.summary.matchedAtLeastOneFolder, 2);

    const entryById = new Map(folderRuleReport.entries.map((entry) => [entry.id, entry]));
    assert.deepEqual([...entryById.keys()].sort(), ["ITEM1", "ITEM2"]);
    assert.deepEqual(
      entryById.get("ITEM1").matchedTokens.sort(),
      ["원신", "승리"].sort()
    );
    assert.equal(entryById.get("ITEM1").appliedFolderIds.length, 2);
    assert.equal(entryById.get("ITEM1").unresolvedTokens.length, 0);
    assert.deepEqual(entryById.get("ITEM2").matchedTokens, ["검"]);
    assert.equal(entryById.get("ITEM2").appliedFolderIds.length, 1);
    assert.equal(entryById.get("ITEM2").unresolvedTokens.length, 0);
  } finally {
    fs.rmSync(libraryPath, { recursive: true, force: true });
    removePhase2Artifacts(timestamp);
  }
});

test("eagle phase2 apply consumes a review file", () => {
  const timestamp = `apply-contract-${Date.now()}`;
  const reviewFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "eagle-phase2-review-")),
    "name-review.json"
  );

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
