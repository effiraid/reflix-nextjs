"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import type { Locale } from "@/lib/types";

interface LandingNavbarProps {
  lang: Locale;
  dict: {
    navCta: string;
    [key: string]: string;
  };
  navDict: { browse: string };
  authDict: { signIn: string; account: string };
  pricingDict: { title: string };
}

const emptySubscribe = () => () => {};
const getServerSnapshot = () => false;
const getClientSnapshot = () => true;

export function LandingNavbar({
  lang,
  dict,
  navDict,
  authDict,
  pricingDict,
}: LandingNavbarProps) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot
  );
  const user = useAuthStore((s) => s.user);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-6"
      style={{
        height: 56,
        background: "rgba(8,9,10,0.8)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Left: Logo + Brand */}
      <Link href={`/${lang}`} className="flex items-center gap-2">
        <div
          className="flex items-center justify-center rounded-md text-[15px] font-bold text-white"
          style={{
            width: 28,
            height: 28,
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
          }}
        >
          R
        </div>
        <span className="text-[16px] font-semibold text-white">Reflix</span>
      </Link>

      {/* Right: Nav links + Auth + CTA */}
      <div className="flex items-center gap-1 md:gap-5 text-[14px]">
        {/* Hide text links on mobile, show CTA only */}
        <Link
          href={`/${lang}/browse`}
          className="hidden md:flex items-center px-2 text-[#777] transition-colors hover:text-white"
          style={{ minHeight: 44 }}
        >
          {navDict.browse}
        </Link>
        <a
          href="#pricing"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
          }}
          className="hidden md:flex items-center px-2 text-[#777] transition-colors hover:text-white cursor-pointer"
          style={{ minHeight: 44 }}
        >
          {pricingDict.title}
        </a>

        {/* Divider — desktop only */}
        <div
          className="hidden md:block h-4"
          style={{
            width: 1,
            background: "rgba(255,255,255,0.12)",
          }}
        />

        {isClient && user ? (
          <Link
            href={`/${lang}/account`}
            className="flex items-center px-2 text-[#777] transition-colors hover:text-white"
            style={{ minHeight: 44 }}
          >
            {authDict.account}
          </Link>
        ) : (
          <Link
            href={`/${lang}/login`}
            className="flex items-center px-2 text-[#777] transition-colors hover:text-white"
            style={{ minHeight: 44 }}
          >
            {authDict.signIn}
          </Link>
        )}

        <Link
          href={`/${lang}/browse`}
          className="rounded-full bg-white px-4 py-2 text-[13px] font-medium text-black transition-opacity hover:opacity-80"
          style={{ minHeight: 36 }}
        >
          {dict.navCta}
        </Link>
      </div>
    </nav>
  );
}
