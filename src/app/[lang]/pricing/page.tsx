import type { Locale } from "@/lib/types";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { PricingCards } from "./PricingCards";

export default async function PricingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">
        {lang === "ko" ? "요금제" : "Pricing"}
      </h1>
      <p className="mt-3 text-center text-sm text-muted">
        {lang === "ko"
          ? "1,000개 이상의 게임 애니메이션 레퍼런스를 태그로 탐색"
          : "Explore 1,000+ game animation references with tag-based search"}
      </p>

      <PricingCards lang={lang as Locale} dict={dict} />
    </div>
  );
}
