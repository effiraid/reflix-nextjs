import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadItemState, saveItemState } from "./export-run-state.mjs";
import { resolveMediaOutputPaths, runMediaStage } from "./export-media-stage.mjs";

function createTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "reflix-export-media-stage-"));
}

function writeOutputFile(filePath, contents = "output") {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

test("runMediaStage reuses verified outputs and existing item state", async () => {
  const projectRoot = createTempProject();
  const runId = "run-1";
  const item = {
    id: "A1",
    name: "Clip A1",
    mtime: 1711272000000,
    _mediaPath: "/library/A1.mp4",
    _thumbnailPath: "/library/A1_thumbnail.png",
  };
  const outputs = resolveMediaOutputPaths(projectRoot, item.id);

  writeOutputFile(outputs.video, "video");
  writeOutputFile(outputs.preview, "preview");
  writeOutputFile(outputs.thumbnail, "thumbnail");

  saveItemState({
    projectRoot,
    runId,
    clipId: item.id,
    itemState: {
      id: item.id,
      sourceSnapshot: {
        eagleMtime: item.mtime,
        mediaPath: item._mediaPath,
        thumbnailPath: item._thumbnailPath,
      },
      media: {
        status: "completed",
        width: 1280,
        height: 720,
        lqipBase64: "data:image/jpeg;base64,reused",
        outputs: {
          video: { path: outputs.video, size: 5 },
          preview: { path: outputs.preview, size: 7 },
          thumbnail: { path: outputs.thumbnail, size: 9 },
        },
      },
    },
  });

  const summary = await runMediaStage([item], {
    projectRoot,
    runId,
    getVideoResolutionImpl: async () => {
      throw new Error("should not recalculate resolution");
    },
    generateLQIPImpl: async () => {
      throw new Error("should not regenerate lqip");
    },
    processVideoImpl: async () => {
      throw new Error("should not regenerate video");
    },
    generatePreviewImpl: async () => {
      throw new Error("should not regenerate preview");
    },
    processThumbnailImpl: async () => {
      throw new Error("should not regenerate thumbnail");
    },
  });

  assert.equal(summary.completed, 1);
  assert.equal(summary.reused, 1);
  assert.equal(summary.rebuilt, 0);
  assert.equal(summary.failed, 0);
});

test("runMediaStage rebuilds invalid outputs and stores width height and lqip", async () => {
  const projectRoot = createTempProject();
  const runId = "run-2";
  const infoDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-export-media-item-"));
  const mediaPath = path.join(infoDir, "A2.mp4");
  const thumbnailPath = path.join(infoDir, "A2_thumbnail.png");
  fs.writeFileSync(mediaPath, "source-video");
  fs.writeFileSync(thumbnailPath, "source-thumbnail");

  const item = {
    id: "A2",
    name: "Clip A2",
    mtime: 1711272001000,
    _mediaPath: mediaPath,
    _thumbnailPath: thumbnailPath,
  };
  const outputs = resolveMediaOutputPaths(projectRoot, item.id);
  writeOutputFile(outputs.video, "");
  writeOutputFile(outputs.preview, "");

  const summary = await runMediaStage([item], {
    projectRoot,
    runId,
    getVideoResolutionImpl: async () => ({ width: 1920, height: 1080 }),
    generateLQIPImpl: async () => "data:image/jpeg;base64,new-lqip",
    processVideoImpl: async (inputPath, outputPath) => {
      assert.equal(inputPath, mediaPath);
      writeOutputFile(outputPath, "new-video");
      return true;
    },
    generatePreviewImpl: async (inputPath, outputPath) => {
      assert.equal(inputPath, outputs.video);
      writeOutputFile(outputPath, "new-preview");
      return true;
    },
    processThumbnailImpl: async (inputPath, outputPath) => {
      assert.equal(inputPath, thumbnailPath);
      writeOutputFile(outputPath, "new-thumbnail");
      return true;
    },
  });

  const itemState = loadItemState({ projectRoot, runId, clipId: item.id });

  assert.equal(summary.completed, 1);
  assert.equal(summary.rebuilt, 1);
  assert.equal(summary.reused, 0);
  assert.equal(itemState.media.width, 1920);
  assert.equal(itemState.media.height, 1080);
  assert.equal(itemState.media.lqipBase64, "data:image/jpeg;base64,new-lqip");
  assert.equal(itemState.media.outputs.preview.size, "new-preview".length);
});

test("runMediaStage continues after one item fails", async () => {
  const projectRoot = createTempProject();
  const runId = "run-3";
  const infoDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-export-media-failure-"));
  const firstMediaPath = path.join(infoDir, "A3.mp4");
  const secondMediaPath = path.join(infoDir, "A4.mp4");
  const thumbPath = path.join(infoDir, "thumb.png");
  fs.writeFileSync(firstMediaPath, "video-a3");
  fs.writeFileSync(secondMediaPath, "video-a4");
  fs.writeFileSync(thumbPath, "thumb");

  const items = [
    {
      id: "A3",
      name: "Clip A3",
      mtime: 1,
      _mediaPath: firstMediaPath,
      _thumbnailPath: thumbPath,
    },
    {
      id: "A4",
      name: "Clip A4",
      mtime: 2,
      _mediaPath: secondMediaPath,
      _thumbnailPath: thumbPath,
    },
  ];

  const summary = await runMediaStage(items, {
    projectRoot,
    runId,
    concurrency: 2,
    getVideoResolutionImpl: async () => ({ width: 640, height: 360 }),
    generateLQIPImpl: async () => "data:image/jpeg;base64,lqip",
    processVideoImpl: async (inputPath, outputPath) => {
      if (inputPath === firstMediaPath) {
        throw new Error("video failed");
      }
      writeOutputFile(outputPath, "video");
      return true;
    },
    generatePreviewImpl: async (_inputPath, outputPath) => {
      writeOutputFile(outputPath, "preview");
      return true;
    },
    processThumbnailImpl: async (_inputPath, outputPath) => {
      writeOutputFile(outputPath, "thumbnail");
      return true;
    },
  });

  assert.equal(summary.completed, 1);
  assert.equal(summary.failed, 1);
  assert.equal(loadItemState({ projectRoot, runId, clipId: "A4" })?.media.status, "completed");
  assert.match(loadItemState({ projectRoot, runId, clipId: "A3" })?.lastError ?? "", /video failed/);
});
