import Link from "next/link";
import type { Locale } from "@/lib/types";

interface LandingCTAProps {
  lang: Locale;
  dict: {
    ctaTitle: string;
    ctaSub: string;
    ctaButton: string;
    [key: string]: string;
  };
}

export function LandingCTA({ lang, dict }: LandingCTAProps) {
  return (
    <section className="px-6 py-20 pb-32 text-center">
      <h2
        className="whitespace-pre-line text-[32px] font-bold text-white"
        style={{ letterSpacing: "-1px", wordBreak: "keep-all" }}
      >
        {dict.ctaTitle}
      </h2>
      <p
        className="mt-3 whitespace-pre-line text-[15px]"
        style={{ color: "rgba(255,255,255,0.45)", wordBreak: "keep-all" }}
      >
        {dict.ctaSub}
      </p>
      <div className="mt-8">
        <Link
          href={`/${lang}/browse`}
          className="inline-block bg-white font-semibold text-black transition-opacity hover:opacity-80"
          style={{ padding: "12px 28px", fontSize: 15, borderRadius: 10 }}
        >
          {dict.ctaButton}
        </Link>
      </div>
    </section>
  );
}
