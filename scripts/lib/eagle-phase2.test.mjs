import test from "node:test";
import assert from "node:assert/strict";

import { parsePhase2CliArgs } from "../eagle-phase2.mjs";

test("parsePhase2CliArgs requires a review file for apply mode", () => {
  assert.throws(() => parsePhase2CliArgs(["apply"]), /--review-file/);
});

test("parsePhase2CliArgs returns help mode without side effects", () => {
  const result = parsePhase2CliArgs(["--help"]);

  assert.equal(result.mode, "help");
});

test("parsePhase2CliArgs resolves review artifact defaults", () => {
  const result = parsePhase2CliArgs([
    "review",
    "--timestamp",
    "2026-03-23T22-00-00-000Z",
  ]);

  assert.equal(result.mode, "review");
  assert.equal(result.artifacts.reviewDir, ".tmp/eagle-phase2/2026-03-23T22-00-00-000Z/");
  assert.equal(
    result.artifacts.backupDir,
    ".tmp/eagle-phase2-backups/2026-03-23T22-00-00-000Z/"
  );
  assert.equal(
    result.artifacts.nameReviewJson,
    ".tmp/eagle-phase2/2026-03-23T22-00-00-000Z/name-review.json"
  );
  assert.equal(
    result.artifacts.targetSnapshotJson,
    ".tmp/eagle-phase2/2026-03-23T22-00-00-000Z/target-snapshot.json"
  );
  assert.equal(
    result.artifacts.folderRuleReportJson,
    ".tmp/eagle-phase2/2026-03-23T22-00-00-000Z/folder-rule-report.json"
  );
});
