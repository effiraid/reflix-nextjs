import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { computeExportSignature } from "./release-approval-state.mjs";
import {
  parseReleaseApprovalCliArgs,
  runReleaseApprove,
  runReleaseGo,
  runReleaseMarkFailed,
  runReleaseMarkPublished,
  runReleaseReview,
  runReleaseScan,
  runReleaseStatus,
  smokeCheckExportArtifacts,
} from "./release-approval.mjs";

const SCRIPT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "release-approval.mjs"
);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function createTempProject() {
  const projectRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "reflix-release-approval-")
  );
  const libraryPath = path.join(projectRoot, "Fixture.library");

  fs.mkdirSync(path.join(projectRoot, "config"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, ".tmp"), { recursive: true });
  fs.mkdirSync(path.join(libraryPath, "images"), { recursive: true });

  return { projectRoot, libraryPath };
}

function writePublishedState(projectRoot, entries = {}) {
  fs.writeFileSync(
    path.join(projectRoot, "config", "published-state.json"),
    JSON.stringify(
      {
        version: 1,
        updatedAt: "2026-03-24T00:00:00.000Z",
        entries,
      },
      null,
      2
    )
  );
}

function writeReleaseBatch(projectRoot, batch) {
  fs.writeFileSync(
    path.join(projectRoot, "config", "release-batch.json"),
    JSON.stringify(batch, null, 2)
  );
}

function writeProjectCategories(projectRoot, categories = {}) {
  const categoriesPath = path.join(projectRoot, "src", "data", "categories.json");
  fs.mkdirSync(path.dirname(categoriesPath), { recursive: true });
  fs.writeFileSync(categoriesPath, JSON.stringify(categories, null, 2));
}

function makeItem(id, overrides = {}) {
  return {
    id,
    name: `Clip ${id}`,
    ext: "mp4",
    tags: ["tagged"],
    folders: ["folder-1"],
    annotation: "",
    star: 0,
    duration: 3.2,
    width: 1280,
    height: 720,
    mtime: 1711234567890,
    ...overrides,
  };
}

function writeEagleItem(libraryPath, item) {
  const infoDir = path.join(libraryPath, "images", `${item.id}.info`);
  fs.mkdirSync(infoDir, { recursive: true });
  fs.writeFileSync(path.join(infoDir, "metadata.json"), JSON.stringify(item, null, 2));
  fs.writeFileSync(path.join(infoDir, `${item.id}.mp4`), "video");
  fs.writeFileSync(path.join(infoDir, `${item.id}_thumbnail.png`), "thumb");
}

function readEagleItemMetadata(libraryPath, id) {
  return JSON.parse(
    fs.readFileSync(
      path.join(libraryPath, "images", `${id}.info`, "metadata.json"),
      "utf-8"
    )
  );
}

function writeExportedClip(projectRoot, id, clip) {
  const clipPath = path.join(projectRoot, "public", "data", "clips", `${id}.json`);
  fs.mkdirSync(path.dirname(clipPath), { recursive: true });
  fs.writeFileSync(clipPath, JSON.stringify(clip, null, 2));
}

function writeProposalBatch(projectRoot, timestamp, ids) {
  const proposalDir = path.join(
    projectRoot,
    ".tmp",
    "release-approval",
    timestamp
  );
  fs.mkdirSync(proposalDir, { recursive: true });

  const proposalPath = path.join(proposalDir, "release-batch.proposed.json");
  fs.writeFileSync(
    proposalPath,
    JSON.stringify(
      {
        name: `proposal-${timestamp}`,
        ids,
        path: path.join(
          ".tmp",
          "release-approval",
          timestamp,
          "release-batch.proposed.json"
        ),
      },
      null,
      2
    )
  );

  return proposalPath;
}

test("scan marks a new eligible item as new", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  writePublishedState(projectRoot, {});
  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["NEW1"],
  });
  writeEagleItem(libraryPath, makeItem("NEW1"));

  const result = await runReleaseScan({
    command: "scan",
    projectRoot,
    libraryPath,
    timestamp: "2026-03-24T12:00:00.000Z",
  });

  assert.deepEqual(result.selectedIds, ["NEW1"]);
  assert.equal(result.candidates[0].reason, "new");
});

test("scan defaults to the active release batch scope", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  writePublishedState(projectRoot, {});
  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["IN_BATCH"],
  });
  writeEagleItem(libraryPath, makeItem("IN_BATCH"));
  writeEagleItem(libraryPath, makeItem("OUTSIDE_BATCH"));

  const result = await runReleaseScan({
    command: "scan",
    projectRoot,
    libraryPath,
    timestamp: "2026-03-24T12:00:00.000Z",
  });

  assert.deepEqual(result.selectedIds, ["IN_BATCH"]);
  assert.equal(result.summary.eligibleCount, 1);
});

test("scan includes all eligible items only when --all is enabled", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  writePublishedState(projectRoot, {});
  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["IN_BATCH"],
  });
  writeEagleItem(libraryPath, makeItem("IN_BATCH"));
  writeEagleItem(libraryPath, makeItem("OUTSIDE_BATCH"));

  const result = await runReleaseScan({
    command: "scan",
    projectRoot,
    libraryPath,
    includeAllEligible: true,
    timestamp: "2026-03-24T12:00:00.000Z",
  });

  assert.deepEqual(result.selectedIds, ["IN_BATCH", "OUTSIDE_BATCH"]);
  assert.equal(result.summary.eligibleCount, 2);
});

test("scan marks a previously published item with a changed signature as changed", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const item = makeItem("CHANGED1", { name: "Updated name", mtime: 1711234567999 });

  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["CHANGED1"],
  });
  writePublishedState(projectRoot, {
    CHANGED1: {
      publishedAt: "2026-03-20T00:00:00.000Z",
      batchName: "old-batch",
      eagleMtime: 1711234567000,
      exportSignature: computeExportSignature({ ...item, name: "Stale name" }),
    },
  });
  writeEagleItem(libraryPath, item);

  const result = await runReleaseScan({
    command: "scan",
    projectRoot,
    libraryPath,
    timestamp: "2026-03-24T12:00:00.000Z",
  });

  assert.deepEqual(result.selectedIds, ["CHANGED1"]);
  assert.equal(result.candidates[0].reason, "changed");
});

test("scan marks publish-failed items as retry_failed_publish", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  writePublishedState(projectRoot, {});
  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["RETRY1"],
  });
  writeEagleItem(
    libraryPath,
    makeItem("RETRY1", {
      tags: ["publish_candidate", "tagged", "reflix:publish-failed"],
    })
  );

  const result = await runReleaseScan({
    command: "scan",
    projectRoot,
    libraryPath,
    timestamp: "2026-03-24T12:00:00.000Z",
  });

  assert.deepEqual(result.selectedIds, ["RETRY1"]);
  assert.equal(result.candidates[0].reason, "retry_failed_publish");
});

test("scan excludes held items", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  writePublishedState(projectRoot, {});
  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["HOLD1"],
  });
  writeEagleItem(
    libraryPath,
    makeItem("HOLD1", {
      tags: ["publish_candidate", "tagged", "reflix:hold"],
    })
  );

  const result = await runReleaseScan({
    command: "scan",
    projectRoot,
    libraryPath,
    timestamp: "2026-03-24T12:00:00.000Z",
  });

  assert.deepEqual(result.selectedIds, []);
  assert.equal(result.summary.heldCount, 1);
  assert.equal(result.summary.selectedCount, 0);
});

test("scan writes the proposed batch and proposal report artifacts", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  writePublishedState(projectRoot, {});
  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["WRITE1"],
  });
  writeEagleItem(libraryPath, makeItem("WRITE1"));

  const parsed = parseReleaseApprovalCliArgs([
    "scan",
    "--library",
    libraryPath,
    "--project-root",
    projectRoot,
    "--timestamp",
    "2026-03-24T12:00:00.000Z",
  ]);
  const result = await runReleaseScan(parsed);

  assert.equal(
    fs.existsSync(path.join(projectRoot, ".tmp", "release-approval", parsed.timestamp, "release-batch.proposed.json")),
    true
  );
  assert.equal(
    fs.existsSync(path.join(projectRoot, ".tmp", "release-approval", parsed.timestamp, "proposal-report.md")),
    true
  );

  assert.deepEqual(JSON.parse(fs.readFileSync(result.proposalBatchPath, "utf-8")), {
    name: "proposal-2026-03-24T12:00:00.000Z",
    ids: ["WRITE1"],
    path: ".tmp/release-approval/2026-03-24T12:00:00.000Z/release-batch.proposed.json",
  });

  const report = fs.readFileSync(result.proposalReportPath, "utf-8");
  assert.match(report, /WRITE1/);
  assert.match(report, /new/);
});

