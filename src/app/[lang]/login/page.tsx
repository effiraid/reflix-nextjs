import { Suspense } from "react";

import type { Locale } from "@/lib/types";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { LoginForm } from "./LoginForm";

function AuthErrorBanner({
  searchParams,
  isKo,
}: {
  searchParams: Promise<{ error?: string }>;
  isKo: boolean;
}) {
  const sp = searchParams as Promise<{ error?: string }>;
  return (
    <Suspense>
      <AuthErrorBannerInner searchParams={sp} isKo={isKo} />
    </Suspense>
  );
}

async function AuthErrorBannerInner({
  searchParams,
  isKo,
}: {
  searchParams: Promise<{ error?: string }>;
  isKo: boolean;
}) {
  const { error } = await searchParams;
  if (error === "replaced") {
    return (
      <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        {isKo
          ? (
              <>
                <span className="block">다른 탭에서 다시 로그인되어 이 탭 세션이 종료되었습니다.</span>
                <span className="block">계속하려면 다시 로그인해주세요.</span>
              </>
            )
          : (
              <>
                <span className="block">This tab was signed out because the account was re-opened in another tab.</span>
                <span className="block">Please sign in again to continue.</span>
              </>
            )}
      </div>
    );
  }

  if (error !== "auth") return null;
  return (
    <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
      {isKo
        ? "로그인에 실패했습니다. 다시 시도해주세요."
        : "Login failed. Please try again."}
    </div>
  );
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">REFLIX</h1>
          <p className="mt-2 text-sm text-muted">
            {dict.nav.home === "홈"
              ? "애니메이션 레퍼런스 라이브러리"
              : "Animation Reference Library"}
          </p>
        </div>

        <AuthErrorBanner searchParams={searchParams} isKo={lang === "ko"} />

        <LoginForm lang={lang as Locale} dict={dict} />

        <p className="mt-6 text-center text-xs text-muted">
          {lang === "ko"
            ? "로그인하면 이용약관에 동의합니다"
            : "By signing in, you agree to our Terms of Service"}
        </p>
      </div>
    </div>
  );
}
