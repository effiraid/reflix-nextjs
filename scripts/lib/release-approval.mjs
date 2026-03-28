import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

import {
  applyStatusTagMutation,
  writeMetadataWithBackup,
} from "./eagle-metadata.mjs";
import { resolveEagleLibraryPath } from "./eagle-library-path.mjs";
import { loadReleaseBatch, resolveReleaseBatchPath } from "./release-batch.mjs";
import { readEagleLibrary } from "./eagle-reader.mjs";
import {
  buildProposalBatch,
  buildReleaseApprovalArtifacts,
  buildReleaseReviewArtifacts,
  computeExportSignature,
  loadPublishedState,
  savePublishedState,
  writeAtomicJson,
} from "./release-approval-state.mjs";
import {
  buildReviewSuggestion,
  buildReviewSummary,
  orderReviewSuggestions,
  renderReviewReport,
} from "./release-review.mjs";
import { runExportPipeline } from "./export-pipeline.mjs";
import { runAiTagBackfill } from "./ai-tag-backfill.mjs";

const DEFAULT_PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

const REVIEW_REQUESTED_TAG = "reflix:review-requested";

const BLOCKING_PHASE1_TAGS = new Set([
  "possible_duplicate",
  "manual_review_required",
  "name_needs_review",
  "new_tag_candidate",
  "tag_group_unassigned",
  "folder_unassigned",
  "thumbnail_failed",
  "on_hold",
]);

function getStringFlagValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }

  return value.trim();
}

function normalizeTags(tags) {
  return Array.isArray(tags)
    ? tags.map((tag) => String(tag ?? "").trim()).filter(Boolean)
    : [];
}

function hasTag(item, tag) {
  return normalizeTags(item?.tags).includes(tag);
}

function hasBlockingPhase1Tag(item) {
  return normalizeTags(item?.tags).some((tag) => BLOCKING_PHASE1_TAGS.has(tag));
}

function hasContentTags(item) {
  return normalizeTags(item?.tags).some((tag) => !tag.startsWith("reflix:"));
}

function isEligiblePhase1Item(item) {
  return (
    String(item?.id ?? "").trim() &&
    String(item?.ext ?? "").trim().toLowerCase() === "mp4" &&
    String(item?.name ?? "").trim() &&
    Array.isArray(item?.folders) &&
    item.folders.length > 0 &&
    item._mediaPath &&
    item._thumbnailPath &&
    hasContentTags(item) &&
    !hasBlockingPhase1Tag(item)
  );
}

function classifyCandidateReason(item, publishedEntry) {
  if (hasTag(item, "reflix:publish-failed")) {
    return "retry_failed_publish";
  }

  if (!publishedEntry) {
    return "new";
  }

  const currentSignature = computeExportSignature(item);
  if (currentSignature !== publishedEntry.exportSignature) {
    return "changed";
  }

  return null;
}

function toStatusTags(item) {
  return normalizeTags(item?.tags).filter((tag) => tag.startsWith("reflix:"));
}

function compareById(left, right) {
  return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
}

function resolveScanTargetIds(parsed, projectRoot) {
  if (parsed?.includeAllEligible) {
    return {
      ids: null,
      scope: "all-eligible",
    };
  }

  const { releaseBatch } = resolveActiveReleaseBatch(projectRoot);
  return {
    ids: releaseBatch.ids,
    scope: "active-batch",
  };
}

function resolveActiveReleaseBatch(projectRoot) {
  const releaseBatchPath = resolveReleaseBatchPath({ projectRoot });
  const releaseBatch = loadReleaseBatch(releaseBatchPath);

  return {
    releaseBatchPath,
    releaseBatch,
  };
}

function loadBatchItemsById(libraryPath, batchIds) {
  return {
    itemsById: new Map(
      readEagleLibrary(libraryPath, { ids: batchIds }).map((item) => [
        String(item?.id ?? "").trim(),
        item,
      ])
    ),
  };
}

function validateProposalBatchItemsOrThrow({ itemsById, proposalBatch }) {
  const missingIds = [];
  const ineligibleIds = [];

  for (const id of proposalBatch.ids) {
    const item = itemsById.get(id);

    if (!item) {
      missingIds.push(id);
      continue;
    }

    if (!isEligiblePhase1Item(item)) {
      ineligibleIds.push(id);
    }
  }

  if (missingIds.length > 0) {
    throw new Error(
      `Proposal item(s) missing from Eagle: ${missingIds.join(", ")} (${proposalBatch.path})`
    );
  }

  if (ineligibleIds.length > 0) {
    throw new Error(
      `Proposal item(s) no longer satisfy Phase 1 eligibility: ${ineligibleIds.join(", ")} (${proposalBatch.path})`
    );
  }
}