test("scan excludes items without any non-reflix content tags", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  writePublishedState(projectRoot, {});
  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["NO_CONTENT_TAGS"],
  });
  writeEagleItem(
    libraryPath,
    makeItem("NO_CONTENT_TAGS", {
      tags: ["reflix:publish-failed"],
    })
  );

  const result = await runReleaseScan({
    command: "scan",
    projectRoot,
    libraryPath,
    timestamp: "2026-03-24T12:00:00.000Z",
  });

  assert.deepEqual(result.selectedIds, []);
  assert.equal(result.summary.eligibleCount, 0);
});

test("scan writes candidates and held items in deterministic id order", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["C_NEW", "A_HOLD", "B_CHANGED"],
  });
  writePublishedState(projectRoot, {
    B_CHANGED: {
      publishedAt: "2026-03-20T00:00:00.000Z",
      batchName: "old-batch",
      eagleMtime: 1711234567000,
      exportSignature: computeExportSignature(
        makeItem("B_CHANGED", { name: "Older name" })
      ),
    },
  });

  writeEagleItem(libraryPath, makeItem("C_NEW"));
  writeEagleItem(
    libraryPath,
    makeItem("A_HOLD", {
      tags: ["tagged", "reflix:hold"],
    })
  );
  writeEagleItem(
    libraryPath,
    makeItem("B_CHANGED", {
      name: "Updated name",
      mtime: 1711234567999,
    })
  );

  const result = await runReleaseScan({
    command: "scan",
    projectRoot,
    libraryPath,
    timestamp: "2026-03-24T12:00:00.000Z",
  });

  assert.deepEqual(
    result.candidates.map((candidate) => candidate.id),
    ["B_CHANGED", "C_NEW"]
  );
  assert.deepEqual(result.selectedIds, ["B_CHANGED", "C_NEW"]);

  const proposalBatch = JSON.parse(fs.readFileSync(result.proposalBatchPath, "utf-8"));
  assert.deepEqual(proposalBatch.ids, ["B_CHANGED", "C_NEW"]);

  const report = fs.readFileSync(result.proposalReportPath, "utf-8");
  assert.match(report, /# 승인 제안 보고서/);
  assert.match(report, /생성 시각: 2026-03-24T12:00:00.000Z/);
  assert.match(report, /라이브러리 경로:/);
  assert.match(report, /전체 적격 아이템 수: 3/);
  assert.match(report, /자동 선정 아이템 수: 2/);
  assert.match(report, /보류 아이템 수: 1/);
  assert.match(report, /## 제안 아이템/);
  assert.ok(
    report.indexOf("B_CHANGED") < report.indexOf("C_NEW"),
    "candidate order should be stable"
  );
  assert.ok(
    report.indexOf("## 제외된 보류 아이템") < report.indexOf("A_HOLD"),
    "held section should include held items"
  );
  assert.match(report, /## 운영 안내/);
  assert.match(report, /Eagle에서 제안 아이템을 확인합니다\./);
});

test("approve promotes only approved proposal items when all proposal items remain eligible", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  writePublishedState(projectRoot, {});
  writeProposalBatch(projectRoot, "2026-03-24T12:00:00.000Z", [
    "KEEP_APPROVED",
    "NOT_APPROVED",
  ]);
  writeReleaseBatch(projectRoot, {
    name: "existing-batch",
    ids: ["LIVE1"],
  });

  writeEagleItem(
    libraryPath,
    makeItem("KEEP_APPROVED", { tags: ["tagged", "reflix:approved"] })
  );
  writeEagleItem(libraryPath, makeItem("NOT_APPROVED", { tags: ["tagged"] }));

  const result = await runReleaseApprove({
    command: "approve",
    projectRoot,
    libraryPath,
    timestamp: "2026-03-24T15:30:00.000Z",
  });

  assert.deepEqual(result.approvedIds, ["KEEP_APPROVED"]);
  assert.deepEqual(
    JSON.parse(
      fs.readFileSync(path.join(projectRoot, "config", "release-batch.json"), "utf-8")
    ).ids,
    ["KEEP_APPROVED"]
  );
});

test("approve removes review-requested from approved items and leaves held items untouched", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  writePublishedState(projectRoot, {});
  writeProposalBatch(projectRoot, "2026-03-24T12:00:00.000Z", [
    "APPROVED_REVIEW",
    "APPROVED_ONLY",
    "HELD_REVIEW",
  ]);
  writeReleaseBatch(projectRoot, {
    name: "existing-batch",
    ids: ["LIVE1"],
  });

  writeEagleItem(
    libraryPath,
    makeItem("APPROVED_REVIEW", {
      tags: ["tagged", "reflix:approved", "reflix:review-requested"],
    })
  );
  writeEagleItem(
    libraryPath,
    makeItem("APPROVED_ONLY", {
      tags: ["tagged", "reflix:approved"],
    })
  );
  writeEagleItem(
    libraryPath,
    makeItem("HELD_REVIEW", {
      tags: ["tagged", "reflix:approved", "reflix:hold", "reflix:review-requested"],
    })
  );

  const result = await runReleaseApprove({
    command: "approve",
    projectRoot,
    libraryPath,
    timestamp: "2026-03-24T15:30:00.000Z",
  });

  assert.deepEqual(result.approvedIds, ["APPROVED_REVIEW", "APPROVED_ONLY"]);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "APPROVED_REVIEW").tags, [
    "tagged",
    "reflix:approved",
  ]);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "APPROVED_ONLY").tags, [
    "tagged",
    "reflix:approved",
  ]);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "HELD_REVIEW").tags, [
    "tagged",
    "reflix:approved",
    "reflix:hold",
    "reflix:review-requested",
  ]);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(projectRoot, "config", "release-batch.json"), "utf-8")).ids,
    ["APPROVED_REVIEW", "APPROVED_ONLY"]
  );
});

test("approve restores the previous proposal batch and preserves same-timestamp artifacts when live batch overwrite fails", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const timestamp = "2026-03-24T15:30:00.000Z";
  const first = makeItem("FIRST", {
    tags: ["tagged", "reflix:approved", "reflix:review-requested"],
  });
  const second = makeItem("SECOND", {
    tags: ["tagged", "reflix:approved", "reflix:review-requested"],
  });
  const third = makeItem("THIRD", {
    tags: ["tagged"],
  });

  writePublishedState(projectRoot, {});
  writeProposalBatch(projectRoot, timestamp, ["FIRST", "SECOND", "THIRD"]);
  fs.writeFileSync(
    path.join(projectRoot, ".tmp", "release-approval", timestamp, "proposal-report.md"),
    "last-good-report",
    "utf-8"
  );
  writeReleaseBatch(projectRoot, {
    name: "existing-batch",
    ids: ["LIVE1"],
  });
  writeEagleItem(libraryPath, first);
  writeEagleItem(libraryPath, second);
  writeEagleItem(libraryPath, third);

  const releaseBatchPath = path.join(projectRoot, "config", "release-batch.json");
  const originalRenameSync = fs.renameSync;
  fs.renameSync = function patchedRenameSync(oldPath, newPath) {
    if (path.resolve(String(newPath)) === releaseBatchPath) {
      throw new Error("live batch overwrite failed");
    }

    return originalRenameSync.call(this, oldPath, newPath);
  };

  try {
    await assert.rejects(
      () =>
        runReleaseApprove({
          command: "approve",
          projectRoot,
          libraryPath,
          timestamp,
        }),
      /live batch overwrite failed/
    );
  } finally {
    fs.renameSync = originalRenameSync;
  }

  assert.deepEqual(readEagleItemMetadata(libraryPath, "FIRST"), first);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "SECOND"), second);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "THIRD"), third);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(projectRoot, "config", "release-batch.json"), "utf-8")),
    {
      name: "existing-batch",
      ids: ["LIVE1"],
    }
  );

  assert.deepEqual(
    JSON.parse(
      fs.readFileSync(
        path.join(projectRoot, ".tmp", "release-approval", timestamp, "release-batch.proposed.json"),
        "utf-8"
      )
    ).ids,
    ["FIRST", "SECOND", "THIRD"]
  );
  assert.equal(
    fs.readFileSync(
      path.join(projectRoot, ".tmp", "release-approval", timestamp, "proposal-report.md"),
      "utf-8"
    ),
    "last-good-report"
  );

  writeEagleItem(libraryPath, makeItem("THIRD", { tags: ["tagged", "reflix:approved"] }));

  const rerun = await runReleaseApprove({
    command: "approve",
    projectRoot,
    libraryPath,
    timestamp,
  });

  assert.deepEqual(rerun.approvedIds, ["FIRST", "SECOND", "THIRD"]);
  assert.equal(
    fs.readFileSync(
      path.join(projectRoot, ".tmp", "release-approval", timestamp, "proposal-report.md"),
      "utf-8"
    ),
    "last-good-report"
  );
});

