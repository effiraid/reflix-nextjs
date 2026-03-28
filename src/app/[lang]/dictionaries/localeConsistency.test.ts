import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  compareLocaleKeys,
  loadLocaleDictionaries,
} from "./localeConsistency";

describe("Locale dictionaries", () => {
  const tempDirs: string[] = [];
  const dictionariesDir = path.dirname(fileURLToPath(import.meta.url));

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("discovers every locale json in the directory", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "reflix-dictionaries-"));
    tempDirs.push(dir);

    writeFileSync(path.join(dir, "ko.json"), JSON.stringify({ auth: { signIn: "로그인" } }));
    writeFileSync(path.join(dir, "en.json"), JSON.stringify({ auth: { signIn: "Sign in" } }));
    writeFileSync(path.join(dir, "ja.json"), JSON.stringify({ auth: { signIn: "ログイン" } }));

    expect(loadLocaleDictionaries(dir).map(({ locale }) => locale)).toEqual([
      "en",
      "ja",
      "ko",
    ]);
  });

  it("keeps every locale aligned with the Korean source dictionary", () => {
    const dictionaries = loadLocaleDictionaries(dictionariesDir);
    const source = dictionaries.find(({ locale }) => locale === "ko");

    expect(source).toBeDefined();

    const results = dictionaries
      .filter(({ locale }) => locale !== "ko")
      .map(({ locale, dictionary }) => ({
        locale,
        ...compareLocaleKeys(source!.dictionary, dictionary),
      }));

    expect(results).toEqual(
      results.map(({ locale }) => ({
        locale,
        missingKeys: [],
        extraKeys: [],
      }))
    );
  });
});
