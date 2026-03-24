import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const EMPTY_PUBLISHED_STATE = {
  version: 1,
  updatedAt: "",
  entries: {},
};

const REFLIX_OPERATION_TAG_PREFIX = "reflix:";

function toStringValue(value) {
  return String(value ?? "");
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) => toStringValue(value).trim()).filter(Boolean);
}

function sortObjectEntries(entries) {
  return Object.fromEntries(
    Object.keys(entries)
      .sort()
      .map((key) => {
        const entry = entries[key] ?? {};

        return [
          key,
          {
            publishedAt: toStringValue(entry.publishedAt),
            batchName: toStringValue(entry.batchName),
            eagleMtime: Number(entry.eagleMtime ?? 0),
            exportSignature: toStringValue(entry.exportSignature),
          },
        ];
      })
  );
}

function normalizePublishedEntries(entries) {
  if (!entries || typeof entries !== "object") {
    return {};
  }

  return sortObjectEntries(entries);
}

function normalizePublishedState(state) {
  return {
    version: Number(state?.version ?? 1),
    updatedAt: toStringValue(state?.updatedAt),
    entries: normalizePublishedEntries(state?.entries),
  };
}

export function writeAtomicJson(filePath, value) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });

  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random()
      .toString(16)
      .slice(2)}.tmp`
  );
  const payload = `${JSON.stringify(value, null, 2)}\n`;

  fs.writeFileSync(tempPath, payload, "utf-8");
  fs.renameSync(tempPath, filePath);
}

function resolvePublishedStatePath(projectRoot) {
  return path.join(projectRoot, "config", "published-state.json");
}

function resolveApprovalTimestampDir({ projectRoot, timestamp }) {
  return path.join(projectRoot, ".tmp", "release-approval", toStringValue(timestamp));
}

function normalizeContentTags(tags) {
  return normalizeStringArray(tags)
    .filter((tag) => !tag.startsWith(REFLIX_OPERATION_TAG_PREFIX))
    .sort();
}

function normalizeFolders(folders) {
  return normalizeStringArray(folders).sort();
}

function buildFileState(filePath) {
  if (!filePath) {
    return null;
  }

  try {
    const contents = fs.readFileSync(filePath);
    const digest = crypto.createHash("sha256").update(contents).digest("hex");
    const stats = fs.statSync(filePath);

    return {
      exists: true,
      contentHash: digest,
      size: Number(stats.size ?? 0),
    };
  } catch {
    return {
      exists: false,
    };
  }
}

function buildSignaturePayload(item) {
  const payload = {
    name: toStringValue(item?.name),
    tags: normalizeContentTags(item?.tags),
    folders: normalizeFolders(item?.folders),
    annotation: toStringValue(item?.annotation),
    star: Number(item?.star ?? 0),
    duration: Number(item?.duration ?? 0),
    width: Number(item?.width ?? 0),
    height: Number(item?.height ?? 0),
  };

  const mediaState = buildFileState(item?._mediaPath);
  if (mediaState) {
    payload.media = mediaState;
  }

  const thumbnailState = buildFileState(item?._thumbnailPath);
  if (thumbnailState) {
    payload.thumbnail = thumbnailState;
  }

  return payload;
}

export function buildReleaseApprovalArtifacts({ timestamp, projectRoot }) {
  if (!projectRoot) {
    throw new Error("buildReleaseApprovalArtifacts requires a projectRoot");
  }

  const proposalDir = resolveApprovalTimestampDir({ projectRoot, timestamp });

  return {
    proposalDir,
    proposalBatchPath: path.join(proposalDir, "release-batch.proposed.json"),
    proposalReportPath: path.join(proposalDir, "proposal-report.md"),
    publishedStatePath: resolvePublishedStatePath(projectRoot),
  };
}

export function buildReleaseReviewArtifacts({ timestamp, projectRoot }) {
  if (!projectRoot) {
    throw new Error("buildReleaseReviewArtifacts requires a projectRoot");
  }

  const reviewDir = path.join(
    projectRoot,
    ".tmp",
    "release-review",
    toStringValue(timestamp)
  );

  return {
    reviewDir,
    reviewReportPath: path.join(reviewDir, "review-report.md"),
    reviewSuggestionsPath: path.join(reviewDir, "review-suggestions.json"),
  };
}

export function loadPublishedState({ projectRoot }) {
  if (!projectRoot) {
    throw new Error("loadPublishedState requires a projectRoot");
  }

  const publishedStatePath = resolvePublishedStatePath(projectRoot);

  if (!fs.existsSync(publishedStatePath)) {
    return {
      ...EMPTY_PUBLISHED_STATE,
      entries: {},
      path: publishedStatePath,
    };
  }

  const parsed = JSON.parse(fs.readFileSync(publishedStatePath, "utf-8"));

  return {
    version: Number(parsed.version ?? 1),
    updatedAt: toStringValue(parsed.updatedAt),
    entries: normalizePublishedEntries(parsed.entries),
    path: publishedStatePath,
  };
}

export function savePublishedState({ projectRoot, state }) {
  if (!projectRoot) {
    throw new Error("savePublishedState requires a projectRoot");
  }

  const publishedStatePath = resolvePublishedStatePath(projectRoot);
  writeAtomicJson(publishedStatePath, normalizePublishedState(state));

  return {
    path: publishedStatePath,
  };
}

export function computeExportSignature(item) {
  const payload = buildSignaturePayload(item);
  const serialized = JSON.stringify(payload);
  const digest = crypto.createHash("sha256").update(serialized).digest("hex");

  return `sha256:${digest}`;
}

export function buildProposalBatch({ timestamp, ids }) {
  return {
    name: `proposal-${toStringValue(timestamp)}`,
    ids: normalizeStringArray(ids),
    path: path.join(
      ".tmp",
      "release-approval",
      toStringValue(timestamp),
      "release-batch.proposed.json"
    ),
  };
}
