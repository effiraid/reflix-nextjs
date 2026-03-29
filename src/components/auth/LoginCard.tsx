"use client";

import { LoginForm } from "@/app/[lang]/login/LoginForm";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/types";

interface LoginCardProps {
  lang: Locale;
  dict: Dictionary;
  nextPath: string;
}

export function LoginCard({ lang, dict, nextPath }: LoginCardProps) {
  const isKo = lang === "ko";

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">REFLIX</h1>
        <p className="mt-2 text-sm text-muted">
          {isKo
            ? "애니메이션 레퍼런스 라이브러리"
            : "Animation Reference Library"}
        </p>
      </div>

      <LoginForm
        lang={lang}
        dict={dict}
        nextPath={nextPath}
      />

      <p className="mt-6 text-center text-xs text-muted">
        {dict.auth.termsNotice}
      </p>
    </div>
  );
}
