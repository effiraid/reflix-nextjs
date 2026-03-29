import test from "node:test";
import assert from "node:assert/strict";

import { getPagefindIndexOrThrow } from "./pagefind-build.mjs";

test("getPagefindIndexOrThrow returns the index on a successful createIndex result", () => {
  const index = { addCustomRecord() {} };

  const resolved = getPagefindIndexOrThrow(
    {
      index,
      errors: [],
    },
    "createIndex"
  );

  assert.equal(resolved, index);
});

test("getPagefindIndexOrThrow surfaces createIndex errors before using an undefined index", () => {
  assert.throws(
    () =>
      getPagefindIndexOrThrow(
        {
          errors: ["missing binary"],
        },
        "createIndex"
      ),
    /createIndex failed:\nmissing binary/
  );
});

test("getPagefindIndexOrThrow throws a clear error when createIndex returns no index", () => {
  assert.throws(
    () =>
      getPagefindIndexOrThrow(
        {
          errors: [],
        },
        "createIndex"
      ),
    /createIndex did not return an index/
  );
});
