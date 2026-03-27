import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadItemState, saveItemState } from "./export-run-state.mjs";
import { collectImpactedClipIds, runRelatedStage } from "./related-clips-stage.mjs";

function createTempProject() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reflix-related-stage-"));
  fs.mkdirSync(path.join(projectRoot, "src", "data"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "public", "data", "clips"), { recursive: true });
  return projectRoot;
}

function writeClip(projectRoot, clip) {
  fs.writeFileSync(
    path.join(projectRoot, "public", "data", "clips", `${clip.id}.json`),
    JSON.stringify(clip, null, 2)
  );
}

test("collectImpactedClipIds includes changed clips and neighbors from previous and next inputs", () => {
  const allClips = [
    { id: "A", tags: ["guard"], folders: ["F2"], category: "combat" },
    { id: "B", tags: ["blade"], folders: ["F9"], category: "combat" },
    { id: "C", tags: ["guard"], folders: ["F8"], category: "combat" },
    { id: "D", tags: ["idle"], folders: ["F1"], category: "combat" },
  ];

  const impacted = collectImpactedClipIds({
    allClips,
    changedItems: [
      {
        id: "A",
        previous: { tags: ["blade"], folders: ["F1"], category: "combat" },
        next: { tags: ["guard"], folders: ["F2"], category: "combat" },
      },
    ],
  });

  assert.deepEqual([...impacted].sort(), ["A", "B", "C", "D"]);
});

test("runRelatedStage falls back to full rebuild when related inputs are missing", async () => {
  const projectRoot = createTempProject();
  const runId = "run-related-1";

  writeClip(projectRoot, {
    id: "A",
    tags: ["guard"],
    folders: ["F1"],
    category: "combat",
    relatedClips: [],
  });
  writeClip(projectRoot, {
    id: "B",
    tags: ["guard"],
    folders: ["F2"],
    category: "combat",
    relatedClips: [],
  });

  fs.writeFileSync(
    path.join(projectRoot, "src", "data", "index.json"),
    JSON.stringify({
      clips: [{ id: "A" }, { id: "B" }],
      totalCount: 2,
      generatedAt: "2026-03-27T00:00:00.000Z",
    })
  );

  saveItemState({
    projectRoot,
    runId,
    clipId: "A",
    itemState: {
      id: "A",
      artifacts: {
        status: "completed",
      },
    },
  });

  const summary = await runRelatedStage([{ id: "A" }], { projectRoot, runId });
  const clipA = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "public", "data", "clips", "A.json"), "utf-8")
  );
  const clipB = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "public", "data", "clips", "B.json"), "utf-8")
  );

  assert.equal(summary.mode, "full");
  assert.equal(summary.rewrittenCount, 2);
  assert.deepEqual(clipA.relatedClips, ["B"]);
  assert.deepEqual(clipB.relatedClips, ["A"]);
  assert.equal(loadItemState({ projectRoot, runId, clipId: "A" }).related.status, "completed");
});
