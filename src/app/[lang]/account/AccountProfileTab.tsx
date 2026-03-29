"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

interface Props {
  lang: Locale;
  dict: Pick<Dictionary, "auth" | "account">;
  user: User;
}

export function AccountProfileTab({ lang, dict, user }: Props) {
  const t = dict.account;
  const [displayName, setDisplayName] = useState("");
  const [initialName, setInitialName] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      if (!supabase) {
        setProfileLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      if (data?.display_name) {
        setDisplayName(data.display_name);
        setInitialName(data.display_name);
      }
      setProfileLoaded(true);
    }
    void loadProfile();
  }, [user.id]);

  const hasChanges = displayName !== initialName;

  async function handleSave() {
    if (!hasChanges || saving) return;
    setSaving(true);
    setError("");
    setSaveStatus("idle");

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        setSaveStatus("error");
        return;
      }

      setInitialName(displayName);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setError(lang === "ko" ? "저장에 실패했습니다." : "Failed to save.");
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4">
        <label className="block text-xs font-medium text-muted">
          {t.displayName}
        </label>
        {!profileLoaded ? (
          <div className="mt-1.5 h-[38px] w-full animate-pulse rounded-md bg-border/50" />
        ) : (
          <input
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setSaveStatus("idle");
              setError("");
            }}
            maxLength={30}
            placeholder={t.displayNamePlaceholder}
            className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
          />
        )}

        <div className="mt-4 border-t border-border pt-4">
          <label className="block text-xs font-medium text-muted">
            {dict.auth.email}
          </label>
          <p className="mt-1 text-sm text-foreground">{user.email}</p>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          {saveStatus === "saved" && (
            <span className="text-xs text-green-500">{t.saved} ✓</span>
          )}
          {error && <span className="text-xs text-red-500">{error}</span>}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!hasChanges || saving}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? t.saving : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
