import fs from "node:fs";
import path from "node:path";

import { resolveEagleLibraryPath } from "./eagle-library-path.mjs";
import { readEagleLibrary } from "./eagle-reader.mjs";
import { loadCategoryMap } from "./index-builder.mjs";
import { prunePublishedArtifacts } from "./published-artifacts.mjs";
import { loadReleaseBatch, resolveReleaseBatchPath } from "./release-batch.mjs";
import {
  buildSelectionSignature,
  createRunManifest,
  findLatestResumableRun,
  loadItemState,
  saveRunManifest,
  saveRunSummary,
  saveStageSummary,
} from "./export-run-state.mjs";
import { runMediaStage } from "./export-media-stage.mjs";
import { runArtifactStage } from "./export-artifact-stage.mjs";
import { runRelatedStage } from "./related-clips-stage.mjs";
import { runUploadStage } from "./export-upload-stage.mjs";

function createRunId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function resolveRequestedClipIds(flags, projectRoot) {
  if (flags.ids?.length) {
    return {
      ids: flags.ids,
      source: "ids",
      label: `--ids override (${flags.ids.length} ids)`,
    };
  }

  if (flags.full) {
    if (!flags.confirmFullExport) {
      throw new Error("Full export requires --confirm-full-export");
    }

    return {
      ids: null,
      source: "full",
      label: "full library",
    };
  }

  const configuredBatchPath = flags.batchPath?.trim() || resolveReleaseBatchPath({ projectRoot });
  const batch = loadReleaseBatch(configuredBatchPath);
  const displayBatchPath = flags.batchPath?.trim() || "config/release-batch.json";

  return {
    ids: batch.ids,
    source: "batch",
    label: `${displayBatchPath} (${batch.ids.length} ids)`,
  };
}

function saveManifestWithStage(manifest, projectRoot, stageName, stageStatus) {
  manifest.stages = {
    ...(manifest.stages || {
      discover: "pending",
      "process-media": "pending",
      "build-artifacts": "pending",
      "compute-related": "pending",
      upload: "pending",
      finalize: "pending",
    }),
    [stageName]: stageStatus,
  };
  saveRunManifest({ projectRoot, manifest });
}

function getCompletedItems(items, projectRoot, runId) {
  return items.filter(
    (item) =>
      loadItemState({ projectRoot, runId, clipId: item.id })?.media?.status === "completed"
  );
}

