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
const REVIEW_PREFIX_WIDTH = 2;
const REVIEW_SERIES_FREQUENCY_MULTIPLIER = 3;
const REVIEW_SERIES_MAX_EDIT_DISTANCE = 2;
const REVIEW_RARE_MIN_FREQUENCY = 3;
const REVIEW_RARE_SHORT_TOKEN_MAX_LENGTH = 4;
const REVIEW_RARE_SHORT_TOKEN_MAX_EDIT_DISTANCE = 1;
const REVIEW_RARE_LONG_TOKEN_MAX_EDIT_DISTANCE = 2;

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

function canonicalizeLibraryPath(libraryPath) {
  const absolutePath = path.resolve(String(libraryPath ?? ""));

  try {
    return fs.realpathSync(absolutePath);
  } catch {
    return path.normalize(absolutePath);
  }
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

function ensureOutputDir(outputDir) {
  fs.mkdirSync(
    path.isAbsolute(outputDir) ? outputDir : resolveProjectPath(outputDir),
    { recursive: true }
  );
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
  return items
    .filter((item) => item.ext === "mp4" && (!item.folders || item.folders.length === 0))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function buildReviewObservation(item) {
  const tokens = tokenizeName(item.name);
  return {
    item,
    tokens,
    currentName: String(item.name ?? "").trim(),
    prefixKey: tokens.length >= REVIEW_PREFIX_WIDTH ? tokens.slice(0, REVIEW_PREFIX_WIDTH).join(" ") : "",
  };
}

function groupReviewObservationsByPrefix(items) {
  const grouped = new Map();

  for (const item of items) {
    const observation = buildReviewObservation(item);
    if (!observation.prefixKey) {
      continue;
    }

    const group = grouped.get(observation.prefixKey) || [];
    group.push(observation);
    grouped.set(observation.prefixKey, group);
  }

  return grouped;
}

function countGlobalReviewTokens(items) {
  const counts = new Map();

  for (const item of items) {
    for (const token of tokenizeName(item.name)) {
      if (isNumericReviewToken(token)) {
        continue;
      }

      counts.set(token, (counts.get(token) || 0) + 1);
    }
  }

  return counts;
}

function findRepeatedNameIssues(observation) {
  const repeatedTokens = new Set();

  for (let index = 0; index < observation.tokens.length; index += 1) {
    const token = observation.tokens[index];
    if (isNumericReviewToken(token)) {
      continue;
    }

    if (observation.tokens.indexOf(token) !== index) {
      repeatedTokens.add(token);
    }
  }

  const hasSuffixToken = observation.tokens.some(isReviewSuffixToken);
  const hasRepeatedTokens = repeatedTokens.size > 0;

  if (!hasRepeatedTokens && !hasSuffixToken) {
    return null;
  }

  return {
    proposedName: normalizeReviewProposal(observation.item.name),
    reason: [
      hasRepeatedTokens ? "repeated words" : null,
      hasSuffixToken ? "parenthesized sequence suffix" : null,
    ]
      .filter(Boolean)
      .join(" and "),
    confidence: hasRepeatedTokens && hasSuffixToken ? 0.98 : hasSuffixToken ? 0.97 : 0.94,
  };
}

function buildRepeatedNameCandidates(items) {
  const candidates = [];

  for (const item of items) {
    const observation = buildReviewObservation(item);
    const issue = findRepeatedNameIssues(observation);

    if (!issue) {
      continue;
    }

    if (!issue.proposedName || issue.proposedName === observation.currentName) {
      continue;
    }

    candidates.push({
      id: observation.item.id,
      currentName: observation.currentName,
      ...issue,
    });
  }

  return candidates;
}

function findSeriesConsistencyReplacementToken(variantToken, variantCount, candidateEntries) {
  const eligibleCandidates = [...candidateEntries.entries()].filter(
    ([candidateToken, candidateObservations]) =>
      candidateToken !== variantToken &&
      !isAllowlistedReviewToken(candidateToken) &&
      candidateObservations.length >= variantCount * REVIEW_SERIES_FREQUENCY_MULTIPLIER &&
      levenshteinDistance(variantToken, candidateToken) <= REVIEW_SERIES_MAX_EDIT_DISTANCE
  );

  if (eligibleCandidates.length === 0) {
    return null;
  }

  return eligibleCandidates
    .sort((left, right) => {
      if (right[1].length !== left[1].length) {
        return right[1].length - left[1].length;
      }

      return levenshteinDistance(variantToken, left[0]) - levenshteinDistance(variantToken, right[0]);
    })[0][0];
}

function buildSeriesConsistencyCandidates(groupedObservations) {
  const candidates = [];

  for (const observations of groupedObservations.values()) {
    const maxLength = Math.max(...observations.map((observation) => observation.tokens.length));

    for (let tokenIndex = REVIEW_PREFIX_WIDTH; tokenIndex < maxLength; tokenIndex += 1) {
      const tokensAtIndex = new Map();

      for (const observation of observations) {
        const token = observation.tokens[tokenIndex];
        if (!token || isNumericReviewToken(token)) {
          continue;
        }

        const bucket = tokensAtIndex.get(token) || [];
        bucket.push(observation);
        tokensAtIndex.set(token, bucket);
      }

      for (const [variantToken, variantObservations] of tokensAtIndex.entries()) {
        if (isAllowlistedReviewToken(variantToken)) {
          continue;
        }

        const replacementToken = findSeriesConsistencyReplacementToken(
          variantToken,
          variantObservations.length,
          tokensAtIndex
        );
        if (!replacementToken) {
          continue;
        }

        for (const observation of variantObservations) {
          const candidateTokens = [...observation.tokens];
          candidateTokens[tokenIndex] = replacementToken;
          candidates.push({
            id: observation.item.id,
            currentName: observation.currentName,
            proposedName: normalizeReviewProposal(candidateTokens.join(" ")),
            reason: "series-consistency outlier",
            confidence: 0.92,
          });
        }
      }
    }
  }

  return candidates;
}

function findRareTokenReplacementToken(rareToken, globalTokenCounts) {
  const eligibleCandidates = [...globalTokenCounts.entries()]
    .filter(([token, frequency]) => {
      if (
        token === rareToken ||
        isAllowlistedReviewToken(token) ||
        frequency < REVIEW_RARE_MIN_FREQUENCY
      ) {
        return false;
      }

      const maxDistance =
        rareToken.length <= REVIEW_RARE_SHORT_TOKEN_MAX_LENGTH
          ? REVIEW_RARE_SHORT_TOKEN_MAX_EDIT_DISTANCE
          : REVIEW_RARE_LONG_TOKEN_MAX_EDIT_DISTANCE;
      return levenshteinDistance(rareToken, token) <= maxDistance;
    })
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return levenshteinDistance(rareToken, left[0]) - levenshteinDistance(rareToken, right[0]);
    });

  return eligibleCandidates[0]?.[0] || null;
}