function getBatchItemOrThrow(itemsById, id, releaseBatchPath) {
  const item = itemsById.get(id);
  if (!item) {
    throw new Error(
      `Batch item not found in Eagle library: ${id} (${releaseBatchPath})`
    );
  }

  return item;
}

function loadOptionalJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function loadReviewTaxonomy(projectRoot) {
  const categoriesPath = path.join(projectRoot, "src", "data", "categories.json");
  return loadOptionalJson(categoriesPath) || {};
}

function loadExportedClip(projectRoot, id) {
  return loadOptionalJson(
    path.join(projectRoot, "public", "data", "clips", `${id}.json`)
  );
}

function shouldRequestReview(status) {
  return status === "review_needed" || status === "review_needed_changed";
}

function shouldRemoveReviewRequested(status) {
  return status === "already_approved" || status === "held";
}

function writeBatchItemTags({
  item,
  nextTags,
  backupDir,
}) {
  return writeMetadataWithBackup(item, { tags: nextTags }, backupDir);
}

function restoreMetadataFromBackup(item, backupPath) {
  const originalRaw = fs.readFileSync(backupPath, "utf8");
  const restorePath = `${item.metadataPath}.restore`;

  try {
    fs.writeFileSync(restorePath, originalRaw);
    fs.renameSync(restorePath, item.metadataPath);
  } finally {
    fs.rmSync(restorePath, { force: true });
  }
}

function rollbackMetadataMutations(mutations) {
  const rollbackErrors = [];

  for (const mutation of [...mutations].reverse()) {
    try {
      restoreMetadataFromBackup(mutation.item, mutation.backupPath);
    } catch (error) {
      rollbackErrors.push(error);
    }
  }

  if (rollbackErrors.length > 0) {
    const rollbackError = new Error(
      `Failed to roll back ${rollbackErrors.length} metadata mutation(s)`
    );
    rollbackError.cause = rollbackErrors[0];
    throw rollbackError;
  }
}

function updatePublishedState({
  projectRoot,
  timestamp,
  batchName,
  publishedItems,
}) {
  const currentState = loadPublishedState({ projectRoot });
  const nextEntries = { ...currentState.entries };

  for (const item of publishedItems) {
    const nextTags = applyStatusTagMutation(item.tags, {
      addTags: ["reflix:published"],
      removeTags: ["reflix:approved", "reflix:publish-failed"],
    });

    nextEntries[item.id] = {
      publishedAt: timestamp,
      batchName,
      eagleMtime: Number(item?.mtime ?? 0),
      exportSignature: computeExportSignature({
        ...item,
        tags: nextTags,
      }),
    };
  }

  savePublishedState({
    projectRoot,
    state: {
      version: 1,
      updatedAt: timestamp,
      entries: nextEntries,
    },
  });
}

function buildReport({
  timestamp,
  libraryPath,
  eligibleCount,
  candidates,
  heldItems,
}) {
  const lines = [
    "# 승인 제안 보고서",
    "",
    `- 생성 시각: ${timestamp}`,
    `- 라이브러리 경로: ${libraryPath}`,
    `- 전체 적격 아이템 수: ${eligibleCount}`,
    `- 자동 선정 아이템 수: ${candidates.length}`,
    `- 보류 아이템 수: ${heldItems.length}`,
    "",
    "## 제안 아이템",
  ];

  if (candidates.length === 0) {
    lines.push("", "_자동 선정된 아이템이 없습니다._");
  } else {
    for (const candidate of candidates) {
      const statusTags = candidate.statusTags.length
        ? candidate.statusTags.join(", ")
        : "(none)";
      lines.push(
        "",
        `- ${candidate.id} | ${candidate.reason} | 상태 태그: ${statusTags}`
      );
    }
  }

  if (heldItems.length > 0) {
    lines.push("", "## 제외된 보류 아이템");

    for (const item of heldItems) {
      const statusTags = item.statusTags.length ? item.statusTags.join(", ") : "(none)";
      lines.push("", `- ${item.id} | held | 상태 태그: ${statusTags}`);
    }
  }

  lines.push(
    "",
    "## 운영 안내",
    "",
    "1. Eagle에서 제안 아이템을 확인합니다.",
    "2. 배치에 포함할 아이템에는 `reflix:approved`를 추가합니다.",
    "3. 제외할 아이템에는 `reflix:hold`를 추가합니다.",
    "4. 검토가 끝나면 approve 명령을 실행합니다."
  );

  return `${lines.join("\n")}\n`;
}

