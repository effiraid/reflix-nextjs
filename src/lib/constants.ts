import type { Locale } from "./types";

export const LOCALES: Locale[] = ["ko", "en"];
export const DEFAULT_LOCALE: Locale = "ko";

export const GRID_COLUMNS = {
  desktop: 4,
  tablet: 2,
  mobile: 1,
} as const;

export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1280,
} as const;
