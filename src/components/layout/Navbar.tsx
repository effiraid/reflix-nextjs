"use client";

import { MoonStarIcon, SunMediumIcon } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/common/SearchBar";
import type { Locale } from "@/lib/types";
import { useUIStore } from "@/stores/uiStore";

interface NavbarProps {
  lang: Locale;
  dict: {
    nav: {
      home: string;
      browse: string;
      search: string;
      searchPlaceholder: string;
    };
  };
}

export function Navbar({ lang, dict }: NavbarProps) {
  const { theme, setTheme } = useTheme();
  const {
    leftPanelOpen,
    rightPanelOpen,
    setLeftPanelOpen,
    setRightPanelOpen,
  } = useUIStore();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isDarkTheme = theme === "dark";
  const allPanelsOpen = leftPanelOpen && rightPanelOpen;
  const otherLang = lang === "ko" ? "en" : "ko";
  const query = searchParams.toString();
  const currentSearchQuery = searchParams.get("q") ?? "";
  const switchedPath =
    pathname.replace(`/${lang}`, `/${otherLang}`) + (query ? `?${query}` : "");
  const themeLabel = isDarkTheme
    ? lang === "ko"
      ? "라이트 테마로 전환"
      : "Switch to light theme"
    : lang === "ko"
      ? "다크 테마로 전환"
      : "Switch to dark theme";
  const panelLabel = allPanelsOpen
    ? lang === "ko"
      ? "좌우 사이드바 접기"
      : "Collapse both sidebars"
    : lang === "ko"
      ? "좌우 사이드바 펼치기"
      : "Expand both sidebars";
  const ThemeIcon = isDarkTheme ? SunMediumIcon : MoonStarIcon;

  function handlePanelsToggle() {
    const nextPanelsOpen = !allPanelsOpen;
    setLeftPanelOpen(nextPanelsOpen);
    setRightPanelOpen(nextPanelsOpen);
  }

  function handleSearch(nextQuery: string) {
    const params = new URLSearchParams();
    if (nextQuery) {
      params.set("q", nextQuery);
    }

    const nextPath = params.toString()
      ? `/${lang}/search?${params.toString()}`
      : `/${lang}/search`;
    router.push(nextPath);
  }

  return (
    <header className="h-12 border-b border-border flex items-center px-4 gap-3 shrink-0">
      <Link href={`/${lang}`} className="font-bold text-lg tracking-tight">
        REFLIX
      </Link>

      <nav className="flex items-center gap-2 ml-4 text-sm">
        <Link
          href={`/${lang}/browse`}
          className="px-2 py-1 rounded hover:bg-surface-hover"
        >
          {dict.nav.browse}
        </Link>
      </nav>

      <div className="mx-4 hidden max-w-md flex-1 md:block">
        <SearchBar
          initialQuery={currentSearchQuery}
          placeholder={dict.nav.searchPlaceholder}
          onSearch={handleSearch}
        />
      </div>

      <div className="flex-1 md:hidden" />

      {/* Language toggle */}
      <button
        onClick={() => router.push(switchedPath)}
        className="px-2 py-1 text-xs rounded hover:bg-surface-hover"
      >
        {lang === "ko" ? "EN" : "KO"}
      </button>

      {/* Theme toggle */}
      <button
        type="button"
        aria-label={themeLabel}
        title={themeLabel}
        onClick={() => setTheme(isDarkTheme ? "light" : "dark")}
        className="p-1.5 rounded hover:bg-surface-hover text-sm"
      >
        <ThemeIcon className="size-4" strokeWidth={1.75} />
      </button>

      <button
        type="button"
        aria-label={panelLabel}
        title={panelLabel}
        onClick={handlePanelsToggle}
        className="p-1.5 rounded hover:bg-surface-hover text-sm"
      >
        {allPanelsOpen ? <PanelsOpenIcon /> : <PanelsClosedIcon />}
      </button>
    </header>
  );
}

function PanelsOpenIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1.75" y="2.25" width="12.5" height="11.5" rx="1.5" />
      <path d="M5 3V13" />
      <path d="M11 3V13" />
    </svg>
  );
}

function PanelsClosedIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1.75" y="2.25" width="12.5" height="11.5" rx="1.5" />
      <path d="M8 5.5V10.5" />
      <path d="M5.5 8H3.25" />
      <path d="M10.5 8H12.75" />
      <path d="M6.5 6.5L8 8L6.5 9.5" />
      <path d="M9.5 6.5L8 8L9.5 9.5" />
    </svg>
  );
}
