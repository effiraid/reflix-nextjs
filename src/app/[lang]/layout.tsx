import { Suspense } from "react";
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
      ? "Reflix — 애니메이션 레퍼런스 라이브러리"
      : "Reflix — Animation Reference Library",
    description: isKo
      ? "애니메이터와 개발자를 위한 모션 레퍼런스. 태그 기반 검색으로 원하는 애니메이션을 빠르게 찾아보세요."
      : "Motion reference for animators and developers. Find the animation you need with tag-based search.",
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
            {children}
          </>
        );
      })}
    </Suspense>
  );
}
