import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readEagleLibrary } from "./eagle-reader.mjs";

const DEFAULT_USAGE = `Usage:
  node scripts/eagle-phase2.mjs review [--library <path>] [--timestamp <value>]
  node scripts/eagle-phase2.mjs apply --review-file <path> [--library <path>] [--timestamp <value>]
  node scripts/eagle-phase2.mjs --help`;
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REVIEW_ALLOWLIST_TOKENS = new Set(["33원정대", "2d", "pov", "pv", "오브", "손", "발"]);

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

function resolveOutputPath(outputDir, filename) {
  return path.isAbsolute(outputDir)
    ? path.join(outputDir, filename)
    : resolveProjectPath(path.join(outputDir, filename));
}

function writeOutputJsonFile(outputDir, filename, payload) {
  const absolutePath = resolveOutputPath(outputDir, filename);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function loadPhase2FolderRules() {
  const rulesPath = resolveProjectPath("scripts/config/eagle-phase2-folder-rules.json");
  return JSON.parse(fs.readFileSync(rulesPath, "utf8"));
}

function normalizePhase2Token(token) {
  const trimmed = token.trim();
  if (/^\(\d+\)$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed.replace(/^[()[\],.]+|[()[\],.]+$/g, "");
}

function tokenizeName(name) {
  const tokens = [];

  for (const rawToken of String(name ?? "").trim().split(/\s+/)) {
    if (!rawToken) {
      continue;
    }

    const suffixMatch = rawToken.match(/^(.*?)(\(\d+\))$/);
    if (suffixMatch) {
      const baseToken = normalizePhase2Token(suffixMatch[1]);
      if (baseToken) {
        tokens.push(baseToken);
      }
      tokens.push(suffixMatch[2]);
      continue;
    }

    const normalizedToken = normalizePhase2Token(rawToken);
    if (normalizedToken) {
      tokens.push(normalizedToken);
    }
  }

  return tokens;
}

function isReviewSuffixToken(token) {
  return /^\(\d+\)$/.test(token);
}

function isNumericReviewToken(token) {
  return /^\d+$/.test(token) || isReviewSuffixToken(token);
}

function isAdjacentDuplicateToken(tokens, index) {
  return index > 0 && tokens[index] === tokens[index - 1];
}

function isAllowlistedReviewToken(token) {
  return REVIEW_ALLOWLIST_TOKENS.has(token);
}

function levenshteinDistance(left, right) {
  const a = String(left ?? "");
  const b = String(right ?? "");

  if (a === b) {
    return 0;
  }

  if (a.length === 0) {
    return b.length;
  }

  if (b.length === 0) {
    return a.length;
  }

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];

    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost
      );
    }

    previous = current;
  }

  return previous[b.length];
}

function normalizeReviewProposal(name) {
  const tokens = tokenizeName(name);
  const normalizedTokens = [];
  const seenTokens = new Set();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (isNumericReviewToken(token)) {
      continue;
    }

    if (seenTokens.has(token)) {
      continue;
    }

    seenTokens.add(token);
    normalizedTokens.push(token);
  }

  return normalizedTokens.join(" ").trim();
}

function formatMarkdownCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function sortReviewEntries(entries) {
  return [...entries].sort((left, right) => {
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }

    return left.id.localeCompare(right.id);
  });
}

function mergeReviewEntry(existingEntry, newEntry) {
  if (!existingEntry) {
    return {
      ...newEntry,
      approved: false,
    };
  }

  const reasons = new Set(String(existingEntry.reason).split(" / ").filter(Boolean));
  for (const reason of String(newEntry.reason).split(" / ").filter(Boolean)) {
    reasons.add(reason);
  }

  const mergedEntry =
    newEntry.confidence > existingEntry.confidence
      ? {
          ...existingEntry,
          ...newEntry,
          approved: false,
        }
      : {
          ...existingEntry,
          approved: false,
        };

  mergedEntry.reason = [...reasons].join(" / ");
  mergedEntry.approved = false;
  return mergedEntry;
}

function addReviewEntry(entryMap, candidate) {
  const normalizedCandidate = {
    ...candidate,
    approved: false,
  };

  entryMap.set(candidate.id, mergeReviewEntry(entryMap.get(candidate.id), normalizedCandidate));
}

function buildReviewMarkdown(entries) {
  const rows = sortReviewEntries(entries).map((entry) =>
    [
      formatMarkdownCell(entry.id),
      formatMarkdownCell(entry.currentName),
      formatMarkdownCell(entry.proposedName),
      formatMarkdownCell(entry.reason),
      formatMarkdownCell(entry.confidence.toFixed(2)),
      formatMarkdownCell(entry.approved),
    ].join(" | ")
  );

  return [
    "| id | currentName | proposedName | reason | confidence | approved |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row} |`),
    "",
  ].join("\n");
}

