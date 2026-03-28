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
