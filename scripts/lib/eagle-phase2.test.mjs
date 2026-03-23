import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  applyApprovedRenames,
  collectPhase2Targets,
  buildNameReviewEntries,
  buildApplyMutation,
  createNameReviewArtifact,
  loadApprovedNameReview,
  normalizeReviewProposal,
  parsePhase2CliArgs,
  resolveFolderIds,
  runPhase2Apply,
  runPhase2Review,
  syncTagsFromName,
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

function runPhase2CliWithEnv(args, envOverrides) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      ...envOverrides,
    },
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

function readLibraryMetadata(libraryPath, id) {
  return JSON.parse(
    fs.readFileSync(path.join(libraryPath, "images", `${id}.info`, "metadata.json"), "utf8")
  );
}

function writeApprovedReviewFile({ libraryPath, entries }) {
  const reviewFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "eagle-phase2-approved-review-")),
    "name-review.json"
  );

  fs.writeFileSync(
    reviewFile,
    JSON.stringify(
      {
        libraryPath,
        generatedAt: "2026-03-24T00:00:00.000Z",
        summary: {
          targetCount: entries.length,
          candidateCount: entries.length,
        },
        entries,
      },
      null,
      2
    )
  );

  return reviewFile;
}

function createTempSymlink(targetPath) {
  const symlinkDir = fs.mkdtempSync(path.join(os.tmpdir(), "eagle-phase2-link-"));
  const symlinkPath = path.join(symlinkDir, "library-link.library");
  fs.symlinkSync(targetPath, symlinkPath);
  return {
    symlinkDir,
    symlinkPath,
  };
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

test("loadApprovedNameReview returns only approved entries", () => {
  const reviewFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "eagle-phase2-approved-")),
    "name-review.json"
  );

  try {
    fs.writeFileSync(
      reviewFile,
      JSON.stringify(
        {
          entries: [
            {
              id: "A",
              currentName: "원래 이름",
              proposedName: "새 이름",
              reason: "manual approval",
              confidence: 1,
              approved: true,
            },
            {
              id: "B",
              currentName: "원래 이름 2",
              proposedName: "무시",
              reason: "manual approval",
              confidence: 1,
              approved: false,
            },
          ],
        },
        null,
        2
      )
    );

    const result = loadApprovedNameReview(reviewFile);

    assert.deepEqual(result.approvedEntries.map((entry) => entry.id), ["A"]);
  } finally {
    fs.rmSync(path.dirname(reviewFile), { recursive: true, force: true });
  }
});

test("loadApprovedNameReview ignores stale approvedEntries when entries disagree", () => {
  const reviewFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "eagle-phase2-approved-precomputed-")),
    "name-review.json"
  );

  try {
    fs.writeFileSync(
      reviewFile,
      JSON.stringify(
        {
          entries: [
            {
              id: "A",
              currentName: "원래 이름",
              proposedName: "새 이름",
              reason: "manual approval",
              confidence: 1,
              approved: false,
            },
          ],
          approvedEntries: [
            {
              id: "A",
              currentName: "원래 이름",
              proposedName: "stale override",
              reason: "manual approval",
              confidence: 1,
              approved: true,
            },
            {
              id: "B",
              currentName: "원래 이름 2",
              proposedName: "stale override 2",
              reason: "manual approval",
              confidence: 1,
              approved: true,
            },
          ],
        },
        null,
        2
      )
    );

    const result = loadApprovedNameReview(reviewFile);

    assert.deepEqual(result.approvedEntries, []);
  } finally {
    fs.rmSync(path.dirname(reviewFile), { recursive: true, force: true });
  }
});

test("loadApprovedNameReview rejects non-review artifacts", () => {
  const reviewFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "eagle-phase2-non-review-")),
    "folder-rule-report.json"
  );

  try {
    fs.writeFileSync(
      reviewFile,
      JSON.stringify(
        {
          libraryPath: "/library",
          generatedAt: "2026-03-24T00:00:00.000Z",
          summary: {
            targetCount: 1,
          },
          entries: [
            {
              id: "ITEM1",
              tokens: ["검"],
              matchedTokens: ["검"],
              appliedFolderIds: ["L951YJXMED230"],
              unresolvedTokens: [],
            },
          ],
        },
        null,
        2
      )
    );

    assert.throws(() => loadApprovedNameReview(reviewFile), /invalid name review/i);
  } finally {
    fs.rmSync(path.dirname(reviewFile), { recursive: true, force: true });
  }
});

test("loadApprovedNameReview rejects duplicate approved entries from disk", () => {
  const reviewFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "eagle-phase2-approved-duplicate-")),
    "name-review.json"
  );

  try {
    fs.writeFileSync(
      reviewFile,
      JSON.stringify(
        {
          entries: [
            {
              id: "A",
              currentName: "원래 이름",
              proposedName: "첫 번째",
              reason: "manual approval",
              confidence: 1,
              approved: true,
            },
            {
              id: "A",
              currentName: "원래 이름",
              proposedName: "두 번째",
              reason: "manual approval",
              confidence: 1,
              approved: true,
            },
          ],
        },
        null,
        2
      )
    );

    assert.throws(() => loadApprovedNameReview(reviewFile), /duplicate approved rename entries/i);
  } finally {
    fs.rmSync(path.dirname(reviewFile), { recursive: true, force: true });
  }
});

