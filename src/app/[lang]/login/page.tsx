import type { Locale } from "@/lib/types";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ lang: string }>;
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
