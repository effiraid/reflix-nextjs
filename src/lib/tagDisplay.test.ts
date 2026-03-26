import { describe, expect, it } from "vitest";
import { getTagDisplayLabel, getTagDisplayLabels } from "./tagDisplay";

describe("tagDisplay", () => {
  it("uses English labels when lang is en and falls back to Korean when missing", () => {
    expect(getTagDisplayLabel("고통", "en", { 고통: "Suffering" })).toBe(
      "Suffering"
    );
    expect(getTagDisplayLabel("비틀거리기", "en", {})).toBe("비틀거리기");
    expect(getTagDisplayLabel("고통", "ko", { 고통: "Suffering" })).toBe("고통");
  });

  it("translates tag arrays in order", () => {
    expect(
      getTagDisplayLabels(["고통", "마법사"], "en", {
        고통: "Suffering",
        마법사: "Mage",
      })
    ).toEqual(["Suffering", "Mage"]);
  });
});
