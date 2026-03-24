import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildProposalBatch,
  buildReleaseApprovalArtifacts,
  buildReleaseReviewArtifacts,
  computeExportSignature,
  loadPublishedState,
  savePublishedState,
} from "./release-approval-state.mjs";

function createTempProject() {
  const projectRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "reflix-release-approval-state-")
  );

  fs.mkdirSync(path.join(projectRoot, "config"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, ".tmp"), { recursive: true });

  return projectRoot;
}

test("buildReleaseApprovalArtifacts resolves proposal files under .tmp/release-approval/<timestamp>/", () => {
  const artifacts = buildReleaseApprovalArtifacts({
    timestamp: "2026-03-24T12:00:00.000Z",
    projectRoot: "/repo",
  });

  assert.deepEqual(artifacts, {
    proposalDir: "/repo/.tmp/release-approval/2026-03-24T12:00:00.000Z",
    proposalBatchPath:
      "/repo/.tmp/release-approval/2026-03-24T12:00:00.000Z/release-batch.proposed.json",
    proposalReportPath:
      "/repo/.tmp/release-approval/2026-03-24T12:00:00.000Z/proposal-report.md",
    publishedStatePath: "/repo/config/published-state.json",
  });
});

test("buildReleaseReviewArtifacts resolves review files under .tmp/release-review/<timestamp>/", () => {
  const artifacts = buildReleaseReviewArtifacts({
    timestamp: "2026-03-24T12:00:00.000Z",
    projectRoot: "/repo",
  });

  assert.deepEqual(artifacts, {
    reviewDir: "/repo/.tmp/release-review/2026-03-24T12:00:00.000Z",
    reviewReportPath:
      "/repo/.tmp/release-review/2026-03-24T12:00:00.000Z/review-report.md",
    reviewSuggestionsPath:
      "/repo/.tmp/release-review/2026-03-24T12:00:00.000Z/review-suggestions.json",
  });
});

test("loadPublishedState defaults to an empty v1 structure when the file is missing", () => {
  const projectRoot = createTempProject();

  assert.deepEqual(loadPublishedState({ projectRoot }), {
    version: 1,
    updatedAt: "",
    entries: {},
    path: path.join(projectRoot, "config", "published-state.json"),
  });
});

test("loadPublishedState normalizes entries read from disk", () => {
  const projectRoot = createTempProject();
  const publishedStatePath = path.join(projectRoot, "config", "published-state.json");

  fs.writeFileSync(
    publishedStatePath,
    JSON.stringify(
      {
        version: 1,
        updatedAt: 123,
        entries: {
          ITEM1: {
            publishedAt: 456,
            batchName: 789,
            eagleMtime: "1711272000000",
            exportSignature: 987,
            extraField: "ignored",
          },
        },
      },
      null,
      2
    )
  );

  assert.deepEqual(loadPublishedState({ projectRoot }), {
    version: 1,
    updatedAt: "123",
    entries: {
      ITEM1: {
        publishedAt: "456",
        batchName: "789",
        eagleMtime: 1711272000000,
        exportSignature: "987",
      },
    },
    path: publishedStatePath,
  });
});

test("savePublishedState writes atomically", () => {
  const projectRoot = createTempProject();
  const publishedStatePath = path.join(projectRoot, "config", "published-state.json");
  fs.writeFileSync(
    publishedStatePath,
    JSON.stringify(
      {
        version: 1,
        updatedAt: "old",
        entries: {
          OLD: {
            publishedAt: "old",
            batchName: "old",
            eagleMtime: 1,
            exportSignature: "sha256:old",
          },
        },
      },
      null,
      2
    )
  );

  const originalRenameSync = fs.renameSync;
  const originalRename = fs.promises.rename;
  const state = {
    version: 1,
    updatedAt: "2026-03-24T12:00:00.000Z",
    entries: {
      NEW: {
        publishedAt: "2026-03-24T12:00:00.000Z",
        batchName: "mvp-10",
        eagleMtime: 1711272000000,
        exportSignature: "sha256:new",
      },
    },
  };

  fs.renameSync = () => {
    throw new Error("rename failed");
  };
  fs.promises.rename = async () => {
    throw new Error("rename failed");
  };

  try {
    assert.throws(() => savePublishedState({ projectRoot, state }), /rename failed/);
    assert.deepEqual(JSON.parse(fs.readFileSync(publishedStatePath, "utf-8")), {
      version: 1,
      updatedAt: "old",
      entries: {
        OLD: {
          publishedAt: "old",
          batchName: "old",
          eagleMtime: 1,
          exportSignature: "sha256:old",
        },
      },
    });
  } finally {
    fs.renameSync = originalRenameSync;
    fs.promises.rename = originalRename;
  }
});