test("approve fails when a proposal item is missing from Eagle", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  writePublishedState(projectRoot, {});
  writeProposalBatch(projectRoot, "2026-03-24T12:00:00.000Z", [
    "KEEP_APPROVED",
    "MISSING_ITEM",
  ]);
  writeReleaseBatch(projectRoot, {
    name: "existing-batch",
    ids: ["LIVE1", "LIVE2"],
  });

  writeEagleItem(
    libraryPath,
    makeItem("KEEP_APPROVED", { tags: ["tagged", "reflix:approved"] })
  );

  await assert.rejects(
    () =>
      runReleaseApprove({
        command: "approve",
        projectRoot,
        libraryPath,
        timestamp: "2026-03-24T15:30:00.000Z",
      }),
    /missing from Eagle/i
  );

  assert.deepEqual(
    JSON.parse(
      fs.readFileSync(path.join(projectRoot, "config", "release-batch.json"), "utf-8")
    ),
    {
      name: "existing-batch",
      ids: ["LIVE1", "LIVE2"],
    }
  );
});

test("approve fails when a proposal item is no longer Phase 1 eligible", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  writePublishedState(projectRoot, {});
  writeProposalBatch(projectRoot, "2026-03-24T12:00:00.000Z", [
    "KEEP_APPROVED",
    "NO_LONGER_ELIGIBLE",
  ]);
  writeReleaseBatch(projectRoot, {
    name: "existing-batch",
    ids: ["LIVE1", "LIVE2"],
  });

  writeEagleItem(
    libraryPath,
    makeItem("KEEP_APPROVED", { tags: ["tagged", "reflix:approved"] })
  );
  writeEagleItem(
    libraryPath,
    makeItem("NO_LONGER_ELIGIBLE", {
      tags: ["reflix:approved"],
    })
  );

  await assert.rejects(
    () =>
      runReleaseApprove({
        command: "approve",
        projectRoot,
        libraryPath,
        timestamp: "2026-03-24T15:30:00.000Z",
      }),
    /satisfy Phase 1 eligibility/i
  );

  assert.deepEqual(
    JSON.parse(
      fs.readFileSync(path.join(projectRoot, "config", "release-batch.json"), "utf-8")
    ),
    {
      name: "existing-batch",
      ids: ["LIVE1", "LIVE2"],
    }
  );
});

test("approve preserves proposal order in the promoted batch", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  writePublishedState(projectRoot, {});
  writeProposalBatch(projectRoot, "2026-03-24T12:00:00.000Z", [
    "C_THIRD",
    "A_FIRST",
    "B_SECOND",
  ]);

  writeEagleItem(
    libraryPath,
    makeItem("A_FIRST", { tags: ["tagged", "reflix:approved"] })
  );
  writeEagleItem(
    libraryPath,
    makeItem("B_SECOND", { tags: ["tagged", "reflix:approved"] })
  );
  writeEagleItem(
    libraryPath,
    makeItem("C_THIRD", { tags: ["tagged", "reflix:approved"] })
  );

  const result = await runReleaseApprove({
    command: "approve",
    projectRoot,
    libraryPath,
    timestamp: "2026-03-24T15:30:00.000Z",
  });

  assert.deepEqual(result.approvedIds, ["C_THIRD", "A_FIRST", "B_SECOND"]);
  assert.deepEqual(
    JSON.parse(
      fs.readFileSync(path.join(projectRoot, "config", "release-batch.json"), "utf-8")
    ).ids,
    ["C_THIRD", "A_FIRST", "B_SECOND"]
  );
});

test("approve throws a clear error and leaves the live batch unchanged when nothing is approved", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  writePublishedState(projectRoot, {});
  writeProposalBatch(projectRoot, "2026-03-24T12:00:00.000Z", [
    "NOT_APPROVED",
    "HELD_ONLY",
  ]);
  writeReleaseBatch(projectRoot, {
    name: "existing-batch",
    ids: ["LIVE1", "LIVE2"],
  });

  writeEagleItem(libraryPath, makeItem("NOT_APPROVED", { tags: ["tagged"] }));
  writeEagleItem(
    libraryPath,
    makeItem("HELD_ONLY", { tags: ["tagged", "reflix:approved", "reflix:hold"] })
  );

  await assert.rejects(
    () =>
      runReleaseApprove({
        command: "approve",
        projectRoot,
        libraryPath,
        timestamp: "2026-03-24T15:30:00.000Z",
      }),
    /no approved items/i
  );

  assert.deepEqual(
    JSON.parse(
      fs.readFileSync(path.join(projectRoot, "config", "release-batch.json"), "utf-8")
    ),
    {
      name: "existing-batch",
      ids: ["LIVE1", "LIVE2"],
    }
  );
});

test("approve writes the refreshed proposal snapshot before any live batch overwrite begins", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const originalTimestamp = "2026-03-24T12:00:00.000Z";
  const approveTimestamp = "2026-03-24T15:30:00.000Z";
  writePublishedState(projectRoot, {});
  writeProposalBatch(projectRoot, originalTimestamp, ["STALE", "FRESH"]);

  writeEagleItem(
    libraryPath,
    makeItem("STALE", { tags: ["tagged", "reflix:approved", "reflix:hold"] })
  );
  writeEagleItem(
    libraryPath,
    makeItem("FRESH", { tags: ["tagged", "reflix:approved"] })
  );

  const proposalBatchPath = path.join(
    projectRoot,
    ".tmp",
    "release-approval",
    approveTimestamp,
    "release-batch.proposed.json"
  );
  const releaseBatchPath = path.join(projectRoot, "config", "release-batch.json");
  const writeEvents = [];
  const originalWriteFileSync = fs.writeFileSync;
  const originalRenameSync = fs.renameSync;

  fs.writeFileSync = function patchedWriteFileSync(filePath, data, options) {
    const resolvedPath = path.resolve(String(filePath));
    writeEvents.push({ type: "write", path: resolvedPath });

    if (resolvedPath.startsWith(path.join(projectRoot, "config"))) {
      assert.equal(
        fs.existsSync(proposalBatchPath),
        true,
        "proposal snapshot must exist before live batch overwrite begins"
      );
    }

    return originalWriteFileSync.call(this, filePath, data, options);
  };

  fs.renameSync = function patchedRenameSync(oldPath, newPath) {
    writeEvents.push({
      type: "rename",
      from: path.resolve(String(oldPath)),
      to: path.resolve(String(newPath)),
    });

    return originalRenameSync.call(this, oldPath, newPath);
  };

  let result;
  try {
    result = await runReleaseApprove({
      command: "approve",
      projectRoot,
      libraryPath,
      timestamp: approveTimestamp,
    });
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    fs.renameSync = originalRenameSync;
  }

  assert.equal(
    result.proposalBatchPath,
    proposalBatchPath
  );
  assert.deepEqual(
    JSON.parse(fs.readFileSync(result.proposalBatchPath, "utf-8")),
    {
      name: `proposal-${approveTimestamp}`,
      ids: ["FRESH"],
      path: path.join(
        ".tmp",
        "release-approval",
        approveTimestamp,
        "release-batch.proposed.json"
      ),
    }
  );
  assert.equal(
    writeEvents.findIndex(
      (event) => event.type === "write" && event.path === proposalBatchPath
    ) <
      writeEvents.findIndex(
        (event) =>
          event.type === "rename" &&
          event.to === releaseBatchPath
      ),
    true
  );
});

