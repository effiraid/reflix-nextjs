import { notFound } from "next/navigation";
import { HtmlLang } from "@/components/HtmlLang";
import { LOCALES } from "@/lib/constants";
import type { Locale } from "@/lib/types";

export async function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

function hasLocale(locale: string): locale is Locale {
  return LOCALES.includes(locale as Locale);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const isKo = lang === "ko";
  return {
    title: isKo
      ? "Reflix — 게임 애니메이션 레퍼런스"
      : "Reflix — Game Animation Reference",
    description: isKo
      ? "7,000개 이상의 게임 애니메이션 클립을 탐색하세요."
      : "Explore 7,000+ game animation reference clips.",
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  return (
    <>
      <HtmlLang lang={lang} />
      {children}
    </>
  );
}
