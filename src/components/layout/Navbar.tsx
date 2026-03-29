"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MoonStarIcon, SearchIcon, SunMediumIcon, UserIcon, LogOutIcon, CrownIcon } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/common/SearchBar";
import { useBrowseData } from "@/app/[lang]/browse/ClipDataProvider";
import type { Locale, TagGroupData } from "@/lib/types";
import type { TagAliasConfig } from "@/lib/data";
import { useUIStore } from "@/stores/uiStore";
import { useClipStore } from "@/stores/clipStore";
import { useAuthStore } from "@/stores/authStore";
import { createClient } from "@/lib/supabase/client";
import { prewarmBrowseSearch } from "@/lib/browsePagefind";
import { MobileSearchOverlay } from "./MobileSearchOverlay";
import { Tooltip } from "@/components/ui/Tooltip";
import type { Dictionary } from "@/app/[lang]/dictionaries";

const getServerMobileSnapshot = () => false;

function subscribeToMobileViewport(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia("(max-width: 767px)");
  const handler = () => onStoreChange();
  mediaQuery.addEventListener("change", handler);
  return () => mediaQuery.removeEventListener("change", handler);
}

function getMobileViewportSnapshot() {
  return window.matchMedia("(max-width: 767px)").matches;
}

interface NavbarProps {
  lang: Locale;
  dict: Pick<Dictionary, "nav"> & Partial<Pick<Dictionary, "browse" | "common">>;
  tagI18n?: Record<string, string>;
  tagGroups?: TagGroupData;
  tagAliases?: TagAliasConfig | null;
}

