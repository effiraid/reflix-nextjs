"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Suppress next-themes script warning in React 19
    const origError = console.error;
    console.error = (...args: Parameters<typeof console.error>) => {
      if (
        typeof args[0] === "string" &&
        args[0].includes("Encountered a script tag")
      ) {
        return;
      }
      origError.apply(console, args);
    };
    return () => {
      console.error = origError;
    };
  }, []);

  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