test("approve atomically overwrites the live batch via temp file rename", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const originalTimestamp = "2026-03-24T12:00:00.000Z";
  const approveTimestamp = "2026-03-24T15:30:00.000Z";
  writePublishedState(projectRoot, {});
  writeProposalBatch(projectRoot, originalTimestamp, ["FRESH"]);
  writeReleaseBatch(projectRoot, {
    name: "existing-batch",
    ids: ["LIVE1"],
  });

  writeEagleItem(
    libraryPath,
    makeItem("FRESH", { tags: ["tagged", "reflix:approved"] })
  );

  const releaseBatchPath = path.join(projectRoot, "config", "release-batch.json");
  const writeEvents = [];
  const originalWriteFileSync = fs.writeFileSync;
  const originalRenameSync = fs.renameSync;

  fs.writeFileSync = function patchedWriteFileSync(filePath, data, options) {
    writeEvents.push({
      type: "write",
      path: path.resolve(String(filePath)),
    });

    return originalWriteFileSync.call(this, filePath, data, options);
  };

  fs.renameSync = function patchedRenameSync(oldPath, newPath) {
    writeEvents.push({
      type: "rename",
      from: path.resolve(String(oldPath)),
      to: path.resolve(String(newPath)),
    });

    return originalRenameSync.call(this, oldPath, newPath);
  };

  try {
    await runReleaseApprove({
      command: "approve",
      projectRoot,
      libraryPath,
      timestamp: approveTimestamp,
    });
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    fs.renameSync = originalRenameSync;
  }

  const releaseWrites = writeEvents.filter(
    (event) =>
      event.type === "write" &&
      event.path.startsWith(path.join(projectRoot, "config"))
  );
  assert.equal(
    releaseWrites.some((event) => event.path === releaseBatchPath),
    false,
    "live batch should not be written directly"
  );
  assert.equal(releaseWrites.length, 1);
  assert.match(path.basename(releaseWrites[0].path), /^\.release-batch\.json\./);
  assert.deepEqual(
    writeEvents.filter(
      (event) =>
        event.type === "rename" &&
        event.to === releaseBatchPath
    ).length,
    1
  );
  assert.deepEqual(
    JSON.parse(
      fs.readFileSync(releaseBatchPath, "utf-8")
    ).ids,
    ["FRESH"]
  );
});

test("mark-published adds published tags and removes approval, review-requested, and publish-failed tags", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const timestamp = "2026-03-24T18:00:00.000Z";
  const item = makeItem("PUBLISHED1", {
    tags: ["tagged", "reflix:approved", "reflix:publish-failed", "reflix:review-requested"],
    mtime: 1711272000123,
  });

  writeReleaseBatch(projectRoot, {
    name: "active-batch",
    ids: ["PUBLISHED1"],
  });
  writePublishedState(projectRoot, {});
  writeEagleItem(libraryPath, item);

  const result = await runReleaseMarkPublished({
    command: "mark-published",
    projectRoot,
    libraryPath,
    timestamp,
  });

  assert.deepEqual(result.updatedIds, ["PUBLISHED1"]);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "PUBLISHED1").tags, [
    "tagged",
    "reflix:published",
  ]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(projectRoot, "config", "published-state.json"), "utf-8")), {
    version: 1,
    updatedAt: timestamp,
    entries: {
      PUBLISHED1: {
        publishedAt: timestamp,
        batchName: "active-batch",
        eagleMtime: 1711272000123,
        exportSignature: computeExportSignature(
          {
            ...item,
            tags: ["tagged", "reflix:published"],
            _mediaPath: path.join(libraryPath, "images", "PUBLISHED1.info", "PUBLISHED1.mp4"),
            _thumbnailPath: path.join(
              libraryPath,
              "images",
              "PUBLISHED1.info",
              "PUBLISHED1_thumbnail.png"
            ),
          }
        ),
      },
    },
  });
});

test("mark-published rolls back Eagle metadata when publish-state save fails", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const timestamp = "2026-03-24T18:00:00.000Z";
  const releaseBatch = {
    name: "active-batch",
    ids: ["ROLLBACK1"],
  };
  const originalState = {
    version: 1,
    updatedAt: "2026-03-24T10:00:00.000Z",
    entries: {
      LEGACY: {
        publishedAt: "2026-03-24T10:00:00.000Z",
        batchName: "legacy-batch",
        eagleMtime: 1711234500000,
        exportSignature: "sha256:legacy",
      },
    },
  };
  const item = makeItem("ROLLBACK1", {
    tags: ["tagged", "reflix:approved"],
    mtime: 1711272000555,
  });

  writeReleaseBatch(projectRoot, releaseBatch);
  fs.writeFileSync(
    path.join(projectRoot, "config", "published-state.json"),
    JSON.stringify(originalState, null, 2)
  );
  writeEagleItem(libraryPath, item);

  const originalRenameSync = fs.renameSync;
  fs.renameSync = function patchedRenameSync(oldPath, newPath) {
    if (
      path.resolve(String(newPath)) ===
      path.join(projectRoot, "config", "published-state.json")
    ) {
      throw new Error("publish-state save failed");
    }

    return originalRenameSync.call(this, oldPath, newPath);
  };

  try {
    await assert.rejects(
      () =>
        runReleaseMarkPublished({
          command: "mark-published",
          projectRoot,
          libraryPath,
          timestamp,
        }),
      /publish-state save failed/
    );
  } finally {
    fs.renameSync = originalRenameSync;
  }

  assert.deepEqual(readEagleItemMetadata(libraryPath, "ROLLBACK1"), item);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(projectRoot, "config", "published-state.json"), "utf-8")),
    originalState
  );
});

test("mark-failed preserves approval while adding publish-failed and removing published and review-requested", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const timestamp = "2026-03-24T18:00:00.000Z";

  writeReleaseBatch(projectRoot, {
    name: "active-batch",
    ids: ["FAILED1"],
  });
  writePublishedState(projectRoot, {});
  writeEagleItem(
    libraryPath,
    makeItem("FAILED1", {
      tags: ["tagged", "reflix:approved", "reflix:published", "reflix:review-requested"],
      mtime: 1711272000456,
    })
  );

  const result = await runReleaseMarkFailed({
    command: "mark-failed",
    projectRoot,
    libraryPath,
    timestamp,
  });

  assert.deepEqual(result.updatedIds, ["FAILED1"]);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "FAILED1").tags, [
    "tagged",
    "reflix:approved",
    "reflix:publish-failed",
  ]);
});

test("mark-published rolls back earlier items when a later metadata write fails", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const timestamp = "2026-03-24T18:00:00.000Z";
  const first = makeItem("FIRST", {
    tags: ["tagged", "reflix:approved"],
    mtime: 1711272000666,
  });
  const second = makeItem("SECOND", {
    tags: ["tagged", "reflix:approved"],
    mtime: 1711272000777,
  });

  writeReleaseBatch(projectRoot, {
    name: "active-batch",
    ids: ["FIRST", "SECOND"],
  });
  writePublishedState(projectRoot, {});
  writeEagleItem(libraryPath, first);
  writeEagleItem(libraryPath, second);

  const originalRenameSync = fs.renameSync;
  fs.renameSync = function patchedRenameSync(oldPath, newPath) {
    if (
      path.resolve(String(newPath)) ===
      path.join(libraryPath, "images", "SECOND.info", "metadata.json")
    ) {
      throw new Error("metadata write failed");
    }

    return originalRenameSync.call(this, oldPath, newPath);
  };

  try {
    await assert.rejects(
      () =>
        runReleaseMarkPublished({
          command: "mark-published",
          projectRoot,
          libraryPath,
          timestamp,
        }),
      /metadata write failed/
    );
  } finally {
    fs.renameSync = originalRenameSync;
  }

  assert.deepEqual(readEagleItemMetadata(libraryPath, "FIRST"), first);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "SECOND"), second);
  assert.equal(fs.existsSync(path.join(projectRoot, "config", "published-state.json")), true);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(projectRoot, "config", "published-state.json"), "utf-8")),
    {
      version: 1,
      updatedAt: "2026-03-24T00:00:00.000Z",
      entries: {},
    }
  );
});