test("computeExportSignature ignores Reflix operation tags", () => {
  const base = {
    id: "ITEM1",
    name: "연출 아케인 힘듦",
    tags: ["연출", "아케인", "reflix:approved"],
    folders: ["F1"],
    annotation: "",
    star: 3,
    duration: 3.2,
    width: 1280,
    height: 720,
    mtime: 123,
  };

  assert.equal(
    computeExportSignature(base),
    computeExportSignature({ ...base, tags: ["연출", "아케인", "reflix:published"] })
  );
});

test("computeExportSignature changes when content fields change", () => {
  const base = {
    id: "ITEM1",
    name: "기본 이름",
    tags: ["아케인", "연출", "reflix:hold"],
    folders: ["F1"],
    annotation: "note",
    star: 1,
    duration: 3.2,
    width: 1280,
    height: 720,
    mtime: 123,
  };

  const variants = [
    { ...base, name: "다른 이름" },
    { ...base, tags: ["아케인", "테스트"] },
    { ...base, folders: ["F2"] },
    { ...base, annotation: "different note" },
    { ...base, star: 2 },
    { ...base, width: 1920 },
    { ...base, height: 1080 },
  ];

  const baseSignature = computeExportSignature(base);

  for (const variant of variants) {
    assert.notEqual(computeExportSignature(variant), baseSignature);
  }
});

test("computeExportSignature changes when duration changes", () => {
  const base = {
    id: "ITEM1",
    name: "기본 이름",
    tags: ["아케인", "연출", "reflix:hold"],
    folders: ["F1"],
    annotation: "note",
    star: 1,
    duration: 3.2,
    width: 1280,
    height: 720,
    mtime: 123,
  };

  assert.notEqual(
    computeExportSignature(base),
    computeExportSignature({ ...base, duration: 4.2 })
  );
});

test("computeExportSignature ignores touch-only changes but changes when source media or thumbnail contents change", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-signature-"));
  const mediaPath = path.join(tempDir, "clip.mp4");
  const thumbnailPath = path.join(tempDir, "clip_thumbnail.png");

  fs.writeFileSync(mediaPath, "media-v1");
  fs.writeFileSync(thumbnailPath, "thumb-v1");

  const base = {
    id: "ITEM1",
    name: "기본 이름",
    tags: ["아케인", "연출"],
    folders: ["F1"],
    annotation: "note",
    star: 1,
    duration: 3.2,
    width: 1280,
    height: 720,
    _mediaPath: mediaPath,
    _thumbnailPath: thumbnailPath,
  };

  const mediaBaseSignature = computeExportSignature(base);

  fs.utimesSync(mediaPath, new Date(), new Date());
  assert.equal(computeExportSignature(base), mediaBaseSignature);

  fs.writeFileSync(mediaPath, "media-v2");
  assert.notEqual(computeExportSignature(base), mediaBaseSignature);

  const thumbnailBase = {
    ...base,
    _mediaPath: null,
  };
  const thumbnailBaseSignature = computeExportSignature(thumbnailBase);

  fs.utimesSync(thumbnailPath, new Date(), new Date());
  assert.equal(computeExportSignature(thumbnailBase), thumbnailBaseSignature);

  fs.writeFileSync(thumbnailPath, "thumb-v2");
  assert.notEqual(computeExportSignature(thumbnailBase), thumbnailBaseSignature);
});

test("buildProposalBatch creates a proposed batch artifact path under the timestamp directory", () => {
  const batch = buildProposalBatch({
    timestamp: "2026-03-24T12:00:00.000Z",
    ids: ["A", "B"],
  });

  assert.deepEqual(batch, {
    name: "proposal-2026-03-24T12:00:00.000Z",
    ids: ["A", "B"],
    path: ".tmp/release-approval/2026-03-24T12:00:00.000Z/release-batch.proposed.json",
  });
});
