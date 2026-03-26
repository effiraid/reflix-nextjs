export type Theme = "light" | "dark";
export type StoredTheme = Theme | "system";

export const THEME_COOKIE_NAME = "theme";
export const THEME_STORAGE_KEY = "theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

export function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

export function isStoredTheme(
  value: string | null | undefined
): value is StoredTheme {
  return isTheme(value) || value === "system";
}

export function readThemeCookie(cookieValue: string | null | undefined) {
  return isTheme(cookieValue) ? cookieValue : undefined;
}

export function readThemeCookieFromString(cookieString: string) {
  const cookie = cookieString
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${THEME_COOKIE_NAME}=`));

  return readThemeCookie(cookie?.split("=")[1]);
}

export function createThemeCookie(theme: Theme) {
  return `${THEME_COOKIE_NAME}=${theme}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function clearThemeCookie() {
  return `${THEME_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getThemeClassName(theme: Theme | undefined) {
  return theme === "dark" ? "dark" : "";
}

export function getThemeColorScheme(theme: Theme | undefined) {
  return theme === "dark" ? "dark" : "light";
}
