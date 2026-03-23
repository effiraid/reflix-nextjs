import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  collectEligibleItems,
  runThumbnailPilot,
  selectPilotItems,
} from "./eagle-thumbnail-pilot.mjs";

test("collectEligibleItems returns only static uncategorized mp4 items", () => {
  const items = [
    {
      id: "STATIC_OK",
      name: "Static OK",
      ext: "mp4",
      folders: [],
      _thumbnailPath: "/tmp/static_thumbnail.png",
      _mediaPath: "/tmp/static.mp4",
      _infoDir: "/tmp/static.info",
    },
    {
      id: "ANIMATED_SKIP",
      name: "Animated",
      ext: "mp4",
      folders: [],
      _thumbnailPath: "/tmp/animated_thumbnail.png",
      _mediaPath: "/tmp/animated.mp4",
      _infoDir: "/tmp/animated.info",
    },
    {
      id: "CATEGORY_SKIP",
      name: "Categorized",
      ext: "mp4",
      folders: ["FOLDER1"],
      _thumbnailPath: "/tmp/categorized_thumbnail.png",
      _mediaPath: "/tmp/categorized.mp4",
      _infoDir: "/tmp/categorized.info",
    },
    {
      id: "EXT_SKIP",
      name: "Image",
      ext: "jpg",
      folders: [],
      _thumbnailPath: "/tmp/image_thumbnail.png",
      _mediaPath: "/tmp/image.jpg",
      _infoDir: "/tmp/image.info",
    },
  ];

  const eligible = collectEligibleItems(items, {
    resolveCategory: (folders) => (folders.length > 0 ? "some-category" : "uncategorized"),
    inspectThumbnail: (thumbnailPath) => ({
      isWebP: true,
      isAnimated: thumbnailPath.includes("animated"),
      frameCount: thumbnailPath.includes("animated") ? 4 : 0,
      fileSize: 10,
    }),
  });

  assert.deepEqual(
    eligible.map((item) => item.id),
    ["STATIC_OK"]
  );
});

test("selectPilotItems rejects non-static pilot thumbnails", () => {
  const items = [
    {
      id: "A",
      name: "Clip A",
      ext: "mp4",
      folders: [],
      _thumbnailPath: "/tmp/a_thumbnail.png",
      _mediaPath: "/tmp/a.mp4",
      _infoDir: "/tmp/a.info",
    },
    {
      id: "B",
      name: "Clip B",
      ext: "mp4",
      folders: [],
      _thumbnailPath: "/tmp/b_thumbnail.png",
      _mediaPath: "/tmp/b.mp4",
      _infoDir: "/tmp/b.info",
    },
  ];

  assert.throws(
    () =>
      selectPilotItems(items, {
        pilotIds: ["A", "B"],
        resolveCategory: () => "uncategorized",
        inspectThumbnail: (thumbnailPath) => ({
          isWebP: true,
          isAnimated: thumbnailPath.includes("b_"),
        }),
      }),
    /must currently be static/
  );
});

test("runThumbnailPilot backs up, replaces thumbnails, and writes a manifest", async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-project-"));
  const infoDir = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-item-"));
  const thumbnailPath = path.join(infoDir, "sample_thumbnail.png");
  const mediaPath = path.join(infoDir, "sample.mp4");

  fs.mkdirSync(path.join(projectRoot, "src", "data"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "src", "data", "categories.json"), "{}");
  fs.writeFileSync(thumbnailPath, Buffer.from("static-thumbnail"));
  fs.writeFileSync(mediaPath, Buffer.from("video"));

  const manifest = await runThumbnailPilot({
    libraryPath: "/fake/library",
    projectRoot,
    timestamp: "2026-03-23T22-00-00-000Z",
    pilotIds: ["TEST123"],
    readLibrary: () => [
      {
        id: "TEST123",
        name: "Pilot Clip",
        ext: "mp4",
        folders: [],
        _thumbnailPath: thumbnailPath,
        _mediaPath: mediaPath,
        _infoDir: infoDir,
      },
    ],
    resolveCategory: () => "uncategorized",
    inspectThumbnail: (inputPath) => {
      if (inputPath === thumbnailPath) {
        const content = fs.readFileSync(inputPath, "utf8");
        return {
          isWebP: true,
          isAnimated: content === "animated-thumbnail",
          frameCount: content === "animated-thumbnail" ? 4 : 0,
          width: content === "animated-thumbnail" ? 480 : 320,
          fileSize: Buffer.byteLength(content),
        };
      }

      return {
        isWebP: true,
        isAnimated: true,
        frameCount: 4,
        width: 480,
        fileSize: 17,
      };
    },
    generateThumbnail: async (_mediaInput, outputPath) => {
      fs.writeFileSync(outputPath, "animated-thumbnail");
      return {
        isAnimated: true,
        frameCount: 4,
        width: 480,
        fileSize: 17,
      };
    },
  });

  const backupPath = path.join(
    projectRoot,
    ".tmp",
    "eagle-thumbnail-backups",
    "2026-03-23T22-00-00-000Z",
    "TEST123_thumbnail.png"
  );

  assert.equal(fs.readFileSync(thumbnailPath, "utf8"), "animated-thumbnail");
  assert.equal(fs.readFileSync(backupPath, "utf8"), "static-thumbnail");
  assert.equal(manifest.entries[0].status, "success");
  assert.equal(manifest.entries[0].frameCount, 4);
  assert.equal(fs.existsSync(manifest.manifestPath), true);
});