test("mark-failed leaves an existing successful publish-state entry unchanged", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const timestamp = "2026-03-24T18:00:00.000Z";
  const existingState = {
    version: 1,
    updatedAt: "2026-03-24T17:00:00.000Z",
    entries: {
      FAILED2: {
        publishedAt: "2026-03-24T17:00:00.000Z",
        batchName: "successful-batch",
        eagleMtime: 1711272000999,
        exportSignature: "sha256:existing",
      },
    },
  };

  writeReleaseBatch(projectRoot, {
    name: "active-batch",
    ids: ["FAILED2"],
  });
  fs.writeFileSync(
    path.join(projectRoot, "config", "published-state.json"),
    JSON.stringify(existingState, null, 2)
  );
  writeEagleItem(
    libraryPath,
    makeItem("FAILED2", {
      tags: ["tagged", "reflix:approved", "reflix:published"],
      mtime: 1711272000999,
    })
  );

  await runReleaseMarkFailed({
    command: "mark-failed",
    projectRoot,
    libraryPath,
    timestamp,
  });

  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(projectRoot, "config", "published-state.json"), "utf-8")), existingState);
});

test("parseReleaseApprovalCliArgs rejects missing string flag values", () => {
  assert.throws(
    () => parseReleaseApprovalCliArgs(["scan", "--library"]),
    /--library requires a value/i
  );
  assert.throws(
    () => parseReleaseApprovalCliArgs(["scan", "--project-root", "--timestamp", "2026-03-24T12:00:00.000Z"]),
    /--project-root requires a value/i
  );
  assert.throws(
    () => parseReleaseApprovalCliArgs(["scan", "--timestamp", "--library", "/tmp/lib"]),
    /--timestamp requires a value/i
  );
});

test("parseReleaseApprovalCliArgs accepts publish outcome commands", () => {
  assert.equal(parseReleaseApprovalCliArgs(["mark-published"]).command, "mark-published");
  assert.equal(parseReleaseApprovalCliArgs(["mark-failed"]).command, "mark-failed");
});

test("package scripts expose the review command alias", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8")
  );

  assert.equal(
    packageJson.scripts["release:review"],
    "node scripts/release-approval.mjs review"
  );
});

test("parseReleaseApprovalCliArgs accepts review", () => {
  assert.equal(parseReleaseApprovalCliArgs(["review"]).command, "review");
});

test("runReleaseReview reads the active batch by default, writes review artifacts, and mutates review-requested tags by status", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const timestamp = "2026-03-24T12:00:00.000Z";

  writeProjectCategories(projectRoot, {
    ARCANE: {
      slug: "arcane",
      i18n: { en: "Arcane" },
    },
  });
  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["UNAPPROVED", "APPROVED", "CHANGED", "HELD"],
  });

  const approvedClip = {
    name: "Clip APPROVED",
    tags: ["tagged"],
    folders: ["folder-1"],
    annotation: "",
    star: 0,
    duration: 3.2,
    width: 1280,
    height: 720,
  };
  const changedClip = {
    ...approvedClip,
    name: "Older Changed Name",
  };

  writeEagleItem(libraryPath, makeItem("UNAPPROVED", { tags: ["tagged"] }));
  writeEagleItem(
    libraryPath,
    makeItem("APPROVED", {
      tags: ["tagged", "reflix:approved", "reflix:review-requested"],
    })
  );
  writeEagleItem(
    libraryPath,
    makeItem("CHANGED", {
      name: "Updated Changed Name",
      tags: ["tagged", "reflix:approved"],
    })
  );
  writeEagleItem(
    libraryPath,
    makeItem("HELD", {
      tags: ["tagged", "reflix:hold", "reflix:review-requested"],
    })
  );
  writeEagleItem(libraryPath, makeItem("OUTSIDE_BATCH", { tags: ["tagged"] }));

  writeExportedClip(projectRoot, "APPROVED", approvedClip);
  writeExportedClip(projectRoot, "CHANGED", changedClip);

  const result = await runReleaseReview({
    command: "review",
    projectRoot,
    libraryPath,
    timestamp,
  });

  assert.equal(result.scope, "active-batch");
  assert.equal(result.batchName, "mvp-10");
  assert.deepEqual(result.summary, {
    total: 4,
    review_needed_changed: 1,
    review_needed: 1,
    already_approved: 1,
    held: 1,
  });
  assert.equal(
    result.reviewReportPath,
    path.join(projectRoot, ".tmp", "release-review", timestamp, "review-report.md")
  );
  assert.equal(
    result.reviewSuggestionsPath,
    path.join(projectRoot, ".tmp", "release-review", timestamp, "review-suggestions.json")
  );
  assert.equal(fs.existsSync(result.reviewReportPath), true);
  assert.equal(fs.existsSync(result.reviewSuggestionsPath), true);

  const suggestions = JSON.parse(
    fs.readFileSync(result.reviewSuggestionsPath, "utf-8")
  );
  assert.equal(suggestions.batchName, "mvp-10");
  assert.equal(suggestions.scope, "active-batch");
  assert.deepEqual(suggestions.summary, result.summary);
  assert.deepEqual(
    suggestions.items.map((item) => [item.id, item.status]),
    [
      ["CHANGED", "review_needed_changed"],
      ["UNAPPROVED", "review_needed"],
      ["HELD", "held"],
      ["APPROVED", "already_approved"],
    ]
  );

  const report = fs.readFileSync(result.reviewReportPath, "utf-8");
  assert.match(report, /배치 이름: mvp-10/);
  assert.match(report, /변경 후 재검토 필요: 1/);
  assert.match(report, /이미 승인됨: 1/);

  assert.deepEqual(readEagleItemMetadata(libraryPath, "UNAPPROVED").tags, [
    "tagged",
    "reflix:review-requested",
  ]);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "CHANGED").tags, [
    "tagged",
    "reflix:approved",
    "reflix:review-requested",
  ]);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "APPROVED").tags, [
    "tagged",
    "reflix:approved",
  ]);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "HELD").tags, [
    "tagged",
    "reflix:hold",
  ]);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "OUTSIDE_BATCH").tags, [
    "tagged",
  ]);
});

test("runReleaseReview fails fast when an active-batch item no longer satisfies Phase 1 eligibility", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const timestamp = "2026-03-24T14:00:00.000Z";
  const reviewDir = path.join(projectRoot, ".tmp", "release-review", timestamp);

  writeProjectCategories(projectRoot, {});
  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["VALID", "INVALID"],
  });
  writeEagleItem(libraryPath, makeItem("VALID", { tags: ["tagged"] }));
  writeEagleItem(
    libraryPath,
    makeItem("INVALID", {
      tags: ["tagged", "thumbnail_failed"],
    })
  );

  await assert.rejects(
    () =>
      runReleaseReview({
        command: "review",
        projectRoot,
        libraryPath,
        timestamp,
      }),
    /Phase 1 eligibility/i
  );

  assert.deepEqual(readEagleItemMetadata(libraryPath, "VALID").tags, ["tagged"]);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "INVALID").tags, [
    "tagged",
    "thumbnail_failed",
  ]);
  assert.equal(fs.existsSync(reviewDir), false);
});

test("runReleaseReview fails fast when an active-batch item is missing from Eagle", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const timestamp = "2026-03-24T15:00:00.000Z";
  const reviewDir = path.join(projectRoot, ".tmp", "release-review", timestamp);

  writeProjectCategories(projectRoot, {});
  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["PRESENT", "MISSING"],
  });
  writeEagleItem(libraryPath, makeItem("PRESENT", { tags: ["tagged"] }));

  await assert.rejects(
    () =>
      runReleaseReview({
        command: "review",
        projectRoot,
        libraryPath,
        timestamp,
      }),
    /missing from Eagle/i
  );

  assert.deepEqual(readEagleItemMetadata(libraryPath, "PRESENT").tags, ["tagged"]);
  assert.equal(fs.existsSync(reviewDir), false);
});