test("applyApprovedRenames rejects duplicate approved entries for the same item id", () => {
  assert.throws(
    () =>
      applyApprovedRenames(
        { id: "A", name: "원래 이름" },
        [
          { id: "A", approved: true, proposedName: "첫 번째" },
          { id: "A", approved: true, proposedName: "두 번째" },
        ]
      ),
    /duplicate approved rename entries/i
  );
});

test("applyApprovedRenames rejects unsupported review object shapes", () => {
  assert.throws(
    () =>
      applyApprovedRenames(
        { id: "A", name: "원래 이름" },
        { entries: [{ id: "A", approved: true, proposedName: "적용 이름" }] }
      ),
    /approvedEntries array/i
  );
});

test("applyApprovedRenames only applies approved rename entries", () => {
  const result = applyApprovedRenames(
    { id: "A", name: "원래 이름" },
    [
      { id: "A", approved: false, proposedName: "무시" },
      { id: "A", approved: true, proposedName: "적용 이름" },
    ]
  );

  assert.equal(result.name, "적용 이름");
  assert.equal(result.renameApplied, true);
});

test("applyApprovedRenames preserves the original name when approved rename is a trim-only no-op", () => {
  const result = applyApprovedRenames(
    { id: "A", name: "  원래 이름  " },
    [{ id: "A", approved: true, proposedName: "원래 이름 " }]
  );

  assert.equal(result.name, "  원래 이름  ");
  assert.equal(result.renameApplied, false);
});

test("syncTagsFromName keeps the options parameter in the public API", () => {
  assert.equal(syncTagsFromName.length, 2);
});

test("syncTagsFromName excludes numeric-only tokens and keeps allowlisted tokens", () => {
  const result = syncTagsFromName("33원정대 2d pov pv 오브 손 발 게임 스타세일러 스킬 2 (2)");

  assert.deepEqual(result.tags, ["33원정대", "2d", "pov", "pv", "오브", "손", "발", "게임", "스타세일러", "스킬"]);
  assert.deepEqual(result.excludedNumericTokens, ["2", "(2)"]);
});

test("resolveFolderIds returns only explicit rule ids and tracks unresolved tokens", () => {
  const result = resolveFolderIds(["검", "미확인", "승리"], {
    ignoredTokens: ["게임"],
    rules: {
      검: { folderIds: ["L951YJXMED230"] },
      승리: { folderIds: ["LE51CIF3FN5KM"] },
    },
  });

  assert.deepEqual(result.folderIds, ["L951YJXMED230", "LE51CIF3FN5KM"]);
  assert.deepEqual(result.unresolvedTokens, ["미확인"]);
  assert.equal(result.lossyTagSync, true);
});

