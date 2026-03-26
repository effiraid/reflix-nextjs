"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShareIcon, CheckIcon } from "./PlayerIcons";

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  }
}

interface ShareButtonProps {
  clipId: string;
  lang: string;
  label: string;
  copiedLabel: string;
  variant?: "default" | "icon-only";
  className?: string;
}

export function ShareButton({
  clipId,
  lang,
  label,
  copiedLabel,
  variant = "default",
  className = "",
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = useCallback(async () => {
    const url = `${window.location.origin}/${lang}/clip/${clipId}`;
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [clipId, lang]);

  return (
    <button
      type="button"
      className={className}
      onClick={() => { void handleClick(); }}
      aria-label={copied ? copiedLabel : label}
    >
      {copied ? <CheckIcon /> : <ShareIcon />}
      {variant === "default" && (
        <span className="ml-1.5">{copied ? copiedLabel : label}</span>
      )}
    </button>
  );
}