function buildRareTokenCandidates(items, globalTokenCounts) {
  const candidates = [];

  for (const item of items) {
    const observation = buildReviewObservation(item);

    for (let tokenIndex = 0; tokenIndex < observation.tokens.length; tokenIndex += 1) {
      const rareToken = observation.tokens[tokenIndex];
      if (!rareToken || isNumericReviewToken(rareToken) || isAllowlistedReviewToken(rareToken)) {
        continue;
      }

      if ((globalTokenCounts.get(rareToken) || 0) !== 1) {
        continue;
      }

      const replacementToken = findRareTokenReplacementToken(rareToken, globalTokenCounts);
      if (!replacementToken) {
        continue;
      }

      const candidateTokens = [...observation.tokens];
      candidateTokens[tokenIndex] = replacementToken;
      candidates.push({
        id: observation.item.id,
        currentName: observation.currentName,
        proposedName: normalizeReviewProposal(candidateTokens.join(" ")),
        reason: "rare-token near-match",
        confidence: 0.88,
      });
    }
  }

  return candidates;
}

function buildNameReviewEntries(items) {
  const sourceItems = Array.isArray(items) ? items : [];
  const entryMap = new Map();

  for (const candidate of buildRepeatedNameCandidates(sourceItems)) {
    addReviewEntry(entryMap, candidate);
  }

  for (const candidate of buildSeriesConsistencyCandidates(
    groupReviewObservationsByPrefix(sourceItems)
  )) {
    addReviewEntry(entryMap, candidate);
  }

  const globalTokenCounts = countGlobalReviewTokens(sourceItems);
  for (const candidate of buildRareTokenCandidates(sourceItems, globalTokenCounts)) {
    addReviewEntry(entryMap, candidate);
  }

  return sortReviewEntries([...entryMap.values()]);
}