test("eagle phase2 review and apply agree on folder token resolution for numeric noise", () => {
  const timestamp = `review-contract-${Date.now()}-${randomUUID()}`;
  const libraryPath = createTempEagleLibrary([
    {
      id: "ITEM1",
      metadata: {
        id: "ITEM1",
        name: "게임 2 검 (2)",
        ext: "mp4",
        folders: [],
        tags: ["게임", "2", "검", "(2)"],
      },
    },
  ]);
  const reviewDir = path.join(projectRoot, ".tmp", "eagle-phase2", timestamp);
  const backupDir = path.join(projectRoot, ".tmp", "eagle-phase2-backups", timestamp);

  removePhase2Artifacts(timestamp);

  try {
    const reviewResult = runPhase2Cli([
      "review",
      "--library",
      libraryPath,
      "--timestamp",
      timestamp,
    ]);

    assert.equal(reviewResult.status, 0);

    const folderRuleReport = JSON.parse(
      fs.readFileSync(path.join(reviewDir, "folder-rule-report.json"), "utf8")
    );
    const entry = folderRuleReport.entries.find((candidate) => candidate.id === "ITEM1");
    const applyResult = buildApplyMutation(
      { id: "ITEM1", name: "게임 2 검 (2)", tags: ["게임", "2", "검", "(2)"], folders: [] },
      [{ id: "ITEM1", approved: true, proposedName: "게임 2 검 (2)" }],
      {
        ignoredTokens: ["게임", "연출", "전투", "레이아웃"],
        rules: {
          검: { folderIds: ["L951YJXMED230"] },
        },
      }
    );

    assert.deepEqual(entry.matchedTokens, applyResult.matchedTokens);
    assert.deepEqual(entry.unresolvedTokens, applyResult.unresolvedTokens);
  } finally {
    fs.rmSync(libraryPath, { recursive: true, force: true });
    removePhase2Artifacts(timestamp);
    fs.rmSync(reviewDir, { recursive: true, force: true });
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});

test("buildApplyMutation combines approved renames, tag sync, and folder resolution", () => {
  const result = buildApplyMutation(
    { id: "A", name: "게임 검 미확인 2 (2)", tags: ["old"], folders: [] },
    [{ id: "A", approved: true, proposedName: "검 미확인" }],
    {
      ignoredTokens: ["게임"],
      rules: {
        검: { folderIds: ["L951YJXMED230"] },
      },
    }
  );

  assert.equal(result.name, "검 미확인");
  assert.deepEqual(result.tags, ["검", "미확인"]);
  assert.deepEqual(result.folders, ["L951YJXMED230"]);
  assert.deepEqual(result.unresolvedTokens, ["미확인"]);
  assert.equal(result.lossyTagSync, true);
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

test("buildNameReviewEntries flags rare-token near-match outliers without series overlap", () => {
  const entries = buildNameReviewEntries([
    { id: "A", name: "게임 스타세일러 마법사 승리" },
    { id: "B", name: "게임 스타세일러 마법사 승리" },
    { id: "C", name: "게임 스타세일러 마법사 승리" },
    { id: "D", name: "다른 유니크 마볍사 승리" },
  ]);

  assert.equal(entries.length, 1);

  const entry = entries[0];

  assert.equal(entry.id, "D");
  assert.equal(entry.reason, "rare-token near-match");
  assert.equal(entry.proposedName, "다른 유니크 마법사 승리");
  assert.equal(entry.approved, false);
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
  assert.throws(
    () =>
      parsePhase2CliArgs(["apply"], {
        pathExists: () => {
          throw new Error("library resolution should not run before review-file validation");
        },
      }),
    /--review-file/
  );
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
  const timestamp = `help-contract-${Date.now()}-${randomUUID()}`;
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

test("runPhase2Review writes name review markdown/json and companion reports to disk", () => {
  const timestamp = `review-orchestration-${Date.now()}-${randomUUID()}`;
  const libraryPath = createTempEagleLibrary([
    {
      id: "ITEM1",
      metadata: {
        id: "ITEM1",
        name: "게임 게임 승리 (2)",
        ext: "mp4",
        folders: [],
        tags: ["게임", "승리"],
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
  ]);
  const parsed = parsePhase2CliArgs(["review", "--library", libraryPath, "--timestamp", timestamp]);
  const reviewDir = path.join(projectRoot, ".tmp", "eagle-phase2", timestamp);

  removePhase2Artifacts(timestamp);

  try {
    const result = runPhase2Review(parsed);

    assert.equal(fs.existsSync(path.join(reviewDir, "name-review.md")), true);
    assert.equal(fs.existsSync(path.join(reviewDir, "name-review.json")), true);
    assert.equal(fs.existsSync(path.join(reviewDir, "target-snapshot.json")), true);
    assert.equal(fs.existsSync(path.join(reviewDir, "folder-rule-report.json")), true);
    assert.equal(result.nameReviewJson, path.join(reviewDir, "name-review.json"));
    assert.equal(result.targetSnapshotJson, path.join(reviewDir, "target-snapshot.json"));
    assert.equal(result.folderRuleReportJson, path.join(reviewDir, "folder-rule-report.json"));
  } finally {
    fs.rmSync(libraryPath, { recursive: true, force: true });
    removePhase2Artifacts(timestamp);
  }
});

test("runPhase2Review CLI prints the review summary contract", () => {
  const timestamp = `review-cli-${Date.now()}-${randomUUID()}`;
  const libraryPath = createTempEagleLibrary([
    {
      id: "ITEM1",
      metadata: {
        id: "ITEM1",
        name: "게임 게임 승리 (2)",
        ext: "mp4",
        folders: [],
        tags: ["게임", "승리"],
      },
    },
  ]);

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
    assert.match(result.stdout, new RegExp(`📂 Eagle Library: ${libraryPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.match(result.stdout, /📝 Mode: review/);
    assert.match(result.stdout, /🧾 name-review\.json: .*name-review\.json/);
  } finally {
    fs.rmSync(libraryPath, { recursive: true, force: true });
    removePhase2Artifacts(timestamp);
  }
});

test("eagle phase2 review writes real target and folder reports", () => {
  const timestamp = `review-contract-${Date.now()}-${randomUUID()}`;
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
    assert.deepEqual(
      targetSnapshot.entries.map((entry) => entry.id),
      ["ITEM1", "ITEM2"]
    );
    const targetById = new Map(targetSnapshot.entries.map((entry) => [entry.id, entry]));
    assert.match(targetById.get("ITEM1").metadataPath, /ITEM1\.info\/metadata\.json$/);

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

test("eagle phase2 apply aborts when the review file points at another library", () => {
  const timestamp = `apply-library-mismatch-${Date.now()}-${randomUUID()}`;
  const reviewLibraryPath = createTempEagleLibrary([
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
  ]);
  const targetLibraryPath = createTempEagleLibrary([
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
  ]);
  const reviewFile = writeApprovedReviewFile({
    libraryPath: reviewLibraryPath,
    entries: [
      {
        id: "ITEM1",
        currentName: "원신 승리",
        proposedName: "원신 검",
        reason: "manual approval",
        confidence: 1,
        approved: true,
      },
    ],
  });
  const targetMetadataPath = path.join(
    targetLibraryPath,
    "images",
    "ITEM1.info",
    "metadata.json"
  );
  const originalTargetMetadata = fs.readFileSync(targetMetadataPath, "utf8");

  removePhase2Artifacts(timestamp);

  try {
    const result = runPhase2Cli([
      "apply",
      "--review-file",
      reviewFile,
      "--library",
      targetLibraryPath,
      "--timestamp",
      timestamp,
    ]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /libraryPath does not match target library path/);
    assert.equal(
      fs.existsSync(path.join(projectRoot, ".tmp", "eagle-phase2", timestamp, "apply-report.json")),
      false
    );
    assert.equal(
      fs.existsSync(path.join(projectRoot, ".tmp", "eagle-phase2-backups", timestamp)),
      false
    );
    assert.equal(fs.readFileSync(targetMetadataPath, "utf8"), originalTargetMetadata);
  } finally {
    fs.rmSync(path.dirname(reviewFile), { recursive: true, force: true });
    fs.rmSync(reviewLibraryPath, { recursive: true, force: true });
    fs.rmSync(targetLibraryPath, { recursive: true, force: true });
    removePhase2Artifacts(timestamp);
  }
});

test("runPhase2Apply accepts review files that spell the same library through a symlink path", () => {
  const timestamp = `apply-canonical-library-${Date.now()}-${randomUUID()}`;
  const libraryPath = createTempEagleLibrary([
    {
      id: "ITEM1",
      metadata: {
        id: "ITEM1",
        name: "원신 승리",
        ext: "mp4",
        folders: [],
        tags: ["legacy"],
      },
    },
  ]);
  const { symlinkDir, symlinkPath } = createTempSymlink(libraryPath);
  const reviewFile = writeApprovedReviewFile({
    libraryPath: `${symlinkPath}${path.sep}`,
    entries: [
      {
        id: "ITEM1",
        currentName: "원신 승리",
        proposedName: "원신 검",
        reason: "manual approval",
        confidence: 1,
        approved: true,
      },
    ],
  });
  const parsed = parsePhase2CliArgs([
    "apply",
    "--review-file",
    reviewFile,
    "--library",
    libraryPath,
    "--timestamp",
    timestamp,
  ]);

  removePhase2Artifacts(timestamp);

  try {
    const result = runPhase2Apply(parsed);

    assert.equal(result.summary.failureCount, 0);
    assert.equal(result.summary.aborted, false);
    assert.equal(readLibraryMetadata(libraryPath, "ITEM1").name, "원신 검");
  } finally {
    fs.rmSync(path.dirname(reviewFile), { recursive: true, force: true });
    fs.rmSync(symlinkDir, { recursive: true, force: true });
    fs.rmSync(libraryPath, { recursive: true, force: true });
    removePhase2Artifacts(timestamp);
  }
});

test("runPhase2Apply backs up metadata before mutation and writes apply-report.json", () => {
  const timestamp = `apply-orchestration-${Date.now()}-${randomUUID()}`;
  const libraryPath = createTempEagleLibrary([
    {
      id: "ITEM1",
      metadata: {
        id: "ITEM1",
        name: "원신 승리",
        ext: "mp4",
        folders: [],
        tags: ["legacy"],
      },
    },
  ]);
  const reviewFile = writeApprovedReviewFile({
    libraryPath,
    entries: [
      {
        id: "ITEM1",
        currentName: "원신 승리",
        proposedName: "원신 검",
        reason: "manual approval",
        confidence: 1,
        approved: true,
      },
    ],
  });
  const parsed = parsePhase2CliArgs([
    "apply",
    "--review-file",
    reviewFile,
    "--library",
    libraryPath,
    "--timestamp",
    timestamp,
  ]);
  const applyDir = path.join(projectRoot, ".tmp", "eagle-phase2", timestamp);

  removePhase2Artifacts(timestamp);

  try {
    const result = runPhase2Apply(parsed);
    const metadata = readLibraryMetadata(libraryPath, "ITEM1");
    const report = JSON.parse(
      fs.readFileSync(path.join(applyDir, "apply-report.json"), "utf8")
    );

    assert.equal(fs.existsSync(result.entries[0].backupPath), true);
    assert.equal(result.entries[0].status, "success");
    assert.equal(metadata.name, "원신 검");
    assert.deepEqual(metadata.tags, ["원신", "검"]);
    assert.deepEqual(metadata.folders, ["LBLQQF3DATC0J", "L951YJXMED230"]);
    assert.equal(report.summary.approvedCount, 1);
    assert.equal(report.summary.processedCount, 1);
    assert.equal(report.summary.successCount, 1);
    assert.equal(report.summary.failureCount, 0);
    assert.equal(report.summary.aborted, false);
  } finally {
    fs.rmSync(path.dirname(reviewFile), { recursive: true, force: true });
    fs.rmSync(libraryPath, { recursive: true, force: true });
    removePhase2Artifacts(timestamp);
  }
});

test("runPhase2Apply writes metadata through a temp file and rename instead of in-place overwrite", () => {
  const timestamp = `apply-atomic-metadata-${Date.now()}-${randomUUID()}`;
  const libraryPath = createTempEagleLibrary([
    {
      id: "ITEM1",
      metadata: {
        id: "ITEM1",
        name: "원신 승리",
        ext: "mp4",
        folders: [],
        tags: ["legacy"],
      },
    },
  ]);
  const reviewFile = writeApprovedReviewFile({
    libraryPath,
    entries: [
      {
        id: "ITEM1",
        currentName: "원신 승리",
        proposedName: "원신 검",
        reason: "manual approval",
        confidence: 1,
        approved: true,
      },
    ],
  });
  const parsed = parsePhase2CliArgs([
    "apply",
    "--review-file",
    reviewFile,
    "--library",
    libraryPath,
    "--timestamp",
    timestamp,
  ]);
  const metadataPath = path.join(libraryPath, "images", "ITEM1.info", "metadata.json");
  const metadataTempPath = `${metadataPath}.tmp`;
  const originalWriteFileSync = fs.writeFileSync;
  const originalRenameSync = fs.renameSync;
  const renameCalls = [];

  removePhase2Artifacts(timestamp);

  try {
    fs.writeFileSync = (targetPath, data, options) => {
      if (targetPath === metadataPath) {
        throw new Error("metadata was overwritten in place");
      }

      return originalWriteFileSync(targetPath, data, options);
    };
    fs.renameSync = (fromPath, toPath) => {
      renameCalls.push([String(fromPath), String(toPath)]);
      return originalRenameSync(fromPath, toPath);
    };

    const result = runPhase2Apply(parsed);

    assert.equal(result.entries[0].status, "success");
    assert.equal(readLibraryMetadata(libraryPath, "ITEM1").name, "원신 검");
    assert.deepEqual(
      renameCalls.filter(([fromPath, toPath]) => fromPath === metadataTempPath && toPath === metadataPath),
      [[metadataTempPath, metadataPath]]
    );
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    fs.renameSync = originalRenameSync;
    fs.rmSync(path.dirname(reviewFile), { recursive: true, force: true });
    fs.rmSync(libraryPath, { recursive: true, force: true });
    removePhase2Artifacts(timestamp);
  }
});

test("runPhase2Apply fails closed when the live item name drifted after review", () => {
  const timestamp = `apply-drift-${Date.now()}-${randomUUID()}`;
  const libraryPath = createTempEagleLibrary([
    {
      id: "ITEM1",
      metadata: {
        id: "ITEM1",
        name: "리뷰 이후 바뀐 이름",
        ext: "mp4",
        folders: [],
        tags: ["legacy"],
      },
    },
  ]);
  const reviewFile = writeApprovedReviewFile({
    libraryPath,
    entries: [
      {
        id: "ITEM1",
        currentName: "원신 승리",
        proposedName: "원신 검",
        reason: "manual approval",
        confidence: 1,
        approved: true,
      },
    ],
  });
  const parsed = parsePhase2CliArgs([
    "apply",
    "--review-file",
    reviewFile,
    "--library",
    libraryPath,
    "--timestamp",
    timestamp,
  ]);
  const metadataPath = path.join(libraryPath, "images", "ITEM1.info", "metadata.json");
  const originalMetadata = fs.readFileSync(metadataPath, "utf8");

  removePhase2Artifacts(timestamp);

  try {
    const result = runPhase2Apply(parsed);

    assert.equal(result.summary.failureCount, 1);
    assert.equal(result.entries[0].status, "failed");
    assert.match(result.entries[0].error, /live item name no longer matches review currentName/i);
    assert.equal(fs.existsSync(result.entries[0].backupPath), false);
    assert.equal(fs.readFileSync(metadataPath, "utf8"), originalMetadata);
  } finally {
    fs.rmSync(path.dirname(reviewFile), { recursive: true, force: true });
    fs.rmSync(libraryPath, { recursive: true, force: true });
    removePhase2Artifacts(timestamp);
  }
});

test("runPhase2Apply restores the original metadata when an item write fails", () => {
  const timestamp = `apply-restore-${Date.now()}-${randomUUID()}`;
  const libraryPath = createTempEagleLibrary([
    {
      id: "ITEM1",
      metadata: {
        id: "ITEM1",
        name: "원신 승리",
        ext: "mp4",
        folders: [],
        tags: ["legacy"],
      },
    },
  ]);
  const reviewFile = writeApprovedReviewFile({
    libraryPath,
    entries: [
      {
        id: "ITEM1",
        currentName: "원신 승리",
        proposedName: "원신 검",
        reason: "manual approval",
        confidence: 1,
        approved: true,
      },
    ],
  });
  const parsed = parsePhase2CliArgs([
    "apply",
    "--review-file",
    reviewFile,
    "--library",
    libraryPath,
    "--timestamp",
    timestamp,
  ]);
  const metadataPath = path.join(libraryPath, "images", "ITEM1.info", "metadata.json");
  const metadataTempPath = `${metadataPath}.tmp`;
  const originalMetadata = fs.readFileSync(metadataPath, "utf8");
  const originalWriteFileSync = fs.writeFileSync;
  let injectedFailure = false;

  removePhase2Artifacts(timestamp);

  try {
    fs.writeFileSync = (targetPath, data, options) => {
      if (!injectedFailure && targetPath === metadataTempPath) {
        injectedFailure = true;
        originalWriteFileSync(targetPath, '{"broken":', options);
        throw new Error("simulated metadata write failure");
      }

      return originalWriteFileSync(targetPath, data, options);
    };

    const result = runPhase2Apply(parsed);
    const metadata = fs.readFileSync(metadataPath, "utf8");

    assert.equal(result.entries[0].status, "failed");
    assert.match(result.entries[0].error, /simulated metadata write failure/);
    assert.equal(metadata, originalMetadata);
    assert.equal(fs.existsSync(result.entries[0].backupPath), true);
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    fs.rmSync(path.dirname(reviewFile), { recursive: true, force: true });
    fs.rmSync(libraryPath, { recursive: true, force: true });
    removePhase2Artifacts(timestamp);
  }
});

test("runPhase2Apply reruns skip prior successes without consuming the abort threshold", () => {
  const firstTimestamp = `apply-rerun-first-${Date.now()}-${randomUUID()}`;
  const secondTimestamp = `apply-rerun-second-${Date.now()}-${randomUUID()}`;
  const libraryPath = createTempEagleLibrary(
    ["ITEM1", "ITEM2", "ITEM3", "ITEM4", "ITEM5"].map((id) => ({
      id,
      metadata: {
        id,
        name: "원신 승리",
        ext: "mp4",
        folders: [],
        tags: ["legacy"],
      },
    }))
  );
  const reviewFile = writeApprovedReviewFile({
    libraryPath,
    entries: ["ITEM1", "ITEM2", "ITEM3", "ITEM4", "ITEM5"].map((id) => ({
      id,
      currentName: "원신 승리",
      proposedName: "원신 검",
      reason: "manual approval",
      confidence: 1,
      approved: true,
    })),
  });
  const firstParsed = parsePhase2CliArgs([
    "apply",
    "--review-file",
    reviewFile,
    "--library",
    libraryPath,
    "--timestamp",
    firstTimestamp,
  ]);
  const secondParsed = parsePhase2CliArgs([
    "apply",
    "--review-file",
    reviewFile,
    "--library",
    libraryPath,
    "--timestamp",
    secondTimestamp,
  ]);
  const originalWriteFileSync = fs.writeFileSync;
  const firstRunFailures = new Set([
    `${path.join(libraryPath, "images", "ITEM2.info", "metadata.json")}.tmp`,
    `${path.join(libraryPath, "images", "ITEM3.info", "metadata.json")}.tmp`,
    `${path.join(libraryPath, "images", "ITEM4.info", "metadata.json")}.tmp`,
  ]);
  const secondRunFailures = new Set([
    `${path.join(libraryPath, "images", "ITEM2.info", "metadata.json")}.tmp`,
    `${path.join(libraryPath, "images", "ITEM3.info", "metadata.json")}.tmp`,
  ]);
  const failedPaths = new Set();

  removePhase2Artifacts(firstTimestamp);
  removePhase2Artifacts(secondTimestamp);

  try {
    fs.writeFileSync = (targetPath, data, options) => {
      if (firstRunFailures.has(targetPath) && !failedPaths.has(`first:${targetPath}`)) {
        failedPaths.add(`first:${targetPath}`);
        originalWriteFileSync(targetPath, '{"broken":', options);
        throw new Error(`first run failure for ${path.basename(path.dirname(targetPath))}`);
      }

      return originalWriteFileSync(targetPath, data, options);
    };

    const firstResult = runPhase2Apply(firstParsed);

    assert.equal(firstResult.summary.aborted, true);
    assert.equal(readLibraryMetadata(libraryPath, "ITEM1").name, "원신 검");
    assert.equal(readLibraryMetadata(libraryPath, "ITEM5").name, "원신 승리");

    fs.writeFileSync = (targetPath, data, options) => {
      if (secondRunFailures.has(targetPath) && !failedPaths.has(`second:${targetPath}`)) {
        failedPaths.add(`second:${targetPath}`);
        originalWriteFileSync(targetPath, '{"broken":', options);
        throw new Error(`second run failure for ${path.basename(path.dirname(targetPath))}`);
      }

      return originalWriteFileSync(targetPath, data, options);
    };

    const secondResult = runPhase2Apply(secondParsed);

    assert.equal(secondResult.summary.aborted, false);
    assert.deepEqual(
      secondResult.entries.map((entry) => [entry.id, entry.status]),
      [
        ["ITEM1", "skipped"],
        ["ITEM2", "failed"],
        ["ITEM3", "failed"],
        ["ITEM4", "success"],
        ["ITEM5", "success"],
      ]
    );
    assert.equal(readLibraryMetadata(libraryPath, "ITEM4").name, "원신 검");
    assert.equal(readLibraryMetadata(libraryPath, "ITEM5").name, "원신 검");
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    fs.rmSync(path.dirname(reviewFile), { recursive: true, force: true });
    fs.rmSync(libraryPath, { recursive: true, force: true });
    removePhase2Artifacts(firstTimestamp);
    removePhase2Artifacts(secondTimestamp);
  }
});

test("runPhase2Apply aborts after three consecutive write failures and preserves backups", () => {
  const timestamp = `apply-abort-${Date.now()}-${randomUUID()}`;
  const libraryPath = createTempEagleLibrary([
    {
      id: "ITEM1",
      metadata: {
        id: "ITEM1",
        name: "원신 승리",
        ext: "mp4",
        folders: [],
        tags: ["legacy"],
      },
    },
    {
      id: "ITEM2",
      metadata: {
        id: "ITEM2",
        name: "원신 승리",
        ext: "mp4",
        folders: [],
        tags: ["legacy"],
      },
    },
    {
      id: "ITEM3",
      metadata: {
        id: "ITEM3",
        name: "원신 승리",
        ext: "mp4",
        folders: [],
        tags: ["legacy"],
      },
    },
    {
      id: "ITEM4",
      metadata: {
        id: "ITEM4",
        name: "원신 승리",
        ext: "mp4",
        folders: [],
        tags: ["legacy"],
      },
    },
    {
      id: "ITEM5",
      metadata: {
        id: "ITEM5",
        name: "원신 승리",
        ext: "mp4",
        folders: [],
        tags: ["legacy"],
      },
    },
  ]);
  const reviewFile = writeApprovedReviewFile({
    libraryPath,
    entries: ["ITEM1", "ITEM2", "ITEM3", "ITEM4", "ITEM5"].map((id) => ({
      id,
      currentName: "원신 승리",
      proposedName: "원신 검",
      reason: "manual approval",
      confidence: 1,
      approved: true,
    })),
  });
  const parsed = parsePhase2CliArgs([
    "apply",
    "--review-file",
    reviewFile,
    "--library",
    libraryPath,
    "--timestamp",
    timestamp,
  ]);
  const failingMetadataPaths = new Set([
    `${path.join(libraryPath, "images", "ITEM2.info", "metadata.json")}.tmp`,
    `${path.join(libraryPath, "images", "ITEM3.info", "metadata.json")}.tmp`,
    `${path.join(libraryPath, "images", "ITEM4.info", "metadata.json")}.tmp`,
  ]);
  const originalWriteFileSync = fs.writeFileSync;
  const failedPaths = new Set();

  removePhase2Artifacts(timestamp);

  try {
    fs.writeFileSync = (targetPath, data, options) => {
      if (failingMetadataPaths.has(targetPath) && !failedPaths.has(targetPath)) {
        failedPaths.add(targetPath);
        originalWriteFileSync(targetPath, '{"broken":', options);
        throw new Error(`simulated metadata write failure for ${path.basename(path.dirname(targetPath))}`);
      }

      return originalWriteFileSync(targetPath, data, options);
    };

    const result = runPhase2Apply(parsed);
    const report = JSON.parse(
      fs.readFileSync(path.join(projectRoot, ".tmp", "eagle-phase2", timestamp, "apply-report.json"), "utf8")
    );

    assert.equal(result.summary.aborted, true);
    assert.equal(result.summary.processedCount, 4);
    assert.equal(result.summary.successCount, 1);
    assert.equal(result.summary.failureCount, 3);
    assert.deepEqual(
      result.entries.map((entry) => [entry.id, entry.status]),
      [
        ["ITEM1", "success"],
        ["ITEM2", "failed"],
        ["ITEM3", "failed"],
        ["ITEM4", "failed"],
      ]
    );
    assert.equal(readLibraryMetadata(libraryPath, "ITEM1").name, "원신 검");
    assert.equal(readLibraryMetadata(libraryPath, "ITEM2").name, "원신 승리");
    assert.equal(readLibraryMetadata(libraryPath, "ITEM3").name, "원신 승리");
    assert.equal(readLibraryMetadata(libraryPath, "ITEM4").name, "원신 승리");
    assert.equal(readLibraryMetadata(libraryPath, "ITEM5").name, "원신 승리");
    assert.equal(result.entries.every((entry) => fs.existsSync(entry.backupPath)), true);
    assert.equal(
      fs.existsSync(path.join(projectRoot, ".tmp", "eagle-phase2-backups", timestamp, "ITEM5-metadata.json")),
      false
    );
    assert.equal(report.summary.aborted, true);
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    fs.rmSync(path.dirname(reviewFile), { recursive: true, force: true });
    fs.rmSync(libraryPath, { recursive: true, force: true });
    removePhase2Artifacts(timestamp);
  }
});

test("runPhase2Apply keeps a durable apply report on disk when a late report write fails", () => {
  const timestamp = `apply-report-durable-${Date.now()}-${randomUUID()}`;
  const libraryPath = createTempEagleLibrary([
    {
      id: "ITEM1",
      metadata: {
        id: "ITEM1",
        name: "원신 승리",
        ext: "mp4",
        folders: [],
        tags: ["legacy"],
      },
    },
    {
      id: "ITEM2",
      metadata: {
        id: "ITEM2",
        name: "원신 승리",
        ext: "mp4",
        folders: [],
        tags: ["legacy"],
      },
    },
  ]);
  const reviewFile = writeApprovedReviewFile({
    libraryPath,
    entries: ["ITEM1", "ITEM2"].map((id) => ({
      id,
      currentName: "원신 승리",
      proposedName: "원신 검",
      reason: "manual approval",
      confidence: 1,
      approved: true,
    })),
  });
  const parsed = parsePhase2CliArgs([
    "apply",
    "--review-file",
    reviewFile,
    "--library",
    libraryPath,
    "--timestamp",
    timestamp,
  ]);
  const applyReportJson = path.join(projectRoot, ".tmp", "eagle-phase2", timestamp, "apply-report.json");
  const originalWriteFileSync = fs.writeFileSync;
  let reportWriteCount = 0;

  removePhase2Artifacts(timestamp);

  try {
    fs.writeFileSync = (targetPath, data, options) => {
      if (String(targetPath).includes("apply-report.json.tmp")) {
        reportWriteCount += 1;
        if (reportWriteCount === 3) {
          throw new Error("simulated apply report write failure");
        }
      }

      return originalWriteFileSync(targetPath, data, options);
    };

    assert.throws(
      () => runPhase2Apply(parsed),
      /simulated apply report write failure/
    );

    const durableReport = JSON.parse(fs.readFileSync(applyReportJson, "utf8"));

    assert.equal(readLibraryMetadata(libraryPath, "ITEM1").name, "원신 검");
    assert.equal(readLibraryMetadata(libraryPath, "ITEM2").name, "원신 검");
    assert.equal(durableReport.summary.processedCount, 1);
    assert.deepEqual(
      durableReport.entries.map((entry) => [entry.id, entry.status]),
      [["ITEM1", "success"]]
    );
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    fs.rmSync(path.dirname(reviewFile), { recursive: true, force: true });
    fs.rmSync(libraryPath, { recursive: true, force: true });
    removePhase2Artifacts(timestamp);
  }
});

test("runPhase2Apply CLI reports the durable partial apply report path when report persistence fails", () => {
  const timestamp = `apply-cli-report-failure-${Date.now()}-${randomUUID()}`;
  const libraryPath = createTempEagleLibrary([
    {
      id: "ITEM1",
      metadata: {
        id: "ITEM1",
        name: "원신 승리",
        ext: "mp4",
        folders: [],
        tags: ["legacy"],
      },
    },
    {
      id: "ITEM2",
      metadata: {
        id: "ITEM2",
        name: "원신 승리",
        ext: "mp4",
        folders: [],
        tags: ["legacy"],
      },
    },
  ]);
  const reviewFile = writeApprovedReviewFile({
    libraryPath,
    entries: ["ITEM1", "ITEM2"].map((id) => ({
      id,
      currentName: "원신 승리",
      proposedName: "원신 검",
      reason: "manual approval",
      confidence: 1,
      approved: true,
    })),
  });
  const applyReportJson = path.join(projectRoot, ".tmp", "eagle-phase2", timestamp, "apply-report.json");
  const preloadPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "eagle-phase2-preload-")),
    "fail-apply-report.cjs"
  );

  fs.writeFileSync(
    preloadPath,
    [
      'const fs = require("node:fs");',
      "const originalWriteFileSync = fs.writeFileSync;",
      "let reportWriteCount = 0;",
      "fs.writeFileSync = function patchedWriteFileSync(targetPath, data, options) {",
      '  if (String(targetPath).includes("apply-report.json.tmp")) {',
      "    reportWriteCount += 1;",
      "    if (reportWriteCount === 3) {",
      '      throw new Error("simulated apply report write failure");',
      "    }",
      "  }",
      "  return originalWriteFileSync.call(this, targetPath, data, options);",
      "};",
      "",
    ].join("\n")
  );

  removePhase2Artifacts(timestamp);

  try {
    const result = runPhase2CliWithEnv(
      [
        "apply",
        "--review-file",
        reviewFile,
        "--library",
        libraryPath,
        "--timestamp",
        timestamp,
      ],
      {
        NODE_OPTIONS: `--require ${preloadPath}`,
      }
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /durable partial apply-report\.json/i);
    assert.match(
      result.stderr,
      new RegExp(applyReportJson.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );
  } finally {
    fs.rmSync(path.dirname(reviewFile), { recursive: true, force: true });
    fs.rmSync(path.dirname(preloadPath), { recursive: true, force: true });
    fs.rmSync(libraryPath, { recursive: true, force: true });
    removePhase2Artifacts(timestamp);
  }
});

test("runPhase2Apply CLI prints the apply summary contract", () => {
  const timestamp = `apply-cli-${Date.now()}-${randomUUID()}`;
  const libraryPath = createTempEagleLibrary([
    {
      id: "ITEM1",
      metadata: {
        id: "ITEM1",
        name: "원신 승리",
        ext: "mp4",
        folders: [],
        tags: ["legacy"],
      },
    },
  ]);
  const reviewFile = writeApprovedReviewFile({
    libraryPath,
    entries: [
      {
        id: "ITEM1",
        currentName: "원신 승리",
        proposedName: "원신 검",
        reason: "manual approval",
        confidence: 1,
        approved: true,
      },
    ],
  });

  removePhase2Artifacts(timestamp);

  try {
    const result = runPhase2Cli([
      "apply",
      "--review-file",
      reviewFile,
      "--library",
      libraryPath,
      "--timestamp",
      timestamp,
    ]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, new RegExp(`📂 Eagle Library: ${libraryPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.match(result.stdout, /✍️ Mode: apply/);
    assert.match(result.stdout, /🧾 apply-report\.json: .*apply-report\.json/);
  } finally {
    fs.rmSync(path.dirname(reviewFile), { recursive: true, force: true });
    fs.rmSync(libraryPath, { recursive: true, force: true });
    removePhase2Artifacts(timestamp);
  }
});

test("runPhase2Apply CLI exits non-zero and reports failures when apply ends with item errors", () => {
  const timestamp = `apply-cli-failure-${Date.now()}-${randomUUID()}`;
  const libraryPath = createTempEagleLibrary([
    {
      id: "ITEM1",
      metadata: {
        id: "ITEM1",
        name: "원신 승리",
        ext: "mp4",
        folders: [],
        tags: ["legacy"],
      },
    },
  ]);
  const reviewFile = writeApprovedReviewFile({
    libraryPath,
    entries: [
      {
        id: "ITEM1",
        currentName: "원신 승리",
        proposedName: "원신 검",
        reason: "manual approval",
        confidence: 1,
        approved: true,
      },
    ],
  });
  const infoDir = path.join(libraryPath, "images", "ITEM1.info");
  const originalMode = fs.statSync(infoDir).mode;

  removePhase2Artifacts(timestamp);

  try {
    fs.chmodSync(infoDir, 0o555);

    const result = runPhase2Cli([
      "apply",
      "--review-file",
      reviewFile,
      "--library",
      libraryPath,
      "--timestamp",
      timestamp,
    ]);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /🧾 apply-report\.json: .*apply-report\.json/);
    assert.match(result.stderr, /apply completed with failures/i);
    assert.match(result.stderr, /successes: 0, failures: 1, aborted: false/i);
  } finally {
    fs.chmodSync(infoDir, originalMode & 0o777);
    fs.rmSync(path.dirname(reviewFile), { recursive: true, force: true });
    fs.rmSync(libraryPath, { recursive: true, force: true });
    removePhase2Artifacts(timestamp);
  }
});
