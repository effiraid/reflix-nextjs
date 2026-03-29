import { DEFAULT_LOCALE, LOCALES } from "@/lib/constants";

const TAB_ID_KEY = "reflix-auth-tab-id";
const ACTIVE_TAB_KEY = "reflix-active-auth-tab";
const TAB_REVOKED_KEY = "reflix-auth-tab-revoked";
const ACTIVE_TAB_STALE_MS = 15_000;
const PENDING_AUTH_FLOW_KEY = "reflix-pending-auth-flow";
const PENDING_AUTH_FLOW_STALE_MS = 15 * 60 * 1000;

interface ActiveAuthTabRecord {
  tabId: string;
  updatedAt: number;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function createTabId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readActiveAuthTab(): ActiveAuthTabRecord | null {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(ACTIVE_TAB_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ActiveAuthTabRecord>;
    if (typeof parsed.tabId !== "string" || typeof parsed.updatedAt !== "number") {
      return null;
    }

    return {
      tabId: parsed.tabId,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function getOrCreateAuthTabId() {
  if (!isBrowser()) return "server";

  const existing = window.sessionStorage.getItem(TAB_ID_KEY);
  if (existing) return existing;

  const next = createTabId();
  window.sessionStorage.setItem(TAB_ID_KEY, next);
  return next;
}

export function getActiveAuthTab() {
  const active = readActiveAuthTab();
  if (!active) return null;

  if (Date.now() - active.updatedAt > ACTIVE_TAB_STALE_MS) {
    if (isBrowser()) {
      window.localStorage.removeItem(ACTIVE_TAB_KEY);
    }
    return null;
  }

  return active;
}

export function claimActiveAuthTab(tabId: string) {
  if (!isBrowser()) return;

  const next: ActiveAuthTabRecord = {
    tabId,
    updatedAt: Date.now(),
  };

  window.localStorage.setItem(ACTIVE_TAB_KEY, JSON.stringify(next));
}

export function restoreActiveAuthTab(record: { tabId: string; updatedAt: number } | null) {
  if (!isBrowser()) return;

  if (!record) {
    window.localStorage.removeItem(ACTIVE_TAB_KEY);
    return;
  }

  window.localStorage.setItem(ACTIVE_TAB_KEY, JSON.stringify(record));
}

export function clearActiveAuthTab(tabId?: string) {
  if (!isBrowser()) return;

  const active = readActiveAuthTab();
  if (!active) return;
  if (tabId && active.tabId !== tabId) return;

  window.localStorage.removeItem(ACTIVE_TAB_KEY);
}

export function markTabSessionRevoked() {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(TAB_REVOKED_KEY, "1");
}

export function clearTabSessionRevoked() {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(TAB_REVOKED_KEY);
}

export function isTabSessionRevoked() {
  if (!isBrowser()) return false;
  return window.sessionStorage.getItem(TAB_REVOKED_KEY) === "1";
}

function hasFreshPendingAuthFlow() {
  if (!isBrowser()) return false;

  const raw = window.sessionStorage.getItem(PENDING_AUTH_FLOW_KEY);
  if (!raw) return false;

  const createdAt = Number.parseInt(raw, 10);
  if (!Number.isFinite(createdAt)) {
    window.sessionStorage.removeItem(PENDING_AUTH_FLOW_KEY);
    return false;
  }

  if (Date.now() - createdAt > PENDING_AUTH_FLOW_STALE_MS) {
    window.sessionStorage.removeItem(PENDING_AUTH_FLOW_KEY);
    return false;
  }

  return true;
}

export function markPendingAuthFlow() {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(PENDING_AUTH_FLOW_KEY, `${Date.now()}`);
}

export function clearPendingAuthFlow() {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(PENDING_AUTH_FLOW_KEY);
}

export function consumePendingAuthFlow() {
  const isValid = hasFreshPendingAuthFlow();
  if (isValid) {
    clearPendingAuthFlow();
  }
  return isValid;
}

export function buildSessionReplacedLoginPath(pathname: string) {
  const locale =
    LOCALES.find(
      (candidate) =>
        pathname === `/${candidate}` || pathname.startsWith(`/${candidate}/`)
    ) ?? DEFAULT_LOCALE;

  return `/${locale}/login?error=replaced`;
}
