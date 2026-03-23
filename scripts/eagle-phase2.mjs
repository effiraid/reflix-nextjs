#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readEagleLibrary } from "./lib/eagle-reader.mjs";

const DEFAULT_LIBRARY_PATH =
  "/Users/macbook/Desktop/라이브러리/레퍼런스 - 게임,연출.library";
const DEFAULT_USAGE = `Usage:
  node scripts/eagle-phase2.mjs review [--library <path>] [--timestamp <value>]
  node scripts/eagle-phase2.mjs apply --review-file <path> [--library <path>] [--timestamp <value>]
  node scripts/eagle-phase2.mjs --help`;
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function resolveProjectPath(relativePath) {
  return path.join(PROJECT_ROOT, relativePath);
}

function writeJsonFile(relativePath, payload) {
  const absolutePath = resolveProjectPath(relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function loadPhase2FolderRules() {
  const rulesPath = resolveProjectPath("scripts/config/eagle-phase2-folder-rules.json");
  return JSON.parse(fs.readFileSync(rulesPath, "utf8"));
}

function normalizePhase2Token(token) {
  return token.trim().replace(/^[()[\],.]+|[()[\],.]+$/g, "");
}

function extractPhase2Tokens(name) {
  return name
    .split(/\s+/)
    .map(normalizePhase2Token)
    .filter(Boolean);
}

function collectPhase2Targets(libraryPath) {
  return readEagleLibrary(libraryPath).filter(
    (item) => item.ext === "mp4" && (!item.folders || item.folders.length === 0)
  );
}

function buildPhase2TargetSnapshot(libraryPath, targets, generatedAt) {
  return {
    libraryPath,
    generatedAt,
    summary: {
      targetCount: targets.length,
    },
    entries: targets.map((item) => ({
      id: item.id,
      name: item.name,
      tags: item.tags || [],
      folders: item.folders || [],
      metadataPath: path.join(item._infoDir, "metadata.json"),
    })),
  };
}

function buildPhase2FolderRuleReport(libraryPath, targets, generatedAt) {
  const ruleData = loadPhase2FolderRules();
  const ignoredTokens = new Set(ruleData.ignoredTokens || []);
  const ruleEntries = ruleData.rules || {};

  const entries = targets.map((item) => {
    const tokens = extractPhase2Tokens(item.name);
    const matchedTokens = [];
    const appliedFolderIds = [];

    for (const token of tokens) {
      const rule = ruleEntries[token];
      if (!rule) {
        continue;
      }

      matchedTokens.push(token);
      for (const folderId of rule.folderIds || []) {
        if (!appliedFolderIds.includes(folderId)) {
          appliedFolderIds.push(folderId);
        }
      }
    }

    return {
      id: item.id,
      tokens,
      matchedTokens,
      appliedFolderIds,
      unresolvedTokens: tokens.filter(
        (token) => !ignoredTokens.has(token) && !matchedTokens.includes(token)
      ),
    };
  });

  return {
    libraryPath,
    generatedAt,
    summary: {
      targetCount: targets.length,
      matchedAtLeastOneFolder: entries.filter((entry) => entry.appliedFolderIds.length > 0)
        .length,
      unmatchedItemCount: entries.filter((entry) => entry.appliedFolderIds.length === 0).length,
    },
    entries,
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

export function runPhase2Review(parsed) {
  fs.mkdirSync(resolveProjectPath(parsed.artifacts.reviewDir), { recursive: true });
  fs.mkdirSync(resolveProjectPath(parsed.artifacts.backupDir), { recursive: true });

  const generatedAt = new Date().toISOString();
  const targets = collectPhase2Targets(parsed.libraryPath);
  const targetSnapshot = buildPhase2TargetSnapshot(parsed.libraryPath, targets, generatedAt);
  const folderRuleReport = buildPhase2FolderRuleReport(
    parsed.libraryPath,
    targets,
    generatedAt
  );

  writeJsonFile(parsed.artifacts.nameReviewJson, {
    libraryPath: parsed.libraryPath,
    generatedAt,
    summary: {
      targetCount: targets.length,
      candidateCount: 0,
    },
    entries: [],
  });
  writeJsonFile(parsed.artifacts.targetSnapshotJson, targetSnapshot);
  writeJsonFile(parsed.artifacts.folderRuleReportJson, folderRuleReport);

  process.stdout.write(`Phase 2 review artifacts written to ${parsed.artifacts.reviewDir}\n`);
}

export function runPhase2Apply(parsed) {
  const reviewFilePath = path.isAbsolute(parsed.reviewFile)
    ? parsed.reviewFile
    : path.resolve(process.cwd(), parsed.reviewFile);
  const raw = fs.readFileSync(reviewFilePath, "utf8");
  const reviewData = JSON.parse(raw);

  process.stdout.write(`Loaded review file: ${reviewFilePath}\n`);
  process.stdout.write(
    `Phase 2 apply stub executed for ${reviewData.mode || "review"}\n`
  );
}

const isMainModule = fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  try {
    const parsed = parsePhase2CliArgs();

    if (parsed.mode === "help") {
      printPhase2Usage();
      process.exit(0);
    }

    if (parsed.mode === "review") {
      runPhase2Review(parsed);
    } else if (parsed.mode === "apply") {
      runPhase2Apply(parsed);
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
