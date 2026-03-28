import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

interface LocaleDictionary {
  locale: string;
  dictionary: unknown;
}

function flattenLeaves(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenLeaves(child, prefix ? `${prefix}.${key}` : key)
  );
}

export function loadLocaleDictionaries(directory: string): LocaleDictionary[] {
  return readdirSync(directory)
    .filter((fileName) => path.extname(fileName) === ".json")
    .map((fileName) => ({
      locale: path.basename(fileName, ".json"),
      dictionary: JSON.parse(
        readFileSync(path.join(directory, fileName), "utf8")
      ) as unknown,
    }))
    .sort((a, b) => a.locale.localeCompare(b.locale));
}

export function compareLocaleKeys(source: unknown, target: unknown) {
  const sourceKeys = flattenLeaves(source);
  const targetKeys = flattenLeaves(target);

  return {
    missingKeys: sourceKeys.filter((key) => !targetKeys.includes(key)),
    extraKeys: targetKeys.filter((key) => !sourceKeys.includes(key)),
  };
}
