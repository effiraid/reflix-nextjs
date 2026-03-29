const STORAGE_KEY = "reflix:view-history";
const MAX_ITEMS = 50;

export function getViewHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addViewHistory(clipId: string): void {
  if (!clipId) return;
  const history = getViewHistory().filter((id) => id !== clipId);
  history.unshift(clipId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_ITEMS)));
}

export function removeViewHistory(clipId: string): void {
  const history = getViewHistory().filter((id) => id !== clipId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function clearViewHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