test("runReleaseReview rolls back metadata mutations and leaves no committed review artifacts when a metadata write fails", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const timestamp = "2026-03-24T16:00:00.000Z";
  const reviewDir = path.join(projectRoot, ".tmp", "release-review", timestamp);

  writeProjectCategories(projectRoot, {});
  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["FIRST", "SECOND"],
  });
  writeEagleItem(libraryPath, makeItem("FIRST", { tags: ["tagged"] }));
  writeEagleItem(
    libraryPath,
    makeItem("SECOND", {
      name: "Updated Changed Name",
      tags: ["tagged", "reflix:approved"],
    })
  );
  writeExportedClip(projectRoot, "SECOND", {
    name: "Older Changed Name",
    tags: ["tagged"],
    folders: ["folder-1"],
    annotation: "",
    star: 0,
    duration: 3.2,
    width: 1280,
    height: 720,
  });

  const originalRenameSync = fs.renameSync;
  let firstMetadataRenameCount = 0;
  fs.renameSync = function patchedRenameSync(oldPath, newPath) {
    if (
      path.resolve(String(newPath)) ===
      path.join(libraryPath, "images", "FIRST.info", "metadata.json")
    ) {
      firstMetadataRenameCount += 1;
    }

    if (
      path.resolve(String(newPath)) ===
      path.join(libraryPath, "images", "SECOND.info", "metadata.json")
    ) {
      throw new Error("metadata write failed");
    }

    return originalRenameSync.call(this, oldPath, newPath);
  };

  try {
    await assert.rejects(
      () =>
        runReleaseReview({
          command: "review",
          projectRoot,
          libraryPath,
          timestamp,
        }),
      /metadata write failed/
    );
  } finally {
    fs.renameSync = originalRenameSync;
  }

  assert.deepEqual(readEagleItemMetadata(libraryPath, "FIRST").tags, ["tagged"]);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "SECOND").tags, [
    "tagged",
    "reflix:approved",
  ]);
  assert.equal(firstMetadataRenameCount > 0, true);
  assert.equal(fs.existsSync(reviewDir), false);
});

test("runReleaseReview preserves metadata backups when rollback is incomplete", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const timestamp = "2026-03-24T17:00:00.000Z";
  const reviewDir = path.join(projectRoot, ".tmp", "release-review", timestamp);
  const backupRoot = path.join(projectRoot, ".tmp", "release-review-backups");

  writeProjectCategories(projectRoot, {});
  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["FIRST", "SECOND"],
  });
  writeEagleItem(libraryPath, makeItem("FIRST", { tags: ["tagged"] }));
  writeEagleItem(
    libraryPath,
    makeItem("SECOND", {
      name: "Updated Changed Name",
      tags: ["tagged", "reflix:approved"],
    })
  );
  writeExportedClip(projectRoot, "SECOND", {
    name: "Older Changed Name",
    tags: ["tagged"],
    folders: ["folder-1"],
    annotation: "",
    star: 0,
    duration: 3.2,
    width: 1280,
    height: 720,
  });

  const originalRenameSync = fs.renameSync;
  let firstMetadataRenameCount = 0;
  fs.renameSync = function patchedRenameSync(oldPath, newPath) {
    const resolvedFrom = path.resolve(String(oldPath));
    const resolvedTo = path.resolve(String(newPath));

    if (
      resolvedTo ===
      path.join(libraryPath, "images", "FIRST.info", "metadata.json")
    ) {
      if (resolvedFrom.endsWith(".restore")) {
        throw new Error("restore failed");
      }

      firstMetadataRenameCount += 1;
    }

    if (
      resolvedTo ===
      path.join(libraryPath, "images", "SECOND.info", "metadata.json")
    ) {
      throw new Error("metadata write failed");
    }

    return originalRenameSync.call(this, oldPath, newPath);
  };

  try {
    await assert.rejects(
      () =>
        runReleaseReview({
          command: "review",
          projectRoot,
          libraryPath,
          timestamp,
        }),
      /rollback failed: Failed to roll back 1 metadata mutation/i
    );
  } finally {
    fs.renameSync = originalRenameSync;
  }

  assert.equal(firstMetadataRenameCount > 0, true);
  assert.equal(fs.existsSync(reviewDir), false);
  assert.equal(fs.existsSync(backupRoot), true);
  const backupDirs = fs.readdirSync(backupRoot);
  assert.equal(backupDirs.length > 0, true);
  assert.equal(
    fs.existsSync(path.join(backupRoot, backupDirs[0], "FIRST-metadata.json")),
    true
  );
});

test("runReleaseReview does not delete a previous successful artifact set on a failed rerun with the same timestamp", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const timestamp = "2026-03-24T18:00:00.000Z";
  const reviewDir = path.join(projectRoot, ".tmp", "release-review", timestamp);
  const reportPath = path.join(reviewDir, "review-report.md");
  const suggestionsPath = path.join(reviewDir, "review-suggestions.json");

  writeProjectCategories(projectRoot, {});
  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["FIRST", "SECOND"],
  });
  writeEagleItem(libraryPath, makeItem("FIRST", { tags: ["tagged"] }));
  writeEagleItem(
    libraryPath,
    makeItem("SECOND", {
      name: "Updated Changed Name",
      tags: ["tagged", "reflix:approved"],
    })
  );
  writeExportedClip(projectRoot, "SECOND", {
    name: "Older Changed Name",
    tags: ["tagged"],
    folders: ["folder-1"],
    annotation: "",
    star: 0,
    duration: 3.2,
    width: 1280,
    height: 720,
  });

  await runReleaseReview({
    command: "review",
    projectRoot,
    libraryPath,
    timestamp,
  });

  const originalReport = fs.readFileSync(reportPath, "utf-8");
  const originalSuggestions = fs.readFileSync(suggestionsPath, "utf-8");
  writeEagleItem(
    libraryPath,
    makeItem("SECOND", {
      name: "Updated Changed Name",
      tags: ["tagged", "reflix:approved"],
    })
  );

  const originalRenameSync = fs.renameSync;
  fs.renameSync = function patchedRenameSync(oldPath, newPath) {
    if (
      path.resolve(String(newPath)) ===
      path.join(libraryPath, "images", "SECOND.info", "metadata.json")
    ) {
      throw new Error("metadata write failed");
    }

    return originalRenameSync.call(this, oldPath, newPath);
  };

  try {
    await assert.rejects(
      () =>
        runReleaseReview({
          command: "review",
          projectRoot,
          libraryPath,
          timestamp,
        }),
      /metadata write failed/
    );
  } finally {
    fs.renameSync = originalRenameSync;
  }

  assert.equal(fs.existsSync(reportPath), true);
  assert.equal(fs.existsSync(suggestionsPath), true);
  assert.equal(fs.readFileSync(reportPath, "utf-8"), originalReport);
  assert.equal(fs.readFileSync(suggestionsPath, "utf-8"), originalSuggestions);
});

test("runReleaseReview keeps the previous artifact set intact when artifact publication fails on a rerun with the same timestamp", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const timestamp = "2026-03-24T19:00:00.000Z";
  const reviewDir = path.join(projectRoot, ".tmp", "release-review", timestamp);
  const reportPath = path.join(reviewDir, "review-report.md");
  const suggestionsPath = path.join(reviewDir, "review-suggestions.json");

  writeProjectCategories(projectRoot, {});
  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["FIRST", "SECOND"],
  });
  writeEagleItem(libraryPath, makeItem("FIRST", { tags: ["tagged"] }));
  writeEagleItem(
    libraryPath,
    makeItem("SECOND", {
      name: "Updated Changed Name",
      tags: ["tagged", "reflix:approved"],
    })
  );
  writeExportedClip(projectRoot, "SECOND", {
    name: "Older Changed Name",
    tags: ["tagged"],
    folders: ["folder-1"],
    annotation: "",
    star: 0,
    duration: 3.2,
    width: 1280,
    height: 720,
  });

  await runReleaseReview({
    command: "review",
    projectRoot,
    libraryPath,
    timestamp,
  });

  const originalReport = fs.readFileSync(reportPath, "utf-8");
  const originalSuggestions = fs.readFileSync(suggestionsPath, "utf-8");

  writeEagleItem(
    libraryPath,
    makeItem("FIRST", {
      name: "Updated First Name",
      tags: ["tagged"],
    })
  );

  const originalWriteFileSync = fs.writeFileSync;
  fs.writeFileSync = function patchedWriteFileSync(filePath, data, options) {
    const resolvedPath = path.resolve(String(filePath));

    if (
      resolvedPath.includes(".staging-") &&
      resolvedPath.endsWith(`${path.sep}review-report.md`)
    ) {
      throw new Error("artifact write failed");
    }

    return originalWriteFileSync.call(this, filePath, data, options);
  };

  try {
    await assert.rejects(
      () =>
        runReleaseReview({
          command: "review",
          projectRoot,
          libraryPath,
          timestamp,
        }),
      /artifact write failed/
    );
  } finally {
    fs.writeFileSync = originalWriteFileSync;
  }

  assert.equal(fs.existsSync(reportPath), true);
  assert.equal(fs.existsSync(suggestionsPath), true);
  assert.equal(fs.readFileSync(reportPath, "utf-8"), originalReport);
  assert.equal(fs.readFileSync(suggestionsPath, "utf-8"), originalSuggestions);
});

