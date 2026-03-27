import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildMergedKeepIds,
  buildMediaUploadEntries,
  parseFlags,
  recomputePublishedRelatedClips,
  resolveEagleLibraryPath,
  resolveRequestedClipIds,
} from "./export.mjs";

const TEST_FILE_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(TEST_FILE_PATH), "..");

test("parseFlags recognizes r2 and existing export options", () => {
  const flags = parseFlags([
    "--full",
    "--confirm-full-export",
    "--dry-run",
    "--prune",
    "--local",
    "--r2",
    "--batch",
    "config/canary.json",
    "--ids",
    "A1,B2",
    "--limit",
    "3",
    "--media-concurrency",
    "5",
    "--upload-concurrency",
    "7",
    "--fresh-run",
    "--resume-run",
    "run-1",
    "--force-related-full-rebuild",
  ]);

  assert.deepEqual(flags, {
    full: true,
    confirmFullExport: true,
    dryRun: true,
    prune: true,
    local: true,
    r2: true,
    batchPath: "config/canary.json",
    ids: ["A1", "B2"],
    limit: 3,
    mediaConcurrency: 5,
    uploadConcurrency: 7,
    freshRun: true,
    resumeRun: "run-1",
    forceRelatedFullRebuild: true,
  });
});

test("resolveRequestedClipIds defaults to the configured release batch", () => {
  const selection = resolveRequestedClipIds(
    parseFlags([]),
    {
      projectRoot: "/repo",
      loadBatch: (batchPath) => {
        assert.equal(batchPath, "/repo/config/release-batch.json");
        return {
          name: "mvp-10",
          ids: ["C1", "C2"],
          path: batchPath,
        };
      },
    }
  );

  assert.deepEqual(selection, {
    ids: ["C1", "C2"],
    source: "batch",
    label: "config/release-batch.json (2 ids)",
    batchName: "mvp-10",
    batchPath: "/repo/config/release-batch.json",
  });
});

test("resolveRequestedClipIds prefers explicit --batch over the default batch path", () => {
  const selection = resolveRequestedClipIds(
    parseFlags(["--batch", "config/canary.json"]),
    {
      projectRoot: "/repo",
      loadBatch: (batchPath) => {
        assert.equal(batchPath, "config/canary.json");
        return {
          name: "canary",
          ids: ["D1"],
          path: "/repo/config/canary.json",
        };
      },
    }
  );

  assert.equal(selection.source, "batch");
  assert.equal(selection.label, "config/canary.json (1 ids)");
  assert.deepEqual(selection.ids, ["D1"]);
});

test("resolveRequestedClipIds prefers --ids over a release batch", () => {
  const selection = resolveRequestedClipIds(parseFlags(["--ids", "A1,B2"]), {
    projectRoot: "/repo",
    loadBatch: () => {
      throw new Error("loadBatch should not be called when --ids is present");
    },
  });

  assert.deepEqual(selection, {
    ids: ["A1", "B2"],
    source: "ids",
    label: "--ids override (2 ids)",
    batchName: null,
    batchPath: null,
  });
});

test("resolveRequestedClipIds rejects --full without --confirm-full-export", () => {
  assert.throws(
    () =>
      resolveRequestedClipIds(parseFlags(["--full"]), {
        projectRoot: "/repo",
        loadBatch: () => {
          throw new Error("should not load batch");
        },
      }),
    /confirm-full-export/
  );
});

test("resolveRequestedClipIds allows explicit confirmed full export", () => {
  const selection = resolveRequestedClipIds(
    parseFlags(["--full", "--confirm-full-export"]),
    {
      projectRoot: "/repo",
      loadBatch: () => {
        throw new Error("loadBatch should not be called during full export");
      },
    }
  );

  assert.deepEqual(selection, {
    ids: null,
    source: "full",
    label: "full library",
    batchName: null,
    batchPath: null,
  });
});

test("buildMediaUploadEntries mirrors the relative media contract", () => {
  const projectRoot = "/repo";
  const entries = buildMediaUploadEntries(["clip-1"], projectRoot);

  assert.deepEqual(entries, [
    {
      localPath: path.join(projectRoot, "public", "videos", "clip-1.mp4"),
      publicPath: "/videos/clip-1.mp4",
    },
    {
      localPath: path.join(projectRoot, "public", "previews", "clip-1.mp4"),
      publicPath: "/previews/clip-1.mp4",
    },
    {
      localPath: path.join(projectRoot, "public", "thumbnails", "clip-1.webp"),
      publicPath: "/thumbnails/clip-1.webp",
    },
  ]);
});

