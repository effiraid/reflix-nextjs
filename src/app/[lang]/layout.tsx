import { Suspense } from "react";
import { notFound } from "next/navigation";
import { HtmlLang } from "@/components/HtmlLang";
import { PricingModalHost } from "@/components/pricing/PricingModalHost";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/constants";
import type { Locale } from "@/lib/types";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://reflix.dev";

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
  const languages: Record<string, string> = {};
  for (const l of LOCALES) {
    languages[l] = `${BASE_URL}/${l}`;
  }
  languages["x-default"] = `${BASE_URL}/${DEFAULT_LOCALE}`;

  return {
    title: isKo
      ? "Reflix — 애니메이션 레퍼런스 라이브러리"
      : "Reflix — Animation Reference Library",
    description: isKo
      ? "애니메이터와 개발자를 위한 모션 레퍼런스. 태그 기반 검색으로 원하는 애니메이션을 빠르게 찾아보세요."
      : "Motion reference for animators and developers. Find the animation you need with tag-based search.",
    alternates: {
      canonical: `${BASE_URL}/${lang}`,
      languages,
    },
  };
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  return (
    <Suspense fallback={children}>
      {params.then(({ lang }) => {
        if (!hasLocale(lang)) notFound();

        return (
          <>
            <HtmlLang lang={lang} />
            <PricingModalHost />
            {children}
          </>
        );
      })}
    </Suspense>
  );
}
