import test from "node:test";
import assert from "node:assert/strict";

import { parseArgs } from "./grant-beta-access.mjs";

test("parseArgs reads email, days, note, and source", () => {
  assert.deepEqual(
    parseArgs([
      "--email",
      "beta@reflix.dev",
      "--days",
      "14",
      "--source",
      "manual",
      "--note",
      "cohort-1",
    ]),
    {
      email: "beta@reflix.dev",
      days: 14,
      source: "manual",
      note: "cohort-1",
    }
  );
});
