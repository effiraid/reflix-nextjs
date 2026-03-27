"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/types";

interface LoginFormProps {
  lang: Locale;
  dict: Dictionary;
}

type FormState = "idle" | "loading" | "sent" | "error";

export function LoginForm({ lang }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const isKo = lang === "ko";

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setState("loading");
    setErrorMsg("");

    const supabase = createClient();
    if (!supabase) {
      setState("error");
      setErrorMsg(
        isKo ? "로그인 기능이 아직 설정되지 않았습니다" : "Login is not configured yet"
      );
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/${lang}/browse`,
      },
    });

    if (error) {
      setState("error");
      setErrorMsg(
        isKo ? "이메일을 확인해주세요" : "Please check your email address"
      );
    } else {
      setState("sent");
    }
  }

  async function handleGoogleLogin() {
    const supabase = createClient();
    if (!supabase) {
      setState("error");
      setErrorMsg(
        isKo ? "로그인 기능이 아직 설정되지 않았습니다" : "Login is not configured yet"
      );
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/${lang}/browse`,
      },
    });
  }

  if (state === "sent") {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center">
        <p className="text-sm font-medium text-green-600 dark:text-green-400">
          {isKo ? "이메일을 확인하세요 ✉️" : "Check your email ✉️"}
        </p>
        <p className="mt-2 text-xs text-muted">
          {isKo
            ? "매직 링크를 보냈습니다. 받은 편지함을 확인해주세요."
            : "We sent a magic link. Check your inbox."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <form onSubmit={handleMagicLink} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            {isKo ? "이메일로 로그인" : "Sign in with email"}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            required
            className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {state === "error" && errorMsg ? (
          <p className="text-xs text-red-500">{errorMsg}</p>
        ) : null}

        <button
          type="submit"
          disabled={state === "loading"}
          className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {state === "loading"
            ? isKo
              ? "매직 링크 전송 중..."
              : "Sending magic link..."
            : isKo
              ? "매직 링크 보내기"
              : "Send magic link"}
        </button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-surface px-2 text-muted">
            {isKo ? "또는" : "or"}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-hover"
      >
        <GoogleIcon />
        {isKo ? "Google로 계속하기" : "Continue with Google"}
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
