import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { buildMediaUploadEntries, parseFlags, resolveEagleLibraryPath } from "./export.mjs";

test("parseFlags recognizes r2 and existing export options", () => {
  const flags = parseFlags([
    "--full",
    "--dry-run",
    "--local",
    "--r2",
    "--ids",
    "A1,B2",
    "--limit",
    "3",
  ]);

  assert.deepEqual(flags, {
    full: true,
    dryRun: true,
    local: true,
    r2: true,
    ids: ["A1", "B2"],
    limit: 3,
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