function collectPhase2Targets(source) {
  const items = Array.isArray(source) ? source : readEagleLibrary(source);
  return items.filter((item) => item.ext === "mp4" && (!item.folders || item.folders.length === 0));
}

function buildNameReviewEntries(items, options = {}) {
  const sourceItems = Array.isArray(items) ? items : [];
  const entryMap = new Map();
  const groupObservations = new Map();
  const globalTokenCounts = new Map();

  for (const item of sourceItems) {
    const tokens = tokenizeName(item.name);
    const prefixKey = tokens.length >= 2 ? tokens.slice(0, 2).join(" ") : "";
    const observation = {
      item,
      tokens,
      prefixKey,
    };

    if (prefixKey) {
      const group = groupObservations.get(prefixKey) || [];
      group.push(observation);
      groupObservations.set(prefixKey, group);
    }

    for (const token of tokens) {
      if (isNumericReviewToken(token)) {
        continue;
      }

      globalTokenCounts.set(token, (globalTokenCounts.get(token) || 0) + 1);
    }

    const hasRepeatedTokens = tokens.some((token, index) => {
      if (isNumericReviewToken(token)) {
        return false;
      }

      return tokens.indexOf(token) !== index;
    });
    const hasSuffixToken = tokens.some(isReviewSuffixToken);
    const normalizedName = normalizeReviewProposal(item.name);

    if ((hasRepeatedTokens || hasSuffixToken) && normalizedName && normalizedName !== String(item.name ?? "").trim()) {
      addReviewEntry(entryMap, {
        id: item.id,
        currentName: String(item.name ?? "").trim(),
        proposedName: normalizedName,
        reason: [
          hasRepeatedTokens ? "repeated words" : null,
          hasSuffixToken ? "parenthesized sequence suffix" : null,
        ]
          .filter(Boolean)
          .join(" and "),
        confidence: hasRepeatedTokens && hasSuffixToken ? 0.98 : hasSuffixToken ? 0.97 : 0.94,
      });
    }
  }

  for (const [prefixKey, observations] of groupObservations.entries()) {
    const maxLength = Math.max(...observations.map((observation) => observation.tokens.length));

    for (let tokenIndex = 2; tokenIndex < maxLength; tokenIndex += 1) {
      const counts = new Map();

      for (const observation of observations) {
        const token = observation.tokens[tokenIndex];
        if (!token || isNumericReviewToken(token)) {
          continue;
        }

        const bucket = counts.get(token) || [];
        bucket.push(observation);
        counts.set(token, bucket);
      }

      for (const [variantToken, variantObservations] of counts.entries()) {
        if (isAllowlistedReviewToken(variantToken)) {
          continue;
        }

        const commonCandidates = [...counts.entries()].filter(([candidateToken, candidateObservations]) => {
          if (candidateToken === variantToken || isAllowlistedReviewToken(candidateToken)) {
            return false;
          }

          return (
            candidateObservations.length >= variantObservations.length * 3 &&
            levenshteinDistance(variantToken, candidateToken) <= 2
          );
        });

        if (commonCandidates.length === 0) {
          continue;
        }

        const [replacementToken] = commonCandidates.sort((left, right) => {
          if (right[1].length !== left[1].length) {
            return right[1].length - left[1].length;
          }

          return levenshteinDistance(variantToken, left[0]) - levenshteinDistance(variantToken, right[0]);
        })[0];

        for (const observation of variantObservations) {
          const candidateTokens = [...observation.tokens];
          candidateTokens[tokenIndex] = replacementToken;
          const proposedName = normalizeReviewProposal(candidateTokens.join(" "));

          addReviewEntry(entryMap, {
            id: observation.item.id,
            currentName: String(observation.item.name ?? "").trim(),
            proposedName,
            reason: `series-consistency outlier`,
            confidence: 0.92,
          });
        }
      }
    }
  }

  for (const item of sourceItems) {
    const tokens = tokenizeName(item.name);

    for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
      const rareToken = tokens[tokenIndex];
      if (!rareToken || isNumericReviewToken(rareToken) || isAllowlistedReviewToken(rareToken)) {
        continue;
      }

      if ((globalTokenCounts.get(rareToken) || 0) !== 1) {
        continue;
      }

      const candidateToken = [...globalTokenCounts.entries()]
        .filter(([token, frequency]) => {
          if (token === rareToken || isAllowlistedReviewToken(token) || frequency < 3) {
            return false;
          }

          const maxDistance = rareToken.length <= 4 ? 1 : 2;
          return levenshteinDistance(rareToken, token) <= maxDistance;
        })
        .sort((left, right) => {
          if (right[1] !== left[1]) {
            return right[1] - left[1];
          }

          return levenshteinDistance(rareToken, left[0]) - levenshteinDistance(rareToken, right[0]);
        })[0];

      if (!candidateToken) {
        continue;
      }

      const [replacementToken] = candidateToken;
      const candidateTokens = [...tokens];
      candidateTokens[tokenIndex] = replacementToken;
      const proposedName = normalizeReviewProposal(candidateTokens.join(" "));

      addReviewEntry(entryMap, {
        id: item.id,
        currentName: String(item.name ?? "").trim(),
        proposedName,
        reason: "rare-token near-match",
        confidence: 0.88,
      });
    }
  }

  const entries = sortReviewEntries([...entryMap.values()]);

  return options.includeAllCandidates === true ? entries : entries;
}

