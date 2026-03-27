import test from "node:test";
import assert from "node:assert/strict";

import { mapWithConcurrency } from "./bounded-pool.mjs";

test("mapWithConcurrency preserves input order", async () => {
  const results = await mapWithConcurrency(
    [3, 1, 2],
    async (value) => {
      await new Promise((resolve) => setTimeout(resolve, value * 5));
      return value * 10;
    },
    { concurrency: 2 }
  );

  assert.deepEqual(results, [30, 10, 20]);
});

test("mapWithConcurrency never exceeds the configured worker limit", async () => {
  let active = 0;
  let maxActive = 0;

  await mapWithConcurrency(
    [1, 2, 3, 4],
    async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, value * 5));
      active -= 1;
      return value;
    },
    { concurrency: 2 }
  );

  assert.equal(maxActive, 2);
});

test("mapWithConcurrency rejects invalid worker counts", async () => {
  await assert.rejects(
    () => mapWithConcurrency([1], async (value) => value, { concurrency: 0 }),
    /positive integer/
  );
});