function validateApprovedRenameEntries(approvedEntries) {
  const byId = new Map();

  for (const entry of Array.isArray(approvedEntries) ? approvedEntries : []) {
    if (!entry || entry.approved !== true) {
      continue;
    }

    const bucket = byId.get(entry.id) || [];
    bucket.push(entry);
    byId.set(entry.id, bucket);
  }

  for (const [id, entries] of byId.entries()) {
    if (entries.length > 1) {
      throw new Error(`Duplicate approved rename entries for item id ${id}`);
    }
  }
}

function validateNameReviewEntries(entries) {
  if (!Array.isArray(entries)) {
    throw new Error("Invalid name review artifact: entries must be an array");
  }

  for (const entry of entries) {
    const isValidEntry =
      entry &&
      typeof entry === "object" &&
      typeof entry.id === "string" &&
      typeof entry.currentName === "string" &&
      typeof entry.proposedName === "string" &&
      typeof entry.reason === "string" &&
      typeof entry.confidence === "number" &&
      typeof entry.approved === "boolean";

    if (!isValidEntry) {
      throw new Error(
        "Invalid name review artifact: entries must contain review entries with id, currentName, proposedName, reason, confidence, and approved fields"
      );
    }
  }
}

function loadApprovedNameReview(reviewFilePath) {
  const raw = fs.readFileSync(reviewFilePath, "utf8");
  const reviewData = JSON.parse(raw);
  const entries = reviewData.entries;
  validateNameReviewEntries(entries);
  const approvedEntries = entries.filter((entry) => entry && entry.approved === true);
  validateApprovedRenameEntries(approvedEntries);

  return {
    ...reviewData,
    reviewFilePath,
    entries,
    approvedEntries,
  };
}

function applyApprovedRenames(item, approvedEntries) {
  let entries;
  if (Array.isArray(approvedEntries)) {
    entries = approvedEntries;
  } else if (approvedEntries && typeof approvedEntries === "object") {
    if (!Array.isArray(approvedEntries.approvedEntries)) {
      throw new Error("applyApprovedRenames expects an approvedEntries array");
    }

    entries = approvedEntries.approvedEntries;
  } else {
    throw new Error("applyApprovedRenames expects an approvedEntries array");
  }

  validateApprovedRenameEntries(entries);

  const originalName = String(item?.name ?? "");
  const currentName = originalName.trim();
  const approvedRename = entries.find(
    (entry) =>
      entry &&
      entry.id === item?.id &&
      entry.approved === true &&
      String(entry.proposedName ?? "").trim()
  );

  if (!approvedRename) {
    return {
      ...item,
      renameApplied: false,
    };
  }

  const proposedName = String(approvedRename.proposedName).trim();
  if (proposedName === currentName) {
    return {
      ...item,
      renameApplied: false,
    };
  }

  return {
    ...item,
    name: proposedName,
    renameApplied: true,
  };
}

function syncTagsFromName(name, options) {
  void options;
  const tokens = tokenizeName(name);
  const tags = [];
  const excludedNumericTokens = [];
  const seenTags = new Set();

  for (const token of tokens) {
    if (isNumericReviewToken(token)) {
      excludedNumericTokens.push(token);
      continue;
    }

    if (seenTags.has(token)) {
      continue;
    }

    seenTags.add(token);
    tags.push(token);
  }

  return {
    name: String(name ?? "").trim(),
    tokens,
    tags,
    excludedNumericTokens,
    lossyTagSync:
      excludedNumericTokens.length > 0 || tags.length !== tokens.length - excludedNumericTokens.length,
  };
}

