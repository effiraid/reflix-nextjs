"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clearThemeCookie,
  createThemeCookie,
  getThemeColorScheme,
  getThemeClassName,
  isStoredTheme,
  isTheme,
  readThemeCookieFromString,
  SYSTEM_THEME_QUERY,
  THEME_STORAGE_KEY,
  type Theme,
  type StoredTheme,
} from "@/lib/theme";
import { useUIStore } from "@/stores/uiStore";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme | ((prevTheme: Theme) => Theme)) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme() {
  if (
    typeof window !== "undefined" &&
    window.matchMedia(SYSTEM_THEME_QUERY).matches
  ) {
    return "dark";
  }

  return "light";
}

function readStoredTheme(): StoredTheme {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isStoredTheme(value)) {
      return value;
    }

    const cookieTheme = readThemeCookieFromString(document.cookie);
    return cookieTheme ?? "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", getThemeClassName(theme) === "dark");
  root.style.colorScheme = getThemeColorScheme(theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [storedTheme, setStoredTheme] = useState<StoredTheme>(() =>
    readStoredTheme()
  );
  const [systemTheme, setSystemTheme] = useState<Theme>(() => getSystemTheme());
  const theme = storedTheme === "system" ? systemTheme : storedTheme;

  useEffect(() => {
    useUIStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    document.cookie = isTheme(storedTheme)
      ? createThemeCookie(storedTheme)
      : clearThemeCookie();
  }, [storedTheme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY);
    const handleChange = () => {
      setSystemTheme(getSystemTheme());
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }

      const nextStoredTheme = isStoredTheme(event.newValue)
        ? event.newValue
        : "system";

      setStoredTheme(nextStoredTheme);
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: (nextTheme) => {
        const resolvedTheme =
          typeof nextTheme === "function" ? nextTheme(theme) : nextTheme;

        setStoredTheme(resolvedTheme);

        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
        } catch {
          // Ignore storage failures so theme switching still works in memory.
        }
      },
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}
