import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";

const exec = promisify(execFile);
export const EAGLE_THUMBNAIL_FFMPEG_BIN =
  process.env.EAGLE_THUMBNAIL_FFMPEG_BIN || "ffmpeg";
export const EAGLE_THUMBNAIL_IMG2WEBP_BIN =
  process.env.EAGLE_THUMBNAIL_IMG2WEBP_BIN || "img2webp";

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function readWebPInput(input) {
  if (Buffer.isBuffer(input)) {
    return {
      buffer: input,
      filePath: null,
      fileSize: input.length,
    };
  }

  if (typeof input === "string") {
    const buffer = fs.readFileSync(input);
    return {
      buffer,
      filePath: input,
      fileSize: buffer.length,
    };
  }

  throw new TypeError("inspectWebP expects a file path or Buffer");
}

export function inspectWebP(input) {
  const { buffer, filePath, fileSize } = readWebPInput(input);
  const isWebP =
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

  if (!isWebP) {
    return {
      filePath,
      fileSize,
      isWebP: false,
      isAnimated: false,
      frameCount: 0,
      width: null,
      height: null,
      chunks: [],
    };
  }

  let offset = 12;
  let isAnimated = false;
  let frameCount = 0;
  let width = null;
  let height = null;
  const chunks = [];

  while (offset + 8 <= buffer.length) {
    const chunkName = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;
    const chunkEnd = chunkDataOffset + chunkSize;

    if (chunkEnd > buffer.length) {
      break;
    }

    chunks.push(chunkName);

    if (chunkName === "ANIM") {
      isAnimated = true;
    }

    if (chunkName === "ANMF") {
      frameCount += 1;
    }

    if (chunkName === "VP8X" && chunkSize >= 10) {
      width = readUInt24LE(buffer, chunkDataOffset + 4) + 1;
      height = readUInt24LE(buffer, chunkDataOffset + 7) + 1;
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  return {
    filePath,
    fileSize,
    isWebP: true,
    isAnimated: isAnimated || frameCount > 0,
    frameCount,
    width,
    height,
    chunks,
  };
}

/**
 * Detect video codec using ffprobe.
 */
export async function detectCodec(inputPath) {
  const { stdout } = await exec("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=codec_name",
    "-of", "csv=p=0",
    inputPath,
  ]);
  return stdout.trim();
}

/**
 * Generate LQIP: tiny 32px first-frame JPEG → base64 string.
 */
export async function generateLQIP(inputPath) {
  const tmpPath = path.join(os.tmpdir(), `lqip_${Date.now()}_${process.pid}_${Math.random().toString(36).slice(2)}.jpg`);
  try {
    await exec("ffmpeg", [
      "-y", "-i", inputPath,
      "-vf", "select=eq(n\\,0),scale=32:-1",
      "-frames:v", "1",
      "-q:v", "50",
      tmpPath,
    ]);
    const buffer = fs.readFileSync(tmpPath);
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

/**
 * Generate short MP4 loop preview (480w, 15fps, crf 28).
 * ~3x smaller than animated WebP with better codec efficiency.
 */
export async function generatePreview(inputPath, outputPath) {
  try {
    await exec("ffmpeg", [
      "-y", "-i", inputPath,
      "-vf", "scale=480:-2,fps=15",
      "-c:v", "libx264", "-crf", "28", "-preset", "fast",
      "-an",
      "-movflags", "+faststart",
      outputPath,
    ]);
    // Delete 0-byte output (ffmpeg can create empty files on some failures)
    if (fs.existsSync(outputPath)) {
      const stat = fs.statSync(outputPath);
      if (stat.size === 0) {
        fs.unlinkSync(outputPath);
        console.warn(`  Preview generated 0-byte file, removed: ${outputPath}`);
        return false;
      }
    }
    return true;
  } catch (err) {
    // Clean up residual 0-byte file on failure
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    console.warn(`  Preview generation failed: ${err.message}`);
    return false;
  }
}

/**
 * Convert Eagle thumbnail to static WebP.
 * Eagle saves thumbnails as animated WebP with .png extension.
 * Pipeline: webpmux extracts frame 1 → output as static WebP.
 * Result is ~95% smaller than PNG.
 */
export async function processThumbnail(inputPath, outputPath) {
  if (!fs.existsSync(inputPath)) return false;

  const tmpFrame = path.join(os.tmpdir(), `thumb_${Date.now()}_${process.pid}_${Math.random().toString(36).slice(2)}.webp`);
  try {
    // Extract first frame from animated WebP
    await exec("webpmux", ["-get", "frame", "1", inputPath, "-o", tmpFrame]);
    // Re-encode as static WebP at q80 for consistent quality
    await exec("cwebp", ["-q", "80", "-quiet", tmpFrame, "-o", outputPath]);
    return true;
  } catch {
    // Fallback: if not animated, just convert directly
    try {
      await exec("cwebp", ["-q", "80", "-quiet", inputPath, "-o", outputPath]);
      return true;
    } catch {
      fs.copyFileSync(inputPath, outputPath);
      return true;
    }
  } finally {
    if (fs.existsSync(tmpFrame)) fs.unlinkSync(tmpFrame);
  }
}

/**
 * Generate an animated WebP thumbnail for Eagle, keeping the .png filename.
 * Uses ffmpeg for frame extraction and img2webp for animation encoding.
 */
export async function generateAnimatedThumbnail(inputPath, outputPath, options = {}) {
  const execImpl = options.execImpl || exec;
  const ffmpegBin = options.ffmpegBin || EAGLE_THUMBNAIL_FFMPEG_BIN;
  const img2webpBin = options.img2webpBin || EAGLE_THUMBNAIL_IMG2WEBP_BIN;
  const tmpRoot = options.tmpRoot || os.tmpdir();
  const width = options.width ?? 480;
  const fps = options.fps ?? 15;
  const quality = options.quality ?? 65;
  const frameDelayMs = options.frameDelayMs ?? 67;

  const framesDir = fs.mkdtempSync(path.join(tmpRoot, "eagle-thumb-frames-"));

  try {
    const framePattern = path.join(framesDir, "frame-%03d.png");

    await execImpl(ffmpegBin, [
      "-y",
      "-i",
      inputPath,
      "-vf",
      `fps=${fps},scale=${width}:-1`,
      "-an",
      framePattern,
    ]);

    const framePaths = fs
      .readdirSync(framesDir)
      .filter((fileName) => fileName.endsWith(".png"))
      .sort()
      .map((fileName) => path.join(framesDir, fileName));

    if (framePaths.length < 2) {
      throw new Error(
        `Animated thumbnail generation requires at least 2 frames, received ${framePaths.length}`
      );
    }

    await execImpl(img2webpBin, [
      "-loop",
      "0",
      "-lossy",
      "-q",
      String(quality),
      "-d",
      String(frameDelayMs),
      ...framePaths,
      "-o",
      outputPath,
    ]);

    const outputInfo = inspectWebP(outputPath);

    if (!outputInfo.isWebP) {
      throw new Error("Generated output is not a WebP file");
    }

    if (!outputInfo.isAnimated || outputInfo.frameCount < 2) {
      throw new Error("Generated output is not a valid animated WebP");
    }

    if (outputInfo.width !== null && outputInfo.width !== width) {
      throw new Error(
        `Generated output width ${outputInfo.width} does not match expected ${width}`
      );
    }

    return outputInfo;
  } finally {
    fs.rmSync(framesDir, { recursive: true, force: true });
  }
}

/**
 * Get actual video resolution via ffprobe.
 * Eagle often reports thumbnail resolution (640px) instead of actual.
 */
export async function getVideoResolution(inputPath) {
  const { stdout } = await exec("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=p=0",
    inputPath,
  ]);
  const [w, h] = stdout.trim().split(",").map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    throw new Error(`ffprobe returned invalid resolution: "${stdout.trim()}"`);
  }
  return { width: w, height: h };
}

/**
 * Copy video file (or transcode H.265 → H.264 if needed).
 */
export async function processVideo(inputPath, outputPath) {
  const codec = await detectCodec(inputPath);

  if (codec === "hevc" || codec === "h265") {
    console.log(`  H.265 detected, transcoding to H.264...`);
    await exec("ffmpeg", [
      "-y", "-i", inputPath,
      "-c:v", "libx264", "-crf", "23", "-preset", "medium",
      "-c:a", "copy",
      outputPath,
    ]);
  } else {
    fs.copyFileSync(inputPath, outputPath);
  }
  return true;
}