function buildFolderResolutionView(name, rulesConfig = {}) {
  const tagSync = syncTagsFromName(name);
  const folderSync = resolveFolderIds(tagSync.tags, rulesConfig);

  return {
    tokens: tagSync.tokens,
    tags: tagSync.tags,
    excludedNumericTokens: tagSync.excludedNumericTokens,
    folderIds: folderSync.folderIds,
    matchedTokens: folderSync.matchedTokens,
    unresolvedTokens: folderSync.unresolvedTokens,
    lossyTagSync: tagSync.lossyTagSync || folderSync.lossyTagSync,
  };
}

function resolveFolderIds(tokens, rulesConfig = {}) {
  const ignoredTokens = new Set(rulesConfig.ignoredTokens || []);
  const rules = rulesConfig.rules || {};
  const folderIds = [];
  const matchedTokens = [];
  const unresolvedTokens = [];
  const seenFolderIds = new Set();
  const seenUnresolvedTokens = new Set();
  const seenMatchedTokens = new Set();

  for (const rawToken of Array.isArray(tokens) ? tokens : []) {
    const token = normalizePhase2Token(rawToken);

    if (!token || isNumericReviewToken(token) || ignoredTokens.has(token)) {
      continue;
    }

    const rule = rules[token];
    const ruleFolderIds = Array.isArray(rule?.folderIds) ? rule.folderIds : [];

    if (ruleFolderIds.length === 0) {
      if (!seenUnresolvedTokens.has(token)) {
        seenUnresolvedTokens.add(token);
        unresolvedTokens.push(token);
      }
      continue;
    }

    if (!seenMatchedTokens.has(token)) {
      seenMatchedTokens.add(token);
      matchedTokens.push(token);
    }

    for (const folderId of ruleFolderIds) {
      if (seenFolderIds.has(folderId)) {
        continue;
      }

      seenFolderIds.add(folderId);
      folderIds.push(folderId);
    }
  }

  return {
    folderIds,
    matchedTokens,
    unresolvedTokens,
    lossyTagSync: unresolvedTokens.length > 0,
  };
}

function buildApplyMutation(item, approvedEntries, rulesConfig = {}) {
  const renamedItem = applyApprovedRenames(item, approvedEntries);
  const folderView = buildFolderResolutionView(renamedItem.name, rulesConfig);

  return {
    ...item,
    ...renamedItem,
    tags: folderView.tags,
    folders: folderView.folderIds,
    excludedNumericTokens: folderView.excludedNumericTokens,
    matchedTokens: folderView.matchedTokens,
    unresolvedTokens: folderView.unresolvedTokens,
    lossyTagSync: folderView.lossyTagSync,
  };
}

function createNameReviewArtifact({ libraryPath, entries, targetCount, outputDir, generatedAt }) {
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

function writeMetadataWithBackup(entry, mutation, backupDir) {
  const originalRaw = fs.readFileSync(entry.metadataPath, "utf8");
  const originalMetadata = JSON.parse(originalRaw);
  const absoluteBackupDir = path.isAbsolute(backupDir)
    ? backupDir
    : resolveProjectPath(backupDir);
  const backupPath = path.join(absoluteBackupDir, `${entry.id}-metadata.json`);
  const nextMetadata = {
    ...originalMetadata,
    name: mutation.name,
    tags: mutation.tags,
    folders: mutation.folders,
  };
  const tempMetadataPath = `${entry.metadataPath}.tmp`;
  const restoreMetadataPath = `${entry.metadataPath}.restore`;

  fs.mkdirSync(absoluteBackupDir, { recursive: true });
  fs.writeFileSync(backupPath, originalRaw);

  try {
    fs.writeFileSync(tempMetadataPath, JSON.stringify(nextMetadata, null, 2));
    fs.renameSync(tempMetadataPath, entry.metadataPath);
  } catch (error) {
    try {
      fs.rmSync(tempMetadataPath, { force: true });
      fs.writeFileSync(restoreMetadataPath, originalRaw);
      fs.renameSync(restoreMetadataPath, entry.metadataPath);
    } catch (restoreError) {
      error.message = `${error.message}; restore failed: ${restoreError.message}`;
    } finally {
      fs.rmSync(restoreMetadataPath, { force: true });
    }

    throw error;
  }

  return {
    backupPath,
    metadataPath: entry.metadataPath,
  };
}

function writeApplyReport(outputPath, report) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.renameSync(tempPath, outputPath);
}