test("runReleaseReview does not roll back committed artifacts or metadata when backup cleanup fails", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const timestamp = "2026-03-24T20:00:00.000Z";
  const reviewDir = path.join(projectRoot, ".tmp", "release-review", timestamp);
  const reviewReportPath = path.join(reviewDir, "review-report.md");
  const reviewSuggestionsPath = path.join(reviewDir, "review-suggestions.json");
  const backupRoot = path.join(projectRoot, ".tmp", "release-review-backups");

  writeProjectCategories(projectRoot, {});
  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["FIRST", "SECOND"],
  });
  writeEagleItem(libraryPath, makeItem("FIRST", { tags: ["tagged"] }));
  writeEagleItem(
    libraryPath,
    makeItem("SECOND", {
      name: "Updated Changed Name",
      tags: ["tagged", "reflix:approved"],
    })
  );
  writeExportedClip(projectRoot, "SECOND", {
    name: "Older Changed Name",
    tags: ["tagged"],
    folders: ["folder-1"],
    annotation: "",
    star: 0,
    duration: 3.2,
    width: 1280,
    height: 720,
  });

  const originalRmSync = fs.rmSync;
  fs.rmSync = function patchedRmSync(targetPath, options) {
    const resolvedPath = path.resolve(String(targetPath));

    if (resolvedPath.startsWith(backupRoot)) {
      throw new Error("backup cleanup failed");
    }

    return originalRmSync.call(this, targetPath, options);
  };

  let result;
  try {
    result = await runReleaseReview({
      command: "review",
      projectRoot,
      libraryPath,
      timestamp,
    });
  } finally {
    fs.rmSync = originalRmSync;
  }

  assert.equal(result.backupCleanupFailed, true);
  assert.equal(fs.existsSync(reviewReportPath), true);
  assert.equal(fs.existsSync(reviewSuggestionsPath), true);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "FIRST").tags, [
    "tagged",
    "reflix:review-requested",
  ]);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "SECOND").tags, [
    "tagged",
    "reflix:approved",
    "reflix:review-requested",
  ]);
  assert.equal(fs.existsSync(backupRoot), true);
});

test("runReleaseReview preserves committed metadata and new final artifacts when old artifact backup cleanup fails on a same-timestamp rerun", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  const timestamp = "2026-03-24T21:00:00.000Z";
  const reviewDir = path.join(projectRoot, ".tmp", "release-review", timestamp);
  const reviewReportPath = path.join(reviewDir, "review-report.md");
  const reviewSuggestionsPath = path.join(reviewDir, "review-suggestions.json");

  writeProjectCategories(projectRoot, {});
  writeReleaseBatch(projectRoot, {
    name: "mvp-10",
    ids: ["FIRST", "SECOND"],
  });
  writeEagleItem(libraryPath, makeItem("FIRST", { tags: ["tagged"] }));
  writeEagleItem(
    libraryPath,
    makeItem("SECOND", {
      name: "Updated Changed Name",
      tags: ["tagged", "reflix:approved"],
    })
  );
  writeExportedClip(projectRoot, "SECOND", {
    name: "Older Changed Name",
    tags: ["tagged"],
    folders: ["folder-1"],
    annotation: "",
    star: 0,
    duration: 3.2,
    width: 1280,
    height: 720,
  });

  await runReleaseReview({
    command: "review",
    projectRoot,
    libraryPath,
    timestamp,
  });

  writeEagleItem(
    libraryPath,
    makeItem("FIRST", {
      name: "Updated First Name",
      tags: ["tagged"],
    })
  );

  const originalRmSync = fs.rmSync;
  fs.rmSync = function patchedRmSync(targetPath, options) {
    const resolvedPath = path.resolve(String(targetPath));

    if (
      resolvedPath.includes(".backup-") &&
      resolvedPath.startsWith(path.join(projectRoot, ".tmp", "release-review"))
    ) {
      throw new Error("old artifact backup cleanup failed");
    }

    return originalRmSync.call(this, targetPath, options);
  };

  let result;
  try {
    result = await runReleaseReview({
      command: "review",
      projectRoot,
      libraryPath,
      timestamp,
    });
  } finally {
    fs.rmSync = originalRmSync;
  }

  assert.equal(result.artifactBackupCleanupFailed, true);
  assert.equal(fs.existsSync(reviewReportPath), true);
  assert.equal(fs.existsSync(reviewSuggestionsPath), true);
  assert.match(fs.readFileSync(reviewReportPath, "utf-8"), /Updated First Name/);
  assert.match(fs.readFileSync(reviewSuggestionsPath, "utf-8"), /Updated First Name/);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "FIRST").tags, [
    "tagged",
    "reflix:review-requested",
  ]);
  assert.deepEqual(readEagleItemMetadata(libraryPath, "SECOND").tags, [
    "tagged",
    "reflix:approved",
    "reflix:review-requested",
  ]);
});

test("parseReleaseApprovalCliArgs accepts --all for scan", () => {
  const parsed = parseReleaseApprovalCliArgs(["scan", "--all"]);

  assert.equal(parsed.command, "scan");
  assert.equal(parsed.includeAllEligible, true);
});

test("release approval CLI review branch prints summary and review artifact paths", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-release-review-cli-"));
  const libraryPath = path.join(projectRoot, "Fixture.library");
  fs.mkdirSync(path.join(projectRoot, "config"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, ".tmp"), { recursive: true });
  fs.mkdirSync(path.join(libraryPath, "images"), { recursive: true });

  writeProjectCategories(projectRoot, {});
  writeReleaseBatch(projectRoot, {
    name: "cli-batch",
    ids: ["CLI1"],
  });
  writeEagleItem(libraryPath, makeItem("CLI1", { tags: ["tagged"] }));

  const output = execFileSync(
    process.execPath,
    [
      SCRIPT_PATH,
      "review",
      "--project-root",
      projectRoot,
      "--library",
      libraryPath,
      "--timestamp",
      "2026-03-24T12:00:00.000Z",
    ],
    { encoding: "utf8" }
  );

  assert.match(output, /검토 요약:/);
  assert.match(output, /검토 필요: 1/);
  assert.match(
    output,
    /검토 보고서: .*\.tmp\/release-review\/2026-03-24T12:00:00\.000Z\/review-report\.md/
  );
  assert.match(
    output,
    /검토 제안: .*\.tmp\/release-review\/2026-03-24T12:00:00\.000Z\/review-suggestions\.json/
  );
});

test("release approval CLI scan branch prints Korean scan summary labels", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-release-scan-cli-"));
  const libraryPath = path.join(projectRoot, "Fixture.library");
  fs.mkdirSync(path.join(projectRoot, "config"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, ".tmp"), { recursive: true });
  fs.mkdirSync(path.join(libraryPath, "images"), { recursive: true });

  writePublishedState(projectRoot, {});
  writeReleaseBatch(projectRoot, {
    name: "cli-batch",
    ids: ["CLI_SCAN_1"],
  });
  writeEagleItem(libraryPath, makeItem("CLI_SCAN_1", { tags: ["tagged"] }));

  const output = execFileSync(
    process.execPath,
    [
      SCRIPT_PATH,
      "scan",
      "--project-root",
      projectRoot,
      "--library",
      libraryPath,
      "--timestamp",
      "2026-03-24T12:00:00.000Z",
    ],
    { encoding: "utf8" }
  );

  assert.match(output, /범위: active-batch/);
  assert.match(output, /검사한 적격 아이템: 1개/);
  assert.match(output, /선택된 아이템: 1개/);
  assert.match(output, /보류 아이템: 0개/);
  assert.match(
    output,
    /제안 배치: .*\.tmp\/release-approval\/2026-03-24T12:00:00\.000Z\/release-batch\.proposed\.json/
  );
  assert.match(
    output,
    /제안 보고서: .*\.tmp\/release-approval\/2026-03-24T12:00:00\.000Z\/proposal-report\.md/
  );
});

// ---------------------------------------------------------------------------
// parseReleaseApprovalCliArgs — go / status
// ---------------------------------------------------------------------------

