import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  applyStatusTagMutation,
  writeMetadataWithBackup,
} from "./eagle-metadata.mjs";

function createTempInfoEntry(metadata) {
  const infoDir = fs.mkdtempSync(path.join(os.tmpdir(), "eagle-metadata-test-"));
  const metadataPath = path.join(infoDir, "metadata.json");

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  return {
    id: metadata.id || "ITEM1",
    infoDir,
    metadataPath,
  };
}

function createRecordingIo({ failOnTempWrite = false } = {}) {
  const operations = [];

  return {
    operations,
    readFileSync: fs.readFileSync.bind(fs),
    mkdirSync: fs.mkdirSync.bind(fs),
    rmSync: fs.rmSync.bind(fs),
    writeFileSync(targetPath, data) {
      const target = String(targetPath);

      if (target.endsWith(".tmp")) {
        operations.push("write-temp");
        if (failOnTempWrite) {
          throw new Error("temp write failed");
        }
      } else if (target.endsWith(".restore")) {
        operations.push("write-restore");
      } else if (target.endsWith("metadata.json")) {
        operations.push("write-backup");
      }

      return fs.writeFileSync(targetPath, data);
    },
    renameSync(fromPath, toPath) {
      const from = String(fromPath);
      const to = String(toPath);

      if (to.endsWith("metadata.json")) {
        if (from.endsWith(".restore")) {
          operations.push("rename-restore");
        } else {
          operations.push("rename-metadata");
        }
      }

      return fs.renameSync(fromPath, toPath);
    },
  };
}

test("writeMetadataWithBackup preserves untouched fields when writing metadata", () => {
  const entry = createTempInfoEntry({
    id: "ITEM1",
    name: "Original name",
    tags: ["alpha", "beta"],
    folders: ["FOLDER1"],
    ext: "mp4",
    description: "keep-me",
    nested: { untouched: true },
  });
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "eagle-metadata-backup-"));
  const io = createRecordingIo();

  try {
    const result = writeMetadataWithBackup(
      entry,
      {
        name: "Updated name",
        tags: ["alpha", "beta", "gamma"],
        folders: ["FOLDER2"],
      },
      backupDir,
      io
    );

    const written = JSON.parse(fs.readFileSync(entry.metadataPath, "utf8"));
    const backup = JSON.parse(fs.readFileSync(result.backupPath, "utf8"));

    assert.equal(written.name, "Updated name");
    assert.equal(written.description, "keep-me");
    assert.deepEqual(written.nested, { untouched: true });
    assert.deepEqual(backup, {
      id: "ITEM1",
      name: "Original name",
      tags: ["alpha", "beta"],
      folders: ["FOLDER1"],
      ext: "mp4",
      description: "keep-me",
      nested: { untouched: true },
    });
    assert.deepEqual(io.operations, ["write-backup", "write-temp", "rename-metadata"]);
  } finally {
    fs.rmSync(entry.infoDir, { recursive: true, force: true });
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});

test("applyStatusTagMutation does not duplicate existing tags when adding status tags", () => {
  const result = applyStatusTagMutation(["alpha", "published", "beta"], {
    addTags: ["published", "reviewed", "reviewed"],
  });

  assert.deepEqual(result, ["alpha", "published", "beta", "reviewed"]);
});

test("applyStatusTagMutation adds reflix:review-requested without disturbing content tags", () => {
  const result = applyStatusTagMutation(["alpha", "beta"], {
    addTags: ["reflix:review-requested"],
  });

  assert.deepEqual(result, ["alpha", "beta", "reflix:review-requested"]);
});

test("applyStatusTagMutation preserves duplicate content tags during status-only add and remove", () => {
  const currentTags = ["alpha", "alpha", "beta"];

  const withReviewRequested = applyStatusTagMutation(currentTags, {
    addTags: ["reflix:review-requested"],
  });
  const withoutReviewRequested = applyStatusTagMutation(
    ["alpha", "alpha", "beta", "reflix:review-requested"],
    {
      removeTags: ["reflix:review-requested"],
    }
  );

  assert.deepEqual(withReviewRequested, [
    "alpha",
    "alpha",
    "beta",
    "reflix:review-requested",
  ]);
  assert.deepEqual(withoutReviewRequested, ["alpha", "alpha", "beta"]);
});

test("applyStatusTagMutation removes status tags without changing non-status tags", () => {
  const result = applyStatusTagMutation(
    ["alpha", "published", "beta", "draft", "gamma"],
    {
      removeTags: ["draft", "published"],
    }
  );

  assert.deepEqual(result, ["alpha", "beta", "gamma"]);
});

test("applyStatusTagMutation removes reflix:review-requested while preserving content tags", () => {
  const result = applyStatusTagMutation(
    ["alpha", "reflix:review-requested", "beta", "reflix:approved"],
    {
      removeTags: ["reflix:review-requested"],
    }
  );

  assert.deepEqual(result, ["alpha", "beta", "reflix:approved"]);
});

test("writeMetadataWithBackup creates the backup before replacing metadata", () => {
  const entry = createTempInfoEntry({
    id: "ITEM1",
    name: "Original name",
    tags: ["alpha"],
    folders: [],
  });
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "eagle-metadata-backup-order-"));
  const io = createRecordingIo();

  try {
    writeMetadataWithBackup(
      entry,
      {
        name: "Updated name",
      },
      backupDir,
      io
    );

    assert.deepEqual(io.operations, ["write-backup", "write-temp", "rename-metadata"]);
  } finally {
    fs.rmSync(entry.infoDir, { recursive: true, force: true });
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});

test("writeMetadataWithBackup restores original metadata when temp write fails", () => {
  const entry = createTempInfoEntry({
    id: "ITEM1",
    name: "Original name",
    tags: ["alpha"],
    folders: ["FOLDER1"],
    description: "keep-me",
  });
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "eagle-metadata-rollback-"));
  const io = createRecordingIo({ failOnTempWrite: true });

  try {
    assert.throws(
      () =>
        writeMetadataWithBackup(
          entry,
          {
            name: "Updated name",
            tags: ["alpha", "beta"],
            folders: ["FOLDER2"],
          },
          backupDir,
          io
        ),
      /temp write failed/
    );

    const restored = JSON.parse(fs.readFileSync(entry.metadataPath, "utf8"));
    const backup = JSON.parse(fs.readFileSync(path.join(backupDir, "ITEM1-metadata.json"), "utf8"));

    assert.deepEqual(restored, {
      id: "ITEM1",
      name: "Original name",
      tags: ["alpha"],
      folders: ["FOLDER1"],
      description: "keep-me",
    });
    assert.deepEqual(backup, restored);
    assert.deepEqual(io.operations, ["write-backup", "write-temp", "write-restore", "rename-restore"]);
  } finally {
    fs.rmSync(entry.infoDir, { recursive: true, force: true });
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
});
