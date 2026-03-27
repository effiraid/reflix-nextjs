import type { Locale } from "./types";

export const LOCALES: Locale[] = ["en", "ko"];
export const DEFAULT_LOCALE: Locale = "en";

export const GRID_COLUMNS = {
  desktop: 4,
  tablet: 2,
  mobile: 1,
} as const;

export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1280,
} as const;