test("resolveEagleLibraryPath prefers EAGLE_LIBRARY_PATH when it is set", () => {
  const libraryPath = resolveEagleLibraryPath({
    env: {
      EAGLE_LIBRARY_PATH: "/custom/library",
    },
    homedir: () => "/Users/tester",
    pathExists: () => false,
  });

  assert.equal(libraryPath, "/custom/library");
});

test("resolveEagleLibraryPath falls back to the Desktop Eagle library path", () => {
  const libraryPath = resolveEagleLibraryPath({
    env: {},
    homedir: () => "/Users/tester",
    pathExists: (candidatePath) =>
      candidatePath === "/Users/tester/Desktop/라이브러리/레퍼런스 - 게임,연출.library",
  });

  assert.equal(libraryPath, "/Users/tester/Desktop/라이브러리/레퍼런스 - 게임,연출.library");
});

test("package scripts expose incremental batch export and explicit prune commands", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8")
  );

  assert.equal(packageJson.scripts["export:batch"], "node scripts/export.mjs");
  assert.equal(packageJson.scripts["export:batch:dry"], "node scripts/export.mjs --dry-run");
  assert.equal(packageJson.scripts["export:batch:r2"], "node scripts/export.mjs --r2");
  assert.equal(packageJson.scripts["export:prune"], "node scripts/export.mjs --prune");
  assert.equal(packageJson.scripts["export:prune:dry"], "node scripts/export.mjs --prune --dry-run");
  assert.equal(
    packageJson.scripts["export:full"],
    "node scripts/export.mjs --full --confirm-full-export"
  );
  assert.equal(packageJson.scripts["ai:tag:missing"], "node scripts/ai-tag-backfill.mjs");
  assert.equal(
    packageJson.scripts["ai:tag:retry-null"],
    "node scripts/ai-tag-backfill.mjs --retry-null"
  );
  assert.equal(
    packageJson.scripts["export:batch:ai"],
    "node scripts/ai-tag-backfill.mjs && node scripts/export.mjs"
  );
});

test("buildMergedKeepIds unions existing index ids with the incoming batch", () => {
  const mergedKeepIds = buildMergedKeepIds(
    {
      clips: [{ id: "A" }, { id: "B" }],
    },
    [{ id: "B" }, { id: "C" }]
  );

  assert.deepEqual(mergedKeepIds, ["A", "B", "C"]);
});

test("recomputePublishedRelatedClips rewrites related clips for merged clips and skips missing files", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-export-"));
  const clipsDir = path.join(tmpDir, "public", "data", "clips");
  fs.mkdirSync(clipsDir, { recursive: true });

  try {
    fs.writeFileSync(
      path.join(clipsDir, "A.json"),
      JSON.stringify({
        id: "A",
        tags: ["combat"],
        folders: ["f-1"],
        relatedClips: [],
      })
    );
    fs.writeFileSync(
      path.join(clipsDir, "B.json"),
      JSON.stringify({
        id: "B",
        tags: ["combat"],
        folders: ["f-2"],
        relatedClips: [],
      })
    );

    const warnings = [];
    recomputePublishedRelatedClips(
      [{ id: "A" }, { id: "B" }, { id: "C" }],
      tmpDir,
      {
        warn: (message) => warnings.push(message),
      }
    );

    const clipA = JSON.parse(fs.readFileSync(path.join(clipsDir, "A.json"), "utf-8"));
    const clipB = JSON.parse(fs.readFileSync(path.join(clipsDir, "B.json"), "utf-8"));

    assert.deepEqual(clipA.relatedClips, ["B"]);
    assert.deepEqual(clipB.relatedClips, ["A"]);
    assert.deepEqual(warnings, ["  ⚠️ Missing clip JSON for C, skipping related computation"]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test(".env.local.example keeps Desktop Eagle defaults and same-origin local media", () => {
  const envExample = fs.readFileSync(path.join(REPO_ROOT, ".env.local.example"), "utf-8");

  assert.match(envExample, /^NEXT_PUBLIC_MEDIA_URL=$/m);
  assert.match(
    envExample,
    /^EAGLE_LIBRARY_PATH="\/Users\/macbook\/Desktop\/라이브러리\/레퍼런스 - 게임,연출\.library"$/m
  );
  assert.match(envExample, /^R2_PUBLIC_URL=https:\/\/media\.reflix\.dev$/m);
});