export async function runExportPipeline(flags, {
  env = process.env,
  projectRoot,
  eagleLibraryPath = resolveEagleLibraryPath({ env }),
  readLibraryImpl = readEagleLibrary,
  runMediaStageImpl = runMediaStage,
  runArtifactStageImpl = runArtifactStage,
  runRelatedStageImpl = runRelatedStage,
  runUploadStageImpl = runUploadStage,
} = {}) {
  if (!projectRoot) {
    throw new Error("runExportPipeline requires a projectRoot");
  }

  const selection = resolveRequestedClipIds(flags, projectRoot);
  const categoriesPath = path.join(projectRoot, "src", "data", "categories.json");
  if (fs.existsSync(categoriesPath)) {
    loadCategoryMap(categoriesPath);
  }

  const items = readLibraryImpl(eagleLibraryPath, {
    ids: selection.ids,
    limit: flags.limit,
  });
  const selectionSignature = buildSelectionSignature(selection, flags);

  if (flags.dryRun) {
    const resumableRun = !flags.freshRun && !flags.resumeRun
      ? findLatestResumableRun({ projectRoot, selectionSignature })
      : null;

    console.log(`실행 계획: 총 ${items.length}개 클립`);
    console.log(
      resumableRun
        ? `재개 예정: ${resumableRun.runId}`
        : "새 run을 생성합니다"
    );

    return {
      dryRun: true,
      items: items.length,
      resumableRunId: resumableRun?.runId ?? null,
    };
  }

  let manifest =
    (flags.resumeRun
      ? findLatestResumableRun({ projectRoot, selectionSignature: "__never-match__" })
      : null) ?? null;

  if (flags.resumeRun) {
    manifest = JSON.parse(
      fs.readFileSync(
        path.join(projectRoot, ".tmp", "export-runs", flags.resumeRun, "manifest.json"),
        "utf-8"
      )
    );
  } else if (!flags.freshRun) {
    manifest = findLatestResumableRun({ projectRoot, selectionSignature });
  }

  if (manifest) {
    console.log(`재개 모드: ${manifest.runId}`);
  } else {
    manifest = createRunManifest({
      runId: createRunId(),
      selectionSignature,
      selection,
      flags,
      startedAt: new Date().toISOString(),
      status: "running",
    });
    console.log(`새 run 시작: ${manifest.runId}`);
    saveRunManifest({ projectRoot, manifest });
  }

  saveManifestWithStage(manifest, projectRoot, "discover", "completed");
  saveStageSummary({
    projectRoot,
    runId: manifest.runId,
    stageName: "discover",
    summary: {
      selectedCount: items.length,
      source: selection.source,
      label: selection.label,
    },
  });

  const mediaSummary = await runMediaStageImpl(items, {
    projectRoot,
    runId: manifest.runId,
    concurrency: flags.mediaConcurrency,
  });
  saveManifestWithStage(manifest, projectRoot, "process-media", "completed");
  saveStageSummary({
    projectRoot,
    runId: manifest.runId,
    stageName: "process-media",
    summary: mediaSummary,
  });
  console.log(
    `미디어 처리 단계: 완료 ${mediaSummary.completed}개 / 실패 ${mediaSummary.failed}개 / 재사용 ${mediaSummary.reused}개`
  );

  const completedItems = getCompletedItems(items, projectRoot, manifest.runId);

  const artifactSummary = await runArtifactStageImpl(completedItems, {
    projectRoot,
    runId: manifest.runId,
  });
  saveManifestWithStage(manifest, projectRoot, "build-artifacts", "completed");
  saveStageSummary({
    projectRoot,
    runId: manifest.runId,
    stageName: "build-artifacts",
    summary: artifactSummary,
  });

  const relatedSummary = await runRelatedStageImpl(completedItems, {
    projectRoot,
    runId: manifest.runId,
    forceFullRebuild: flags.forceRelatedFullRebuild,
  });
  saveManifestWithStage(manifest, projectRoot, "compute-related", "completed");
  saveStageSummary({
    projectRoot,
    runId: manifest.runId,
    stageName: "compute-related",
    summary: relatedSummary,
  });

  let uploadSummary = null;
  if (flags.r2) {
    uploadSummary = await runUploadStageImpl(
      completedItems.map((item) => item.id),
      {
        projectRoot,
        runId: manifest.runId,
        env,
        concurrency: flags.uploadConcurrency,
      }
    );

    saveManifestWithStage(manifest, projectRoot, "upload", "completed");
    saveStageSummary({
      projectRoot,
      runId: manifest.runId,
      stageName: "upload",
      summary: uploadSummary,
    });
  }

  let pruneSummary = null;
  if (flags.prune && mediaSummary.failed === 0 && (!uploadSummary || uploadSummary.failed === 0)) {
    pruneSummary = await prunePublishedArtifacts({
      keepIds: completedItems.map((item) => item.id),
      projectRoot,
    });
  }

  const failed = mediaSummary.failed + (uploadSummary?.failed ?? 0);
  manifest.status = failed > 0 ? "failed" : "completed";
  saveManifestWithStage(manifest, projectRoot, "finalize", "completed");
  saveRunSummary({
    projectRoot,
    runId: manifest.runId,
    summary: {
      status: manifest.status,
      failed,
      processed: completedItems.length,
      pruneSummary,
      uploadSummary,
    },
  });
  saveRunManifest({ projectRoot, manifest });

  return {
    runId: manifest.runId,
    failed,
    mediaSummary,
    artifactSummary,
    relatedSummary,
    uploadSummary,
    pruneSummary,
  };
}
