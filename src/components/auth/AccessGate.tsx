"use client";

import { useRouter } from "next/navigation";
import { LockIcon, XIcon } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import type { AccessTier, Locale } from "@/lib/types";

interface AccessGateProps {
  clipAccessTier: AccessTier;
  lang: Locale;
  children: React.ReactNode;
}

export function AccessGate({ clipAccessTier, lang, children }: AccessGateProps) {
  const { user, tier } = useAuthStore();
  const isKo = lang === "ko";

  // Pro clips need pro access
  if (clipAccessTier === "pro" && tier !== "pro") {
    if (!user) {
      return <GateOverlay type="login" lang={lang} isKo={isKo} />;
    }
    return <GateOverlay type="upgrade" lang={lang} isKo={isKo} />;
  }

  return <>{children}</>;
}

function GateOverlay({
  type,
  lang,
  isKo,
}: {
  type: "login" | "upgrade";
  lang: Locale;
  isKo: boolean;
}) {
  const router = useRouter();

  const title =
    type === "login"
      ? isKo
        ? "로그인이 필요합니다"
        : "Sign in required"
      : isKo
        ? "Pro 전용 클립"
        : "Pro-only clip";

  const description =
    type === "login"
      ? isKo
        ? "이 클립을 보려면 로그인해주세요"
        : "Sign in to view this clip"
      : isKo
        ? "이 클립을 보려면 Pro 구독이 필요합니다"
        : "A Pro subscription is required to view this clip";

  const primaryAction = type === "login" ? `/${lang}/login` : `/${lang}/pricing`;
  const primaryLabel =
    type === "login"
      ? isKo
        ? "로그인"
        : "Sign in"
      : isKo
        ? "구독 시작"
        : "Subscribe";

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-center"
        role="dialog"
        aria-modal="true"
      >
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-foreground/5">
          <LockIcon className="size-5 text-muted" strokeWidth={2} />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted">{description}</p>
        {type === "upgrade" ? (
          <p className="mt-1 text-lg font-bold">
            {isKo ? "₩9,900/월" : "$9.90/mo"}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => router.push(primaryAction)}
          className="mt-4 w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/${lang}/browse`)}
          className="mt-2 w-full rounded-md border border-border px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-hover"
        >
          {isKo ? "무료 클립 둘러보기" : "Browse free clips"}
        </button>
      </div>
    </div>
  );
}

/**
 * Daily limit modal — shown when free user exceeds daily view count.
 */
export function DailyLimitModal({
  lang,
  onClose,
}: {
  lang: Locale;
  onClose: () => void;
}) {
  const router = useRouter();
  const isKo = lang === "ko";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-center shadow-lg"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 p-1 rounded hover:bg-surface-hover"
          aria-label={isKo ? "닫기" : "Close"}
        >
          <XIcon className="size-4" />
        </button>
        <h2 className="text-lg font-semibold">
          {isKo
            ? "오늘의 무료 조회를 모두 사용했습니다"
            : "You've used all free views for today"}
        </h2>
        <p className="mt-1 text-sm text-muted">(20/20)</p>
        <p className="mt-3 text-sm text-muted">
          {isKo
            ? "Pro로 업그레이드하면 무제한으로 볼 수 있어요"
            : "Upgrade to Pro for unlimited views"}
        </p>
        <button
          type="button"
          onClick={() => router.push(`/${lang}/pricing`)}
          className="mt-4 w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          {isKo ? "Pro 구독하기" : "Subscribe to Pro"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-md border border-border px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-hover"
        >
          {isKo ? "내일 다시 오기" : "Come back tomorrow"}
        </button>
      </div>
    </div>
  );
}
