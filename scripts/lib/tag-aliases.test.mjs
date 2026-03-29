import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAliasMaps,
  cleanTagGroupsAliases,
  migrateTagI18n,
  validateAliasesAgainstTagGroups,
} from "./tag-aliases.mjs";

describe("buildAliasMaps", () => {
  it("builds canonical and reverse maps", () => {
    const { canonicalMap, reverseMap } = buildAliasMaps({
      version: 1,
      aliases: {
        "힘듦": ["힘겨움"],
        "아픔": ["고통", "괴로움"],
      },
    });

    assert.equal(canonicalMap.get("힘겨움"), "힘듦");
    assert.equal(canonicalMap.get("고통"), "아픔");
    assert.equal(canonicalMap.get("괴로움"), "아픔");
    assert.deepEqual(reverseMap.get("힘듦"), ["힘겨움"]);
    assert.deepEqual(reverseMap.get("아픔"), ["고통", "괴로움"]);
  });

  it("detects alias chain (alias is also a canonical key)", () => {
    assert.throws(
      () =>
        buildAliasMaps({
          version: 1,
          aliases: {
            "힘듦": ["힘겨움"],
            "힘겨움": ["지침"],
          },
        }),
      /alias chain detected/
    );
  });

  it("detects duplicate alias across canonicals", () => {
    assert.throws(
      () =>
        buildAliasMaps({
          version: 1,
          aliases: {
            "힘듦": ["지침"],
            "아픔": ["지침"],
          },
        }),
      /duplicate alias "지침"/
    );
  });

  it("throws on non-array alias value", () => {
    assert.throws(
      () =>
        buildAliasMaps({
          version: 1,
          aliases: { "힘듦": "힘겨움" },
        }),
      /must be an array/
    );
  });

  it("returns empty maps for empty aliases", () => {
    const { canonicalMap, reverseMap } = buildAliasMaps({
      version: 1,
      aliases: {},
    });
    assert.equal(canonicalMap.size, 0);
    assert.equal(reverseMap.size, 0);
  });
});

describe("validateAliasesAgainstTagGroups", () => {
  const tagGroupsData = {
    groups: [
      { id: "g1", tags: ["힘듦", "아픔", "걷기"] },
    ],
  };

  it("passes when all canonicals exist in tag groups", () => {
    assert.doesNotThrow(() =>
      validateAliasesAgainstTagGroups(
        { aliases: { "힘듦": ["힘겨움"] } },
        tagGroupsData
      )
    );
  });

  it("throws when canonical is not in any tag group", () => {
    assert.throws(
      () =>
        validateAliasesAgainstTagGroups(
          { aliases: { "없는태그": ["뭔가"] } },
          tagGroupsData
        ),
      /not found in any tag-groups/
    );
  });
});

describe("cleanTagGroupsAliases", () => {
  it("removes alias tags from group arrays", () => {
    const tagGroupsData = {
      groups: [
        { id: "g1", tags: ["힘듦", "힘겨움", "걷기"] },
        { id: "g2", tags: ["아픔", "고통", "괴로움"] },
      ],
      parentGroups: [],
    };
    const canonicalMap = new Map([
      ["힘겨움", "힘듦"],
      ["고통", "아픔"],
      ["괴로움", "아픔"],
    ]);

    const cleaned = cleanTagGroupsAliases(tagGroupsData, canonicalMap);
    assert.deepEqual(cleaned.groups[0].tags, ["힘듦", "걷기"]);
    assert.deepEqual(cleaned.groups[1].tags, ["아픔"]);
  });

  it("does not mutate input", () => {
    const original = {
      groups: [{ id: "g1", tags: ["힘듦", "힘겨움"] }],
      parentGroups: [],
    };
    const canonicalMap = new Map([["힘겨움", "힘듦"]]);
    cleanTagGroupsAliases(original, canonicalMap);
    assert.deepEqual(original.groups[0].tags, ["힘듦", "힘겨움"]);
  });
});

describe("migrateTagI18n", () => {
  it("copies translation from alias to canonical when canonical is missing", () => {
    const tagI18n = {
      "힘겨움": "Struggle",
      "고통": "Suffering",
    };
    const reverseMap = new Map([
      ["힘듦", ["힘겨움"]],
      ["아픔", ["고통", "괴로움"]],
    ]);

    const result = migrateTagI18n(tagI18n, reverseMap);
    assert.equal(result["힘듦"], "Struggle");
    assert.equal(result["아픔"], "Suffering");
  });

  it("does not overwrite existing canonical translation", () => {
    const tagI18n = {
      "힘듦": "Fatigue",
      "힘겨움": "Struggle",
    };
    const reverseMap = new Map([["힘듦", ["힘겨움"]]]);

    const result = migrateTagI18n(tagI18n, reverseMap);
    assert.equal(result["힘듦"], "Fatigue");
  });

  it("does not mutate input", () => {
    const tagI18n = { "힘겨움": "Struggle" };
    const reverseMap = new Map([["힘듦", ["힘겨움"]]]);
    migrateTagI18n(tagI18n, reverseMap);
    assert.equal(tagI18n["힘듦"], undefined);
  });
});