function writeProposalBatchArtifact({ artifacts, proposalBatch }) {
  fs.mkdirSync(artifacts.proposalDir, { recursive: true });
  fs.writeFileSync(
    artifacts.proposalBatchPath,
    `${JSON.stringify(proposalBatch, null, 2)}\n`,
    "utf-8"
  );
}

function writeProposalArtifacts({ timestamp, projectRoot, selectedIds, report }) {
  const artifacts = buildReleaseApprovalArtifacts({ timestamp, projectRoot });
  const proposalBatch = buildProposalBatch({ timestamp, ids: selectedIds });

  writeProposalBatchArtifact({ artifacts, proposalBatch });
  fs.writeFileSync(artifacts.proposalReportPath, report, "utf-8");

  return {
    ...artifacts,
    proposalBatch,
  };
}

function resolveLatestProposalBatchPath(projectRoot) {
  const approvalRoot = path.join(projectRoot, ".tmp", "release-approval");
  if (!fs.existsSync(approvalRoot)) {
    throw new Error(`No proposed release batch found under ${approvalRoot}`);
  }

  const timestamps = fs
    .readdirSync(approvalRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  for (const timestamp of timestamps) {
    const proposalBatchPath = path.join(
      approvalRoot,
      timestamp,
      "release-batch.proposed.json"
    );
    if (fs.existsSync(proposalBatchPath)) {
      return proposalBatchPath;
    }
  }

  throw new Error(`No proposed release batch found under ${approvalRoot}`);
}

function writeReviewArtifacts({
  artifacts,
  timestamp,
  batchName,
  scope,
  summary,
  suggestions,
}) {
  const orderedSuggestions = orderReviewSuggestions(suggestions);
  const payload = {
    version: 1,
    generatedAt: timestamp,
    batchName,
    scope,
    summary,
    items: orderedSuggestions,
  };
  const report = renderReviewReport({
    summary,
    suggestions: orderedSuggestions,
    timestamp,
    batchName,
    scope,
  });
  const reviewRoot = path.dirname(artifacts.reviewDir);
  const stagingDir = path.join(
    reviewRoot,
    `${path.basename(artifacts.reviewDir)}.staging-${process.pid}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`
  );
  const backupDir = path.join(
    reviewRoot,
    `${path.basename(artifacts.reviewDir)}.backup-${process.pid}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`
  );
  const stagedSuggestionsPath = path.join(stagingDir, "review-suggestions.json");
  const stagedReportPath = path.join(stagingDir, "review-report.md");
  let artifactBackupCleanupFailed = false;

  fs.mkdirSync(stagingDir, { recursive: true });

  try {
    fs.writeFileSync(
      stagedSuggestionsPath,
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf-8"
    );
    fs.writeFileSync(stagedReportPath, report, "utf-8");

    if (fs.existsSync(artifacts.reviewDir)) {
      fs.renameSync(artifacts.reviewDir, backupDir);

      try {
        fs.renameSync(stagingDir, artifacts.reviewDir);
      } catch (error) {
        fs.renameSync(backupDir, artifacts.reviewDir);
        throw error;
      }

      try {
        fs.rmSync(backupDir, { recursive: true, force: true });
      } catch {
        artifactBackupCleanupFailed = true;
      }
    } else {
      fs.mkdirSync(reviewRoot, { recursive: true });
      fs.renameSync(stagingDir, artifacts.reviewDir);
    }
  } catch (error) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    fs.rmSync(backupDir, { recursive: true, force: true });
    throw error;
  }

  return {
    payload,
    artifactBackupCleanupFailed,
  };
}

