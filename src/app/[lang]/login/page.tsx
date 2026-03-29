import { Suspense } from "react";

import type { Locale } from "@/lib/types";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { sanitizePostAuthRedirect } from "@/lib/authRedirect";
import { LoginCard } from "@/components/auth/LoginCard";

function AuthErrorBanner({
  searchParams,
  isKo,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
  isKo: boolean;
}) {
  const sp = searchParams as Promise<{ error?: string; next?: string }>;
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
  searchParams: Promise<{ error?: string; next?: string }>;
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
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);
  const { next } = await searchParams;
  const nextPath = sanitizePostAuthRedirect(next, `/${lang}/browse`);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <AuthErrorBanner searchParams={searchParams} isKo={lang === "ko"} />

        <LoginCard
          lang={lang as Locale}
          dict={dict}
          nextPath={nextPath}
        />
      </div>
    </div>
  );
}