export function Navbar({ lang, dict, tagI18n = {}, tagGroups, tagAliases = null }: NavbarProps) {
  const { theme, setTheme } = useTheme();
  const {
    allCards,
    cardsStatus,
    projectionClips,
    projectionStatus,
    allTags,
    popularTags,
    tagCounts,
    requestCardIndex,
  } = useBrowseData();
  const { setSelectedClipId } = useClipStore();
  const { user, tier, accessSource, isLoading: authLoading } = useAuthStore();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const isMobileViewport = useSyncExternalStore(
    subscribeToMobileViewport,
    getMobileViewportSnapshot,
    getServerMobileSnapshot
  );
  const {
    leftPanelOpen,
    mobileSearchOpen,
    rightPanelOpen,
    setLeftPanelOpen,
    setMobileSearchOpen,
    setRightPanelOpen,
  } = useUIStore();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const previousPathnameRef = useRef(pathname);
  const isDarkTheme = mounted && theme === "dark";
  const allPanelsOpen = leftPanelOpen && rightPanelOpen;
  const otherLang = lang === "ko" ? "en" : "ko";
  const query = searchParams.toString();
  const currentSearchQuery = searchParams.get("q") ?? "";
  const switchedPath =
    pathname.replace(`/${lang}`, `/${otherLang}`) + (query ? `?${query}` : "");
  const isBrowsePage = pathname === `/${lang}/browse`;
  const themeLabel = isDarkTheme
    ? lang === "ko"
      ? "라이트 테마로 전환"
      : "Switch to light theme"
    : lang === "ko"
      ? "다크 테마로 전환"
      : "Switch to dark theme";
  const panelLabel = isMobileViewport
    ? leftPanelOpen
      ? lang === "ko"
        ? "탐색 패널 닫기"
        : "Close browse panel"
      : lang === "ko"
        ? "탐색 패널 열기"
        : "Open browse panel"
    : allPanelsOpen
      ? lang === "ko"
        ? "좌우 사이드바 접기"
        : "Collapse both sidebars"
      : lang === "ko"
        ? "좌우 사이드바 펼치기"
        : "Expand both sidebars";
  const mobileSearchLabel =
    lang === "ko" ? "모바일 검색 열기" : "Open mobile search";
  const ThemeIcon = isDarkTheme ? SunMediumIcon : MoonStarIcon;

  function handlePanelsToggle() {
    if (isMobileViewport) {
      setLeftPanelOpen(!leftPanelOpen);
      setRightPanelOpen(false);
      return;
    }

    const nextPanelsOpen = !allPanelsOpen;
    setLeftPanelOpen(nextPanelsOpen);
    setRightPanelOpen(nextPanelsOpen);
  }

  function handleSearch(nextQuery: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextQuery) {
      params.set("q", nextQuery);
    } else {
      params.delete("q");
    }

    const nextPath = params.toString()
      ? `/${lang}/browse?${params.toString()}`
      : `/${lang}/browse`;
    router.push(nextPath);
  }

  function handleMobileSearchOpen() {
    if (!isBrowsePage) {
      handleSearch(currentSearchQuery);
      return;
    }

    setMobileSearchOpen(true);
  }

  function handleSearchActivate() {
    requestCardIndex();
    void prewarmBrowseSearch(lang).catch(() => {});
  }

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      setMobileSearchOpen(false);
      previousPathnameRef.current = pathname;
    }
  }, [pathname, setMobileSearchOpen]);

  const hasAutoCollapsedMobilePanelsRef = useRef(false);
  useEffect(() => {
    if (!isBrowsePage || !isMobileViewport) {
      hasAutoCollapsedMobilePanelsRef.current = false;
      return;
    }

    if (hasAutoCollapsedMobilePanelsRef.current) {
      return;
    }

    hasAutoCollapsedMobilePanelsRef.current = true;
    if (leftPanelOpen) {
      setLeftPanelOpen(false);
    }
    if (rightPanelOpen) {
      setRightPanelOpen(false);
    }
  }, [
    isBrowsePage,
    isMobileViewport,
    leftPanelOpen,
    rightPanelOpen,
    setLeftPanelOpen,
    setRightPanelOpen,
  ]);

  return (
    <>
      <header className="grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 md:grid-cols-[minmax(0,1fr)_minmax(16rem,32rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/${lang}`}
            className="shrink-0 font-bold text-lg tracking-tight"
          >
            REFLIX
          </Link>

          <nav className="flex min-w-0 items-center gap-2 text-sm">
            <Link
              href={`/${lang}/browse`}
              className="px-2 py-1 rounded hover:bg-surface-hover inline-flex items-center gap-1.5"
            >
              {dict.nav.browse}
              <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-foreground/60">
                Beta
              </span>
            </Link>
          </nav>
        </div>

        <div
          data-testid="navbar-search"
          className="hidden w-full md:block md:justify-self-center"
        >
          <SearchBar
            initialQuery={currentSearchQuery}
            placeholder={dict.nav.searchPlaceholder}
            onSearch={handleSearch}
            onActivate={handleSearchActivate}
            allTags={allTags}
            popularTags={popularTags}
            tagCounts={tagCounts}
            tagGroups={tagGroups}
            aliasConfig={tagAliases}
            lang={lang}
            recentLabel={lang === "ko" ? "최근 검색어" : "Recent searches"}
            popularLabel={lang === "ko" ? "추천 태그" : "Suggested tags"}
            suggestionsLabel={lang === "ko" ? "태그 제안" : "Tag suggestions"}
            clearLabel={lang === "ko" ? "지우기" : "Clear"}
          />
        </div>

        <div
          data-testid="navbar-controls"
          className="col-start-2 flex items-center justify-self-end gap-1 md:col-start-3"
        >
          <Tooltip label={mobileSearchLabel}>
            <button
              type="button"
              aria-label={mobileSearchLabel}
              onClick={handleMobileSearchOpen}
              className="p-1.5 rounded hover:bg-surface-hover text-sm md:hidden"
            >
              <SearchIcon className="size-4" strokeWidth={1.75} />
            </button>
          </Tooltip>

          <Tooltip label={lang === "ko" ? "English로 전환" : "한국어로 전환"}>
            <Link
              href={switchedPath}
              className="flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M2 12h20"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              {lang === "ko" ? "EN" : "KO"}
            </Link>
          </Tooltip>

          <Tooltip label={themeLabel}>
            <button
              type="button"
              aria-label={themeLabel}
              onClick={() => setTheme(isDarkTheme ? "light" : "dark")}
              className="p-1.5 rounded hover:bg-surface-hover text-sm"
            >
              <ThemeIcon className="size-4" strokeWidth={1.75} />
            </button>
          </Tooltip>

          <Tooltip label={panelLabel}>
            <button
              type="button"
              aria-label={panelLabel}
              onClick={handlePanelsToggle}
              className="p-1.5 rounded hover:bg-surface-hover text-sm"
            >
              {allPanelsOpen ? <PanelsOpenIcon /> : <PanelsClosedIcon />}
            </button>
          </Tooltip>

          {/* Auth: login button or user menu */}
          {mounted && !authLoading ? (
            user ? (
              <UserMenu
                lang={lang}
                tier={tier}
                accessSource={accessSource}
                userMenuOpen={userMenuOpen}
                setUserMenuOpen={setUserMenuOpen}
              />
            ) : (
              <Link
                href={`/${lang}/login`}
                className="ml-1 px-2.5 py-1 text-xs font-medium rounded hover:bg-surface-hover"
              >
                {lang === "ko" ? "로그인" : "Sign in"}
              </Link>
            )
          ) : (
            <div className="ml-1 h-6 w-12 animate-pulse rounded bg-surface" />
          )}
        </div>
      </header>

      <MobileSearchOverlay
        key={mobileSearchOpen ? "mobile-search-open" : "mobile-search-closed"}
        open={mobileSearchOpen}
        clips={projectionClips ?? allCards ?? []}
        searchReady={projectionStatus === "ready" || cardsStatus === "ready"}
        lang={lang}
        tagI18n={tagI18n}
        placeholder={dict.nav.searchPlaceholder}
        closeLabel={dict.common?.close ?? (lang === "ko" ? "닫기" : "Close")}
        noResultsLabel={dict.browse?.noResults ?? (lang === "ko" ? "검색 결과가 없습니다" : "No results found")}
        loadingLabel={dict.common?.loading ?? (lang === "ko" ? "검색 준비 중..." : "Preparing search...")}
        onClose={() => setMobileSearchOpen(false)}
        onRequestSearchReady={handleSearchActivate}
        onSelectClip={(clipId, query) => {
          setSelectedClipId(clipId);
          setMobileSearchOpen(false);
          handleSearch(query);
        }}
        allTags={allTags}
        popularTags={popularTags}
        tagCounts={tagCounts}
        tagGroups={tagGroups}
        aliasConfig={tagAliases}
      />
    </>
  );
}