function buildReviewBackupDir({ projectRoot, timestamp }) {
  return path.join(
    projectRoot,
    ".tmp",
    "release-review-backups",
    `${timestamp}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

const VALID_COMMANDS = new Set([
  "scan", "review", "approve", "mark-published", "mark-failed", "go", "status",
]);

export function parseReleaseApprovalCliArgs(argv = process.argv.slice(2)) {
  const [command = "scan"] = argv;
  if (!VALID_COMMANDS.has(command)) {
    throw new Error(`Unsupported release approval command: ${command}`);
  }

  return {
    command,
    libraryPath: getStringFlagValue(argv, "--library") || resolveEagleLibraryPath(),
    projectRoot: getStringFlagValue(argv, "--project-root") || DEFAULT_PROJECT_ROOT,
    proposalBatchPath: getStringFlagValue(argv, "--proposal-batch"),
    includeAllEligible: argv.includes("--all"),
    timestamp: getStringFlagValue(argv, "--timestamp") || new Date().toISOString(),
    review: argv.includes("--review"),
    r2: argv.includes("--r2"),
  };
}

export async function runReleaseReview(parsed) {
  const command = parsed?.command ?? "review";
  if (command !== "review") {
    throw new Error(`runReleaseReview only supports review, received: ${command}`);
  }

  const projectRoot = parsed?.projectRoot || DEFAULT_PROJECT_ROOT;
  const libraryPath = parsed?.libraryPath || resolveEagleLibraryPath();
  const timestamp = parsed?.timestamp || new Date().toISOString();
  const scope = "active-batch";
  const { releaseBatchPath, releaseBatch } = resolveActiveReleaseBatch(projectRoot);
  const { itemsById } = loadBatchItemsById(libraryPath, releaseBatch.ids);
  validateProposalBatchItemsOrThrow({
    itemsById,
    proposalBatch: {
      ids: releaseBatch.ids,
      path: releaseBatchPath,
    },
  });
  const taxonomy = loadReviewTaxonomy(projectRoot);
  const artifacts = buildReleaseReviewArtifacts({ timestamp, projectRoot });
  const backupDir = buildReviewBackupDir({ projectRoot, timestamp });
  const suggestions = [];
  const mutations = [];
  const nextTagsById = new Map();
  let backupCleanupFailed = false;
  let artifactBackupCleanupFailed = false;

  for (const id of releaseBatch.ids) {
    const item = getBatchItemOrThrow(itemsById, id, releaseBatchPath);
    const exportedClip = loadExportedClip(projectRoot, id);
    const suggestion = buildReviewSuggestion({
      item,
      exportedClip,
      taxonomy,
    });
    suggestions.push(suggestion);

    let nextTags = item.tags;
    if (shouldRequestReview(suggestion.status)) {
      nextTags = applyStatusTagMutation(item.tags, {
        addTags: ["reflix:review-requested"],
      });
    } else if (shouldRemoveReviewRequested(suggestion.status)) {
      nextTags = applyStatusTagMutation(item.tags, {
        removeTags: ["reflix:review-requested"],
      });
    }

    nextTagsById.set(id, nextTags);
  }

  const summary = buildReviewSummary(suggestions);

  try {
    for (const id of releaseBatch.ids) {
      const item = getBatchItemOrThrow(itemsById, id, releaseBatchPath);
      const nextTags = nextTagsById.get(id) ?? item.tags;

      if (JSON.stringify(nextTags) === JSON.stringify(item.tags)) {
        continue;
      }

      const result = writeBatchItemTags({
        item,
        nextTags,
        backupDir,
      });

      mutations.push({
        item,
        backupPath: result.backupPath,
      });
    }

    const artifactResult = writeReviewArtifacts({
      artifacts,
      timestamp,
      batchName: releaseBatch.name,
      scope,
      summary,
      suggestions,
    });
    artifactBackupCleanupFailed = artifactResult.artifactBackupCleanupFailed;
  } catch (error) {
    let rollbackFailed = false;

    try {
      rollbackMetadataMutations(mutations);
    } catch (rollbackError) {
      rollbackFailed = true;
      error.message = `${error.message}; rollback failed: ${rollbackError.message}`;
    }

    if (!rollbackFailed) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }

    throw error;
  }

  try {
    fs.rmSync(backupDir, { recursive: true, force: true });
  } catch {
    backupCleanupFailed = true;
  }

  return {
    command,
    timestamp,
    libraryPath,
    projectRoot,
    scope,
    batchName: releaseBatch.name,
    summary,
    reviewReportPath: artifacts.reviewReportPath,
    reviewSuggestionsPath: artifacts.reviewSuggestionsPath,
    backupCleanupFailed,
    artifactBackupCleanupFailed,
  };
}

export async function runReleaseScan(parsed) {
  const command = parsed?.command ?? "scan";
  if (command !== "scan") {
    throw new Error(`runReleaseScan only supports scan, received: ${command}`);
  }

  const projectRoot = parsed?.projectRoot || DEFAULT_PROJECT_ROOT;
  const libraryPath = parsed?.libraryPath || resolveEagleLibraryPath();
  const timestamp = parsed?.timestamp || new Date().toISOString();
  const scanTarget = resolveScanTargetIds(parsed, projectRoot);
  const items = readEagleLibrary(libraryPath, {
    ids: scanTarget.ids || undefined,
  });
  const publishedState = loadPublishedState({ projectRoot });

  const heldItems = [];
  const candidates = [];
  let eligibleCount = 0;

  for (const item of items) {
    if (!isEligiblePhase1Item(item)) {
      continue;
    }

    eligibleCount += 1;

    if (hasTag(item, "reflix:hold")) {
      heldItems.push({
        id: item.id,
        statusTags: toStatusTags(item),
      });
      continue;
    }

    const reason = classifyCandidateReason(item, publishedState.entries[item.id]);
    if (!reason) {
      continue;
    }

    candidates.push({
      id: item.id,
      reason,
      statusTags: toStatusTags(item),
    });
  }

  heldItems.sort(compareById);
  candidates.sort(compareById);

  const selectedIds = candidates.map((candidate) => candidate.id);
  const report = buildReport({
    timestamp,
    libraryPath,
    eligibleCount,
    candidates,
    heldItems,
  });
  const artifacts = writeProposalArtifacts({
    timestamp,
    projectRoot,
    selectedIds,
    report,
  });

  return {
    command,
    timestamp,
    libraryPath,
    projectRoot,
    scope: scanTarget.scope,
    candidates,
    selectedIds,
    summary: {
      eligibleCount,
      heldCount: heldItems.length,
      selectedCount: selectedIds.length,
    },
    proposalBatchPath: artifacts.proposalBatchPath,
    proposalReportPath: artifacts.proposalReportPath,
  };
}

export async function runReleaseApprove(parsed) {
  const command = parsed?.command ?? "approve";
  if (command !== "approve") {
    throw new Error(`runReleaseApprove only supports approve, received: ${command}`);
  }

  const projectRoot = parsed?.projectRoot || DEFAULT_PROJECT_ROOT;
  const libraryPath = parsed?.libraryPath || resolveEagleLibraryPath();
  const timestamp = parsed?.timestamp || new Date().toISOString();
  const proposalBatchPath = resolveReleaseBatchPath({
    batchPath: parsed?.proposalBatchPath || resolveLatestProposalBatchPath(projectRoot),
    projectRoot,
  });
  const proposalBatch = loadReleaseBatch(proposalBatchPath);
  const { itemsById } = loadBatchItemsById(libraryPath, proposalBatch.ids);
  validateProposalBatchItemsOrThrow({ itemsById, proposalBatch });
  const approvedIds = proposalBatch.ids.filter((id) => {
    const item = itemsById.get(id);
    return hasTag(item, "reflix:approved") && !hasTag(item, "reflix:hold");
  });

  if (approvedIds.length === 0) {
    throw new Error(
      `No approved items found in proposed batch: ${proposalBatch.path}`
    );
  }

  const artifacts = buildReleaseApprovalArtifacts({ timestamp, projectRoot });
  const backupDir = path.join(artifacts.proposalDir, "approve-backups");
  const approvedProposalBatch = buildProposalBatch({ timestamp, ids: approvedIds });
  const mutations = [];
  const hadPreviousProposalBatch = fs.existsSync(artifacts.proposalBatchPath);
  const previousProposalBatchRaw = hadPreviousProposalBatch
    ? fs.readFileSync(artifacts.proposalBatchPath, "utf-8")
    : null;

  try {
    for (const id of approvedIds) {
      const item = getBatchItemOrThrow(itemsById, id, proposalBatchPath);
      const nextTags = applyStatusTagMutation(item.tags, {
        removeTags: [REVIEW_REQUESTED_TAG],
      });

      if (JSON.stringify(nextTags) === JSON.stringify(item.tags)) {
        continue;
      }

      const result = writeBatchItemTags({
        item,
        nextTags,
        backupDir,
      });

      mutations.push({
        item,
        backupPath: result.backupPath,
      });
    }

    writeProposalBatchArtifact({
      artifacts,
      proposalBatch: approvedProposalBatch,
    });

    const releaseBatchPath = path.join(projectRoot, "config", "release-batch.json");
    writeAtomicJson(releaseBatchPath, {
      name: approvedProposalBatch.name,
      ids: approvedIds,
    });

    try {
      fs.rmSync(backupDir, { recursive: true, force: true });
    } catch {
      // Keep backups if cleanup fails; the metadata changes are already committed.
    }

    return {
      command,
      timestamp,
      libraryPath,
      projectRoot,
      sourceProposalBatchPath: proposalBatch.path,
      proposalBatchPath: artifacts.proposalBatchPath,
      releaseBatchPath,
      approvedIds,
    };
  } catch (error) {
    try {
      rollbackMetadataMutations(mutations);
    } catch (rollbackError) {
      error.message = `${error.message}; rollback failed: ${rollbackError.message}`;
    }

    if (hadPreviousProposalBatch) {
      fs.writeFileSync(artifacts.proposalBatchPath, previousProposalBatchRaw, "utf-8");
    } else {
      fs.rmSync(artifacts.proposalBatchPath, { force: true });
    }

    throw error;
  }
}

async function runReleaseMarkOutcome(parsed, {
  command,
  addTags,
  removeTags,
  persistPublishedState,
}) {
  if (parsed?.command && parsed.command !== command) {
    throw new Error(`runRelease${command === "mark-published" ? "MarkPublished" : "MarkFailed"} only supports ${command}, received: ${parsed.command}`);
  }

  const projectRoot = parsed?.projectRoot || DEFAULT_PROJECT_ROOT;
  const libraryPath = parsed?.libraryPath || resolveEagleLibraryPath();
  const timestamp = parsed?.timestamp || new Date().toISOString();
  const { releaseBatchPath, releaseBatch } = resolveActiveReleaseBatch(projectRoot);
  const { itemsById } = loadBatchItemsById(libraryPath, releaseBatch.ids);
  const artifacts = buildReleaseApprovalArtifacts({ timestamp, projectRoot });
  const backupDir = path.join(artifacts.proposalDir, "publish-backups");
  const mutations = [];
  const processedItems = [];

  try {
    for (const id of releaseBatch.ids) {
      const item = getBatchItemOrThrow(itemsById, id, releaseBatchPath);
      const nextTags = applyStatusTagMutation(item.tags, {
        addTags,
        removeTags,
      });

      const result = writeBatchItemTags({
        item,
        nextTags,
        backupDir,
      });

      mutations.push({
        item,
        backupPath: result.backupPath,
      });
      processedItems.push({
        ...item,
        tags: nextTags,
      });
    }

    if (persistPublishedState) {
      updatePublishedState({
        projectRoot,
        timestamp,
        batchName: releaseBatch.name,
        publishedItems: processedItems,
      });
    }
  } catch (error) {
    try {
      rollbackMetadataMutations(mutations);
    } catch (rollbackError) {
      error.message = `${error.message}; rollback failed: ${rollbackError.message}`;
    }

    throw error;
  }

  return {
    command,
    timestamp,
    libraryPath,
    projectRoot,
    releaseBatchPath,
    releaseBatchName: releaseBatch.name,
    updatedIds: releaseBatch.ids,
  };
}

export async function runReleaseMarkPublished(parsed) {
  return runReleaseMarkOutcome(parsed, {
    command: "mark-published",
    addTags: ["reflix:published"],
    removeTags: ["reflix:approved", "reflix:publish-failed", REVIEW_REQUESTED_TAG],
    persistPublishedState: true,
  });
}

export async function runReleaseMarkFailed(parsed) {
  // Preserve reflix:approved so a failed publish can be retried without a second Eagle approval.
  return runReleaseMarkOutcome(parsed, {
    command: "mark-failed",
    addTags: ["reflix:publish-failed"],
    removeTags: ["reflix:published", REVIEW_REQUESTED_TAG],
    persistPublishedState: false,
  });
}

// ---------------------------------------------------------------------------
// Smoke check — verify export artifacts match the batch
// ---------------------------------------------------------------------------

export function smokeCheckExportArtifacts({ projectRoot, batchIds }) {
  const errors = [];
  const publicRoot = path.join(projectRoot, "public");

  for (const id of batchIds) {
    const clipJson = path.join(publicRoot, "data", "clips", `${id}.json`);
    if (!fs.existsSync(clipJson)) {
      errors.push(`clip JSON 누락: ${id}`);
    }
    for (const [dir, ext] of [["videos", "mp4"], ["previews", "mp4"], ["thumbnails", "webp"]]) {
      const filePath = path.join(publicRoot, dir, `${id}.${ext}`);
      if (!fs.existsSync(filePath)) {
        errors.push(`${dir} 누락: ${id}.${ext}`);
      }
    }
  }

  const summaryPath = path.join(publicRoot, "data", "browse", "summary.json");
  const projectionPath = path.join(publicRoot, "data", "browse", "projection.json");
  if (!fs.existsSync(summaryPath)) errors.push("browse summary.json 누락");
  if (!fs.existsSync(projectionPath)) errors.push("browse projection.json 누락");

  const indexPath = path.join(projectRoot, "src", "data", "index.json");
  if (fs.existsSync(indexPath)) {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    const indexClipCount = Array.isArray(index?.clips) ? index.clips.length : 0;
    if (indexClipCount < batchIds.length) {
      errors.push(`index.json clip 수 (${indexClipCount}) < batch 크기 (${batchIds.length})`);
    }
  } else {
    errors.push("index.json 누락");
  }

  return { passed: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// release:go — one-command publish pipeline
// ---------------------------------------------------------------------------

function waitForUserInput(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

export async function runReleaseGo(parsed, {
  runScan = runReleaseScan,
  runReview = runReleaseReview,
  runApprove = runReleaseApprove,
  runExport = runExportPipeline,
  runBackfill = runAiTagBackfill,
  runMarkPublished = runReleaseMarkPublished,
  smokeCheck = smokeCheckExportArtifacts,
  waitForInput = waitForUserInput,
  readLibrary = readEagleLibrary,
} = {}) {
  const projectRoot = parsed?.projectRoot || DEFAULT_PROJECT_ROOT;
  const libraryPath = parsed?.libraryPath || resolveEagleLibraryPath();
  const timestamp = parsed?.timestamp || new Date().toISOString();
  const useReview = parsed?.review ?? false;
  const useR2 = parsed?.r2 ?? false;

  const baseParsed = { libraryPath, projectRoot, timestamp };

  // Step 1: Scan
  console.log("\n📋 Step 1/6: 후보 스캔...");
  const scanResult = await runScan({ ...baseParsed, command: "scan" });
  console.log(`   적격: ${scanResult.summary.eligibleCount}개, 선택: ${scanResult.summary.selectedCount}개, 보류: ${scanResult.summary.heldCount}개`);

  if (scanResult.selectedIds.length === 0) {
    console.log("\n✅ 새로 게시할 아이템이 없습니다.");
    return { command: "go", skipped: true, reason: "no-candidates" };
  }

  // Step 2: Review (optional) + Approve or Auto-approve
  let batchIds;
  if (useReview) {
    console.log("\n🔍 Step 2/6: 검토 요청...");
    await runReview({ ...baseParsed, command: "review" });

    await waitForInput(
      "\n🦅 Eagle에서 검토해주세요.\n" +
      "   - reflix:approved → 이번 배치에 포함\n" +
      "   - reflix:hold → 이번 배치에서 제외\n\n" +
      "   검토 완료 후 Enter를 누르세요..."
    );

    console.log("\n✅ Step 2/6: 승인 처리...");
    const approveResult = await runApprove({ ...baseParsed, command: "approve" });
    batchIds = approveResult.approvedIds;
  } else {
    console.log("\n✅ Step 2/6: 자동 승인...");
    batchIds = scanResult.selectedIds;
    const releaseBatchPath = path.join(projectRoot, "config", "release-batch.json");
    const batchName = `batch-${timestamp.slice(0, 10).replace(/:/g, "-")}`;
    writeAtomicJson(releaseBatchPath, { name: batchName, ids: batchIds });
    console.log(`   배치 저장: ${batchIds.length}개 → config/release-batch.json`);
  }

  if (batchIds.length === 0) {
    console.log("\n✅ 승인된 아이템이 없습니다.");
    return { command: "go", skipped: true, reason: "no-approved" };
  }

  // Step 3: AI tag backfill (if needed)
  console.log("\n🤖 Step 3/6: AI 태그 확인...");
  const items = readLibrary(libraryPath, { ids: batchIds });
  const itemsMissingAiTags = items.filter(
    (item) => !Object.prototype.hasOwnProperty.call(item, "aiTags") || item.aiTags == null
  );

  let backfillResult = null;
  if (itemsMissingAiTags.length > 0) {
    console.log(`   aiTags 누락/null ${itemsMissingAiTags.length}개 → backfill 실행`);
    backfillResult = await runBackfill(items, {
      projectRoot,
      ids: batchIds,
      concurrency: 4,
    });
    console.log(`   완료: 성공 ${backfillResult.successCount}, 실패 ${backfillResult.failureCount}`);
    if (backfillResult.failureCount > 0) {
      console.log("\n❌ AI 태그 backfill 실패. 실패한 아이템을 확인 후 다시 실행하세요.");
      return {
        command: "go",
        skipped: false,
        error: "backfill-failed",
        backfillResult,
      };
    }
  } else {
    console.log("   모든 아이템에 aiTags 존재");
  }

  // Step 4: Export
  console.log("\n📦 Step 4/6: Export...");
  const exportFlags = {
    r2: useR2,
    prune: true,
    mediaConcurrency: 4,
    uploadConcurrency: 6,
  };
  const exportResult = await runExport(exportFlags, {
    projectRoot,
    eagleLibraryPath: libraryPath,
  });
  console.log(`   run: ${exportResult.runId}, 실패: ${exportResult.failed}개`);

  if (exportResult.failed > 0) {
    console.log("\n❌ Export 실패. release:go를 다시 실행하면 export부터 재시작됩니다.");
    return {
      command: "go",
      skipped: false,
      error: "export-failed",
      exportResult,
    };
  }

  // Step 5: Smoke check
  console.log("\n🔎 Step 5/6: Smoke check...");
  const check = smokeCheck({ projectRoot, batchIds });
  if (!check.passed) {
    console.log("   ❌ 문제 발견:");
    for (const err of check.errors) {
      console.log(`      - ${err}`);
    }
    return {
      command: "go",
      skipped: false,
      error: "smoke-check-failed",
      smokeCheckErrors: check.errors,
    };
  }
  console.log("   ✅ 모든 파일 확인 완료");

  // Step 6: Mark published
  console.log("\n🏷️  Step 6/6: 게시 완료 기록...");
  const publishResult = await runMarkPublished({ ...baseParsed, command: "mark-published" });
  console.log(`   ${publishResult.updatedIds.length}개 게시 완료`);

  console.log("\n🎉 완료!");
  return {
    command: "go",
    skipped: false,
    batchIds,
    exportResult,
    publishResult,
    backfillResult,
  };
}

// ---------------------------------------------------------------------------
// release:status — pipeline dashboard
// ---------------------------------------------------------------------------

export async function runReleaseStatus(parsed, {
  readLibrary = readEagleLibrary,
} = {}) {
  const projectRoot = parsed?.projectRoot || DEFAULT_PROJECT_ROOT;
  const libraryPath = parsed?.libraryPath || resolveEagleLibraryPath();

  // Active batch
  const releaseBatchPath = resolveReleaseBatchPath({ projectRoot });
  let releaseBatch = null;
  try {
    releaseBatch = loadReleaseBatch(releaseBatchPath);
  } catch {
    // no active batch
  }

  // Published state
  const publishedState = loadPublishedState({ projectRoot });
  const publishedCount = Object.keys(publishedState.entries).length;

  // Eagle library scan
  let eligibleCount = 0;
  let missingAiTagsCount = 0;
  try {
    const items = readLibrary(libraryPath);
    for (const item of items) {
      if (isEligiblePhase1Item(item)) {
        eligibleCount += 1;
        if (!Object.prototype.hasOwnProperty.call(item, "aiTags")) {
          missingAiTagsCount += 1;
        }
      }
    }
  } catch {
    // library unavailable
  }

  const batchSize = releaseBatch?.ids?.length ?? 0;
  const batchPublished = releaseBatch
    ? releaseBatch.ids.filter((id) => publishedState.entries[id]).length
    : 0;

  return {
    command: "status",
    batch: releaseBatch
      ? {
          name: releaseBatch.name,
          size: batchSize,
          published: batchPublished,
        }
      : null,
    published: {
      total: publishedCount,
      lastUpdated: publishedState.updatedAt || null,
    },
    library: {
      eligible: eligibleCount,
      missingAiTags: missingAiTagsCount,
      availableForNextBatch: eligibleCount - publishedCount,
    },
  };
}