test("parseReleaseApprovalCliArgs accepts go command", () => {
  const parsed = parseReleaseApprovalCliArgs(["go", "--review", "--r2"]);
  assert.equal(parsed.command, "go");
  assert.equal(parsed.review, true);
  assert.equal(parsed.r2, true);
});

test("parseReleaseApprovalCliArgs accepts status command", () => {
  const parsed = parseReleaseApprovalCliArgs(["status"]);
  assert.equal(parsed.command, "status");
});

// ---------------------------------------------------------------------------
// smokeCheckExportArtifacts
// ---------------------------------------------------------------------------

test("smokeCheck passes when all artifacts exist", () => {
  const { projectRoot } = createTempProject();
  const id = "SMOKE1";

  // Create all expected files
  fs.mkdirSync(path.join(projectRoot, "public", "data", "clips"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "data", "browse"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "videos"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "previews"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "thumbnails"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "src", "data"), { recursive: true });

  fs.writeFileSync(path.join(projectRoot, "public", "data", "clips", `${id}.json`), "{}");
  fs.writeFileSync(path.join(projectRoot, "public", "videos", `${id}.mp4`), "v");
  fs.writeFileSync(path.join(projectRoot, "public", "previews", `${id}.mp4`), "p");
  fs.writeFileSync(path.join(projectRoot, "public", "thumbnails", `${id}.webp`), "t");
  fs.writeFileSync(path.join(projectRoot, "public", "data", "browse", "summary.json"), "{}");
  fs.writeFileSync(path.join(projectRoot, "public", "data", "browse", "projection.json"), "{}");
  fs.writeFileSync(
    path.join(projectRoot, "src", "data", "index.json"),
    JSON.stringify({ clips: [{ id }] })
  );

  const result = smokeCheckExportArtifacts({ projectRoot, batchIds: [id] });
  assert.equal(result.passed, true);
  assert.deepEqual(result.errors, []);
});

test("smokeCheck fails when clip JSON is missing", () => {
  const { projectRoot } = createTempProject();
  const id = "MISSING1";

  fs.mkdirSync(path.join(projectRoot, "public", "data", "browse"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "videos"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "previews"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "thumbnails"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "src", "data"), { recursive: true });

  fs.writeFileSync(path.join(projectRoot, "public", "videos", `${id}.mp4`), "v");
  fs.writeFileSync(path.join(projectRoot, "public", "previews", `${id}.mp4`), "p");
  fs.writeFileSync(path.join(projectRoot, "public", "thumbnails", `${id}.webp`), "t");
  fs.writeFileSync(path.join(projectRoot, "public", "data", "browse", "summary.json"), "{}");
  fs.writeFileSync(path.join(projectRoot, "public", "data", "browse", "projection.json"), "{}");
  fs.writeFileSync(
    path.join(projectRoot, "src", "data", "index.json"),
    JSON.stringify({ clips: [{ id }] })
  );

  const result = smokeCheckExportArtifacts({ projectRoot, batchIds: [id] });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((e) => e.includes("clip JSON 누락")));
});

// ---------------------------------------------------------------------------
// runReleaseGo — auto mode
// ---------------------------------------------------------------------------

test("runReleaseGo auto-mode runs full pipeline with mocks", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  writePublishedState(projectRoot, {});
  writeReleaseBatch(projectRoot, { name: "test-batch", ids: ["GO1"] });
  writeEagleItem(libraryPath, makeItem("GO1", { aiTags: { test: true } }));

  // Create export artifacts so smoke check passes
  fs.mkdirSync(path.join(projectRoot, "public", "data", "clips"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "data", "browse"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "videos"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "previews"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "thumbnails"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "src", "data"), { recursive: true });

  fs.writeFileSync(path.join(projectRoot, "public", "data", "clips", "GO1.json"), "{}");
  fs.writeFileSync(path.join(projectRoot, "public", "videos", "GO1.mp4"), "v");
  fs.writeFileSync(path.join(projectRoot, "public", "previews", "GO1.mp4"), "p");
  fs.writeFileSync(path.join(projectRoot, "public", "thumbnails", "GO1.webp"), "t");
  fs.writeFileSync(path.join(projectRoot, "public", "data", "browse", "summary.json"), "{}");
  fs.writeFileSync(path.join(projectRoot, "public", "data", "browse", "projection.json"), "{}");
  fs.writeFileSync(
    path.join(projectRoot, "src", "data", "index.json"),
    JSON.stringify({ clips: [{ id: "GO1" }] })
  );

  const result = await runReleaseGo(
    { command: "go", projectRoot, libraryPath, timestamp: "2026-03-27T12:00:00.000Z" },
    {
      runExport: async () => ({ runId: "test-run", failed: 0 }),
      runBackfill: async () => ({ successCount: 0, failureCount: 0 }),
      runMarkPublished: async () => ({ updatedIds: ["GO1"] }),
    }
  );

  assert.equal(result.command, "go");
  assert.equal(result.skipped, false);
  assert.deepEqual(result.batchIds, ["GO1"]);

  // Verify release-batch.json was written
  const batch = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "config", "release-batch.json"), "utf-8")
  );
  assert.deepEqual(batch.ids, ["GO1"]);
});

test("runReleaseGo skips when no candidates", async () => {
  const { projectRoot, libraryPath } = createTempProject();

  // Published state already has the item — no new candidates
  const item = makeItem("DONE1");
  writeEagleItem(libraryPath, item);
  writeReleaseBatch(projectRoot, { name: "test-batch", ids: ["DONE1"] });

  // Compute signature using the item as readEagleLibrary would return it (with file paths)
  const { readEagleLibrary: readLib } = await import("./eagle-reader.mjs");
  const [readItem] = readLib(libraryPath, { ids: ["DONE1"] });
  writePublishedState(projectRoot, {
    DONE1: {
      publishedAt: "2026-03-27T00:00:00.000Z",
      batchName: "test-batch",
      eagleMtime: readItem.mtime,
      exportSignature: computeExportSignature(readItem),
    },
  });

  const result = await runReleaseGo(
    { command: "go", projectRoot, libraryPath, timestamp: "2026-03-27T12:00:00.000Z" },
    {
      runExport: async () => ({ runId: "test", failed: 0 }),
      runBackfill: async () => ({ successCount: 0, failureCount: 0 }),
      runMarkPublished: async () => ({ updatedIds: [] }),
    }
  );

  assert.equal(result.skipped, true);
  assert.equal(result.reason, "no-candidates");
});

test("runReleaseGo stops on export failure", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  writePublishedState(projectRoot, {});
  writeReleaseBatch(projectRoot, { name: "test-batch", ids: ["FAIL1"] });
  writeEagleItem(libraryPath, makeItem("FAIL1", { aiTags: { test: true } }));

  const result = await runReleaseGo(
    { command: "go", projectRoot, libraryPath, timestamp: "2026-03-27T12:00:00.000Z" },
    {
      runExport: async () => ({ runId: "fail-run", failed: 2 }),
      runBackfill: async () => ({ successCount: 0, failureCount: 0 }),
      runMarkPublished: async () => ({ updatedIds: [] }),
    }
  );

  assert.equal(result.error, "export-failed");
});

// ---------------------------------------------------------------------------
// runReleaseStatus
// ---------------------------------------------------------------------------

test("runReleaseStatus returns batch and library info", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  writeReleaseBatch(projectRoot, { name: "batch-test", ids: ["S1", "S2"] });
  writePublishedState(projectRoot, {
    S1: {
      publishedAt: "2026-03-27T00:00:00.000Z",
      batchName: "batch-test",
      eagleMtime: 1711234567890,
      exportSignature: "sha256:abc",
    },
  });

  writeEagleItem(libraryPath, makeItem("S1"));
  writeEagleItem(libraryPath, makeItem("S2"));
  writeEagleItem(libraryPath, makeItem("S3"));

  const result = await runReleaseStatus({ command: "status", projectRoot, libraryPath });

  assert.equal(result.batch.name, "batch-test");
  assert.equal(result.batch.size, 2);
  assert.equal(result.batch.published, 1);
  assert.equal(result.published.total, 1);
  assert.equal(result.library.eligible, 3);
});

test("runReleaseStatus handles no active batch", async () => {
  const { projectRoot, libraryPath } = createTempProject();
  // No release-batch.json written

  const result = await runReleaseStatus({ command: "status", projectRoot, libraryPath });

  assert.equal(result.batch, null);
  assert.equal(result.published.total, 0);
});