function UserMenu({
  lang,
  tier,
  accessSource,
  userMenuOpen,
  setUserMenuOpen,
}: {
  lang: Locale;
  tier: "free" | "pro";
  accessSource: "free" | "paid" | "beta";
  userMenuOpen: boolean;
  setUserMenuOpen: (open: boolean) => void;
}) {
  const isKo = lang === "ko";
  const isPaidPro = accessSource === "paid";
  const isBetaPro = accessSource === "beta";
  const { openPricingModal } = useUIStore();

  async function handleSignOut() {
    const supabase = createClient();
    if (!supabase) {
      setUserMenuOpen(false);
      window.location.href = `/${lang}`;
      return;
    }
    await supabase.auth.signOut();
    setUserMenuOpen(false);
    window.location.href = `/${lang}`;
  }

  return (
    <div className="relative ml-1">
      <Tooltip label={isKo ? "프로필" : "Profile"}>
        <button
          type="button"
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          aria-label={isKo ? "프로필" : "Profile"}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium hover:bg-surface-hover"
          aria-expanded={userMenuOpen}
          aria-haspopup="true"
        >
          <UserIcon className="size-3.5" strokeWidth={1.75} />
          {isPaidPro ? (
            <span className="rounded bg-accent/20 px-1 py-0.5 text-[10px] font-semibold leading-none text-accent">
              PRO
            </span>
          ) : isBetaPro ? (
            <span className="rounded bg-foreground/10 px-1 py-0.5 text-[10px] font-semibold leading-none text-foreground/70">
              BETA
            </span>
          ) : tier === "pro" ? (
            <span className="rounded bg-accent/20 px-1 py-0.5 text-[10px] font-semibold leading-none text-accent">
              PRO
            </span>
          ) : null}
        </button>
      </Tooltip>

      {userMenuOpen ? (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setUserMenuOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border border-border bg-surface py-1 shadow-lg">
            <Link
              href={`/${lang}/account`}
              className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-hover"
              onClick={() => setUserMenuOpen(false)}
            >
              <UserIcon className="size-3.5" strokeWidth={1.75} />
              {isKo ? "계정" : "Account"}
            </Link>
            {!isPaidPro ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-accent hover:bg-surface-hover"
                onClick={() => {
                  setUserMenuOpen(false);
                  openPricingModal();
                }}
              >
                <CrownIcon className="size-3.5" strokeWidth={1.75} />
                {isKo ? "Pro 업그레이드" : "Upgrade to Pro"}
              </button>
            ) : (
              <Link
                href={`/${lang}/account`}
                className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-hover"
                onClick={() => setUserMenuOpen(false)}
              >
                <CrownIcon className="size-3.5" strokeWidth={1.75} />
                {isKo ? "구독 관리" : "Manage subscription"}
              </Link>
            )}
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-hover"
            >
              <LogOutIcon className="size-3.5" strokeWidth={1.75} />
              {isKo ? "로그아웃" : "Sign out"}
            </button>
          </div>
        </>
      ) : null}
    </div>
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
