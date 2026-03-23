#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_LIBRARY_PATH =
  "/Users/macbook/Desktop/라이브러리/레퍼런스 - 게임,연출.library";
const DEFAULT_USAGE = `Usage:
  node scripts/eagle-phase2.mjs review [--library <path>] [--timestamp <value>]
  node scripts/eagle-phase2.mjs apply --review-file <path> [--library <path>] [--timestamp <value>]
  node scripts/eagle-phase2.mjs --help`;

function normalizeTimestamp(timestamp) {
  if (timestamp) {
    return timestamp;
  }

  return new Date().toISOString().replaceAll(":", "-");
}

function buildPhase2Artifacts(timestamp) {
  const reviewDir = `.tmp/eagle-phase2/${timestamp}/`;
  const backupDir = `.tmp/eagle-phase2-backups/${timestamp}/`;

  return {
    reviewDir,
    backupDir,
    nameReviewJson: path.join(reviewDir, "name-review.json"),
    targetSnapshotJson: path.join(reviewDir, "target-snapshot.json"),
    folderRuleReportJson: path.join(reviewDir, "folder-rule-report.json"),
    applyReportJson: path.join(reviewDir, "apply-report.json"),
  };
}

function readOptionValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }

  return value;
}

export function parsePhase2CliArgs(argv = process.argv.slice(2)) {
  const args = [...argv];

  if (args.length === 0 || args.includes("--help")) {
    return {
      mode: "help",
      usage: DEFAULT_USAGE,
    };
  }

  const mode = args[0];
  const options = {
    libraryPath: DEFAULT_LIBRARY_PATH,
    timestamp: undefined,
    reviewFile: undefined,
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--library") {
      options.libraryPath = readOptionValue(args, index, "--library");
      index += 1;
      continue;
    }

    if (arg === "--timestamp") {
      options.timestamp = readOptionValue(args, index, "--timestamp");
      index += 1;
      continue;
    }

    if (arg === "--review-file") {
      options.reviewFile = readOptionValue(args, index, "--review-file");
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  const timestamp = normalizeTimestamp(options.timestamp);
  const artifacts = buildPhase2Artifacts(timestamp);

  if (mode === "review") {
    return {
      mode,
      libraryPath: options.libraryPath,
      timestamp,
      artifacts,
    };
  }

  if (mode === "apply") {
    if (!options.reviewFile) {
      throw new Error("apply mode requires --review-file <path>");
    }

    return {
      mode,
      libraryPath: options.libraryPath,
      timestamp,
      reviewFile: options.reviewFile,
      artifacts,
    };
  }

  throw new Error(`Unknown mode: ${mode}`);
}

export function printPhase2Usage() {
  process.stdout.write(`${DEFAULT_USAGE}\n`);
}

const isMainModule = fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const parsed = parsePhase2CliArgs();

  if (parsed.mode === "help") {
    printPhase2Usage();
    process.exit(0);
  }
}
