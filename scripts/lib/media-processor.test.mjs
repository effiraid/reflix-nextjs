import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  generateAnimatedThumbnail,
  inspectWebP,
} from "./media-processor.mjs";

function createChunk(name, payload) {
  const header = Buffer.alloc(8);
  header.write(name, 0, 4, "ascii");
  header.writeUInt32LE(payload.length, 4);
  const padding = payload.length % 2 === 1 ? Buffer.from([0]) : Buffer.alloc(0);
  return Buffer.concat([header, payload, padding]);
}

function createWebPBuffer({ animated, frames, width, height }) {
  const vp8x = Buffer.alloc(10);
  vp8x[0] = animated ? 0x02 : 0x00;
  vp8x.writeUIntLE(width - 1, 4, 3);
  vp8x.writeUIntLE(height - 1, 7, 3);

  const chunks = [createChunk("VP8X", vp8x)];
  if (animated) {
    chunks.push(createChunk("ANIM", Buffer.alloc(6)));
    for (let index = 0; index < frames; index += 1) {
      chunks.push(createChunk("ANMF", Buffer.alloc(16)));
    }
  } else {
    chunks.push(createChunk("ICCP", Buffer.from([1, 2, 3, 4])));
    chunks.push(createChunk("VP8 ", Buffer.alloc(8)));
  }

  const body = Buffer.concat(chunks);
  const riffHeader = Buffer.alloc(12);
  riffHeader.write("RIFF", 0, 4, "ascii");
  riffHeader.writeUInt32LE(body.length + 4, 4);
  riffHeader.write("WEBP", 8, 4, "ascii");
  return Buffer.concat([riffHeader, body]);
}

test("inspectWebP detects static and animated WebP files", () => {
  const staticInfo = inspectWebP(
    createWebPBuffer({ animated: false, frames: 0, width: 480, height: 270 })
  );
  const animatedInfo = inspectWebP(
    createWebPBuffer({ animated: true, frames: 3, width: 480, height: 270 })
  );

  assert.equal(staticInfo.isAnimated, false);
  assert.equal(staticInfo.frameCount, 0);
  assert.equal(staticInfo.width, 480);
  assert.equal(animatedInfo.isAnimated, true);
  assert.equal(animatedInfo.frameCount, 3);
  assert.equal(animatedInfo.width, 480);
});

test("generateAnimatedThumbnail extracts frames and validates the output animation", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "thumb-generator-test-"));
  const outputPath = path.join(tmpRoot, "thumb.png");
  const calls = [];

  const execImpl = async (binary, args) => {
    calls.push({ binary, args });
    if (binary === "/ffmpeg-bin") {
      const outputPattern = args.at(-1);
      fs.writeFileSync(outputPattern.replace("%03d", "001"), Buffer.from("frame-1"));
      fs.writeFileSync(outputPattern.replace("%03d", "002"), Buffer.from("frame-2"));
      return { stdout: "", stderr: "" };
    }

    if (binary === "/img2webp-bin") {
      const outputIndex = args.indexOf("-o");
      const target = args[outputIndex + 1];
      fs.writeFileSync(
        target,
        createWebPBuffer({ animated: true, frames: 2, width: 480, height: 270 })
      );
      return { stdout: "", stderr: "" };
    }

    throw new Error(`Unexpected binary: ${binary}`);
  };

  const info = await generateAnimatedThumbnail("/input.mp4", outputPath, {
    execImpl,
    ffmpegBin: "/ffmpeg-bin",
    img2webpBin: "/img2webp-bin",
    tmpRoot,
  });

  assert.equal(info.isAnimated, true);
  assert.equal(info.frameCount, 2);
  assert.equal(info.width, 480);
  assert.deepEqual(
    calls.map((call) => call.binary),
    ["/ffmpeg-bin", "/img2webp-bin"]
  );
});

test("generateAnimatedThumbnail rejects non-animated output", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "thumb-generator-fail-"));
  const outputPath = path.join(tmpRoot, "thumb.png");

  const execImpl = async (binary, args) => {
    if (binary === "/ffmpeg-bin") {
      const outputPattern = args.at(-1);
      fs.writeFileSync(outputPattern.replace("%03d", "001"), Buffer.from("frame-1"));
      fs.writeFileSync(outputPattern.replace("%03d", "002"), Buffer.from("frame-2"));
      return { stdout: "", stderr: "" };
    }

    if (binary === "/img2webp-bin") {
      const outputIndex = args.indexOf("-o");
      const target = args[outputIndex + 1];
      fs.writeFileSync(
        target,
        createWebPBuffer({ animated: false, frames: 0, width: 480, height: 270 })
      );
      return { stdout: "", stderr: "" };
    }

    throw new Error(`Unexpected binary: ${binary}`);
  };

  await assert.rejects(
    generateAnimatedThumbnail("/input.mp4", outputPath, {
      execImpl,
      ffmpegBin: "/ffmpeg-bin",
      img2webpBin: "/img2webp-bin",
      tmpRoot,
    }),
    /animated WebP/
  );
});