function createApplyReportPersistenceError(error, applyReportJson) {
  const wrappedError = new Error(`Failed to persist apply report: ${error.message}`);
  wrappedError.applyReportJson = applyReportJson;
  wrappedError.hasDurableApplyReport = fs.existsSync(applyReportJson);
  return wrappedError;
}

function buildApplyReport({
  libraryPath,
  reviewFilePath,
  generatedAt,
  approvedCount,
  entries,
  aborted,
}) {
  return {
    libraryPath,
    reviewFilePath,
    generatedAt,
    summary: {
      approvedCount,
      processedCount: entries.length,
      successCount: entries.filter((entry) => entry.status === "success").length,
      failureCount: entries.filter((entry) => entry.status === "failed").length,
      skippedCount: entries.filter((entry) => entry.status === "skipped").length,
      aborted,
    },
    entries,
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
      metadataPath: item.metadataPath,
    })),
  };
}

function buildPhase2FolderRuleReport(libraryPath, targets, generatedAt) {
  const ruleData = loadPhase2FolderRules();

  const entries = targets.map((item) => {
    const folderView = buildFolderResolutionView(item.name, ruleData);

    return {
      id: item.id,
      tokens: folderView.tokens,
      matchedTokens: folderView.matchedTokens,
      appliedFolderIds: folderView.folderIds,
      unresolvedTokens: folderView.unresolvedTokens,
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

  if (mode === "apply" && !options.reviewFile) {
    throw new Error("apply mode requires --review-file <path>");
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
  ensureOutputDir(parsed.artifacts.reviewDir);
  ensureOutputDir(parsed.artifacts.backupDir);

  const generatedAt = new Date().toISOString();
  const targets = collectPhase2Targets(readEagleLibrary(parsed.libraryPath));
  const nameReviewEntries = buildNameReviewEntries(targets);
  const targetSnapshot = buildPhase2TargetSnapshot(parsed.libraryPath, targets, generatedAt);
  const folderRuleReport = buildPhase2FolderRuleReport(
    parsed.libraryPath,
    targets,
    generatedAt
  );

  const reviewArtifact = createNameReviewArtifact({
    libraryPath: parsed.libraryPath,
    entries: nameReviewEntries,
    targetCount: targets.length,
    outputDir: parsed.artifacts.reviewDir,
    generatedAt,
  });
  writeJsonFile(parsed.artifacts.targetSnapshotJson, targetSnapshot);
  writeJsonFile(parsed.artifacts.folderRuleReportJson, folderRuleReport);

  return {
    libraryPath: parsed.libraryPath,
    generatedAt,
    reviewDir: resolveProjectPath(parsed.artifacts.reviewDir),
    backupDir: resolveProjectPath(parsed.artifacts.backupDir),
    nameReviewJson: reviewArtifact.nameReviewJson,
    nameReviewMd: reviewArtifact.nameReviewMd,
    targetSnapshotJson: resolveProjectPath(parsed.artifacts.targetSnapshotJson),
    folderRuleReportJson: resolveProjectPath(parsed.artifacts.folderRuleReportJson),
    summary: {
      targetCount: targets.length,
      candidateCount: nameReviewEntries.length,
    },
  };
}

export function runPhase2Apply(parsed) {
  const reviewFilePath = path.isAbsolute(parsed.reviewFile)
    ? parsed.reviewFile
    : path.resolve(process.cwd(), parsed.reviewFile);
  const reviewData = loadApprovedNameReview(reviewFilePath);
  const canonicalReviewLibraryPath = canonicalizeLibraryPath(reviewData.libraryPath);
  const canonicalTargetLibraryPath = canonicalizeLibraryPath(parsed.libraryPath);

  if (canonicalReviewLibraryPath !== canonicalTargetLibraryPath) {
    throw new Error(
      `Review file libraryPath does not match target library path: ${reviewData.libraryPath} !== ${parsed.libraryPath}`
    );
  }

  ensureOutputDir(parsed.artifacts.reviewDir);
  ensureOutputDir(parsed.artifacts.backupDir);

  const libraryItems = readEagleLibrary(parsed.libraryPath);
  const targets = collectPhase2Targets(libraryItems);
  const libraryItemsById = new Map(libraryItems.map((item) => [item.id, item]));
  const targetsById = new Map(targets.map((item) => [item.id, item]));
  const targetIds = new Set(targets.map((item) => item.id));
  const rulesConfig = loadPhase2FolderRules();
  const applyReportJson = resolveProjectPath(parsed.artifacts.applyReportJson);
  const entries = [];
  const generatedAt = new Date().toISOString();
  let consecutiveFailures = 0;
  let aborted = false;
  let report = buildApplyReport({
    libraryPath: parsed.libraryPath,
    reviewFilePath,
    generatedAt,
    approvedCount: reviewData.approvedEntries.length,
    entries,
    aborted,
  });

  writeApplyReport(applyReportJson, report);

  const persistApplyReportOrThrow = () => {
    report = buildApplyReport({
      libraryPath: parsed.libraryPath,
      reviewFilePath,
      generatedAt,
      approvedCount: reviewData.approvedEntries.length,
      entries,
      aborted,
    });

    try {
      writeApplyReport(applyReportJson, report);
    } catch (error) {
      throw createApplyReportPersistenceError(error, applyReportJson);
    }
  };

  for (const approvedEntry of reviewData.approvedEntries) {
    const item = libraryItemsById.get(approvedEntry.id);
    const backupPath = resolveProjectPath(
      path.join(parsed.artifacts.backupDir, `${approvedEntry.id}-metadata.json`)
    );

    if (!item) {
      entries.push({
        id: approvedEntry.id,
        status: "failed",
        backupPath,
        error: `Target item not found in library: ${approvedEntry.id}`,
      });
      consecutiveFailures += 1;

      if (consecutiveFailures >= 3) {
        aborted = true;
      }

      persistApplyReportOrThrow();
      if (aborted) {
        break;
      }
      continue;
    }

    if (!targetIds.has(approvedEntry.id)) {
      entries.push({
        id: approvedEntry.id,
        status: "skipped",
        metadataPath: item.metadataPath,
        backupPath,
        reason: `Item is already processed or no longer matches phase2 targets: ${approvedEntry.id}`,
      });
      consecutiveFailures = 0;
      persistApplyReportOrThrow();
      continue;
    }

    const liveName = String(item.name ?? "").trim();
    const reviewCurrentName = String(approvedEntry.currentName ?? "").trim();

    if (liveName !== reviewCurrentName) {
      entries.push({
        id: item.id,
        status: "failed",
        metadataPath: item.metadataPath,
        backupPath,
        error: `Live item name no longer matches review currentName: ${liveName} !== ${reviewCurrentName}`,
      });
      consecutiveFailures += 1;

      if (consecutiveFailures >= 3) {
        aborted = true;
      }

      persistApplyReportOrThrow();
      if (aborted) {
        break;
      }
      continue;
    }

    const targetItem = targetsById.get(approvedEntry.id);
    const mutation = buildApplyMutation(targetItem, reviewData, rulesConfig);

    try {
      writeMetadataWithBackup(targetItem, mutation, parsed.artifacts.backupDir);
    } catch (error) {
      entries.push({
        id: targetItem.id,
        status: "failed",
        metadataPath: targetItem.metadataPath,
        backupPath,
        error: error.message,
      });
      consecutiveFailures += 1;

      if (consecutiveFailures >= 3) {
        aborted = true;
      }

      persistApplyReportOrThrow();
      if (aborted) {
        break;
      }
      continue;
    }

    entries.push({
      id: targetItem.id,
      status: "success",
      metadataPath: targetItem.metadataPath,
      backupPath,
      name: mutation.name,
      tags: mutation.tags,
      folders: mutation.folders,
    });
    consecutiveFailures = 0;
    persistApplyReportOrThrow();
  }

  return {
    ...report,
    applyReportJson,
    backupDir: resolveProjectPath(parsed.artifacts.backupDir),
  };
}

export {
  applyApprovedRenames,
  buildApplyMutation,
  buildNameReviewEntries,
  collectPhase2Targets,
  createNameReviewArtifact,
  loadApprovedNameReview,
  normalizeReviewProposal,
  tokenizeName,
  resolveFolderIds,
  syncTagsFromName,
};
