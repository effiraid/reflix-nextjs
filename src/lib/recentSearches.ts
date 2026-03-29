const STORAGE_KEY = "reflix:recent-searches";
const MAX_ITEMS = 5;

export function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) return;
  const recent = getRecentSearches().filter((q) => q !== trimmed);
  recent.unshift(trimmed);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_ITEMS)));
}

export function removeRecentSearch(query: string): void {
  const recent = getRecentSearches().filter((q) => q !== query);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
}

export function clearRecentSearches(): void {
  localStorage.removeItem(STORAGE_KEY);
}

const MIGRATION_KEY = "reflix:recent-search-alias-migrated";

/**
 * One-time migration: replace alias tags in recent searches with canonical tags.
 * Safe to call multiple times — runs only once per alias config version.
 */
export function migrateRecentSearches(
  aliases: Record<string, string[]>,
  version = 1
): void {
  try {
    const migrationKey = `${MIGRATION_KEY}:${version}`;
    if (localStorage.getItem(migrationKey)) return;

    const reverseMap = new Map<string, string>();
    for (const [canonical, aliasList] of Object.entries(aliases)) {
      for (const alias of aliasList) {
        reverseMap.set(alias, canonical);
      }
    }

    if (reverseMap.size === 0) {
      localStorage.setItem(migrationKey, "1");
      return;
    }

    const recent = getRecentSearches();
    let changed = false;
    const migrated = recent.map((q) => {
      const canonical = reverseMap.get(q);
      if (canonical) {
        changed = true;
        return canonical;
      }
      return q;
    });

    if (changed) {
      // Dedupe after migration
      const unique = [...new Set(migrated)];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(unique.slice(0, MAX_ITEMS)));
    }

    localStorage.setItem(migrationKey, "1");
  } catch {
    // Silently ignore localStorage errors
  }
}