function createNameReviewArtifact({ libraryPath, entries, targetCount, outputDir }) {
  const generatedAt = new Date().toISOString();
  const reviewEntries = sortReviewEntries(entries).map((entry) => ({
    ...entry,
    approved: false,
  }));
  const nameReview = {
    libraryPath,
    generatedAt,
    summary: {
      targetCount,
      candidateCount: reviewEntries.length,
    },
    entries: reviewEntries,
  };

  writeOutputJsonFile(outputDir, "name-review.json", nameReview);
  fs.writeFileSync(resolveOutputPath(outputDir, "name-review.md"), `${buildReviewMarkdown(reviewEntries)}`);

  return {
    nameReviewJson: resolveOutputPath(outputDir, "name-review.json"),
    nameReviewMd: resolveOutputPath(outputDir, "name-review.md"),
    nameReview,
  };
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
      metadataPath: item.metadataPath || path.join(item._infoDir, "metadata.json"),
    })),
  };
}

function buildPhase2FolderRuleReport(libraryPath, targets, generatedAt) {
  const ruleData = loadPhase2FolderRules();
  const ignoredTokens = new Set(ruleData.ignoredTokens || []);
  const ruleEntries = ruleData.rules || {};

  const entries = targets.map((item) => {
    const tokens = tokenizeName(item.name);
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

function resolveLibraryPath(options = {}) {
  if (options.cliLibraryPath) {
    return options.cliLibraryPath;
  }

  const envPath = options.env?.EAGLE_LIBRARY_PATH?.trim();
  if (envPath) {
    return envPath;
  }

  const discoveredPath = path.join(
    (options.homedir || os.homedir)(),
    "Desktop",
    "라이브러리",
    "레퍼런스 - 게임,연출.library"
  );

  if ((options.pathExists || fs.existsSync)(discoveredPath)) {
    return discoveredPath;
  }

  throw new Error(
    `Could not resolve Eagle library path. Pass --library <path> or set EAGLE_LIBRARY_PATH. Tried ${discoveredPath}`
  );
}

export function parsePhase2CliArgs(
  argv = process.argv.slice(2),
  resolutionOptions = {}
) {
  const args = [...argv];

  if (args.length === 0 || args.includes("--help")) {
    return {
      mode: "help",
      usage: DEFAULT_USAGE,
    };
  }

  const mode = args[0];
  const options = {
    libraryPath: undefined,
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
  const libraryPath = resolveLibraryPath({
    ...resolutionOptions,
    cliLibraryPath: options.libraryPath,
  });

  if (mode === "review") {
    return {
      mode,
      libraryPath,
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
      libraryPath,
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
  const targets = collectPhase2Targets(readEagleLibrary(parsed.libraryPath));
  const nameReviewEntries = buildNameReviewEntries(targets);
  const targetSnapshot = buildPhase2TargetSnapshot(parsed.libraryPath, targets, generatedAt);
  const folderRuleReport = buildPhase2FolderRuleReport(
    parsed.libraryPath,
    targets,
    generatedAt
  );

  createNameReviewArtifact({
    libraryPath: parsed.libraryPath,
    entries: nameReviewEntries,
    targetCount: targets.length,
    outputDir: parsed.artifacts.reviewDir,
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

export {
  buildNameReviewEntries,
  collectPhase2Targets,
  createNameReviewArtifact,
  normalizeReviewProposal,
  tokenizeName,
};
