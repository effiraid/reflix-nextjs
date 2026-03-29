"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { buildAuthCallbackUrl } from "@/lib/authRedirect";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/types";

interface Props {
  lang: Locale;
  dict: Pick<Dictionary, "auth" | "account">;
  user: User;
}

export function AccountSecurityTab({ lang, dict, user }: Props) {
  const t = dict.account;
  const router = useRouter();
  const searchParams = useSearchParams();

  // Google identity state
  const [identitiesLoading, setIdentitiesLoading] = useState(true);
  const [identitiesError, setIdentitiesError] = useState("");
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);

  // Email change state
  const [newEmail, setNewEmail] = useState("");
  const [emailChanging, setEmailChanging] = useState(false);
  const [emailChangeStatus, setEmailChangeStatus] = useState<"idle" | "sent" | "error">("idle");
  const [emailError, setEmailError] = useState("");

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!user) return;
    let isActive = true;

    async function loadIdentities() {
      const supabase = createClient();
      if (!supabase) {
        if (!isActive) return;
        setIdentitiesError(t.supabaseNotConfigured);
        setIdentitiesLoading(false);
        return;
      }
      setIdentitiesLoading(true);
      const { data, error } = await supabase.auth.getUserIdentities();
      if (!isActive) return;
      if (error) {
        setIdentitiesError(t.methodsLoadError);
        setIdentitiesLoading(false);
        return;
      }
      setIsGoogleLinked(
        (data?.identities ?? []).some((id) => id.provider === "google")
      );
      setIdentitiesError("");
      setIdentitiesLoading(false);
    }

    void loadIdentities();
    return () => { isActive = false; };
  }, [user, t.supabaseNotConfigured, t.methodsLoadError]);

  async function handleConnectGoogle() {
    const supabase = createClient();
    if (!supabase) {
      setIdentitiesError(t.supabaseNotConfigured);
      return;
    }
    const redirectTo = buildAuthCallbackUrl(
      lang,
      window.location.origin,
      `/${lang}/account?tab=security&linked=google`
    );
    if (!redirectTo) {
      setIdentitiesError(t.googleLinkMisconfigured);
      return;
    }
    setIsLinkingGoogle(true);
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setIdentitiesError(t.googleLinkStartFailed);
      setIsLinkingGoogle(false);
    }
  }

  async function handleChangeEmail() {
    if (!newEmail.trim() || emailChanging) return;
    const supabase = createClient();
    if (!supabase) return;
    setEmailChanging(true);
    setEmailError("");
    setEmailChangeStatus("idle");
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) {
      setEmailError(error.message);
      setEmailChangeStatus("error");
    } else {
      setEmailChangeStatus("sent");
      setNewEmail("");
    }
    setEmailChanging(false);
  }

  async function handleSignOut() {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace(`/${lang}/`);
  }

  async function handleDeleteAccount() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error || "Failed to delete account");
        setDeleting(false);
        return;
      }
      const supabase = createClient();
      if (supabase) await supabase.auth.signOut();
      router.replace(`/${lang}/`);
    } catch {
      setDeleteError(lang === "ko" ? "삭제에 실패했습니다." : "Failed to delete.");
      setDeleting(false);
    }
  }

  const confirmText = t.deleteAccountConfirmInput;
  const canDelete = deleteInput === confirmText;

  return (
    <div className="space-y-4">
      {/* Login methods */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm font-medium">{t.signInMethods}</p>

        {searchParams.get("linked") === "google" && (
          <p className="mt-2 text-xs text-green-500">{t.googleConnected}</p>
        )}
        {searchParams.get("linkError") === "google" && (
          <p className="mt-2 text-xs text-red-500">{t.googleConnectFailed}</p>
        )}

        {/* Email method */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Email</p>
            <p className="mt-0.5 text-xs text-muted">
              {user.email} — {t.emailMagicLink}
            </p>
          </div>
          <span className="rounded bg-green-500/10 px-2 py-1 text-xs font-medium text-green-500">
            {t.connected}
          </span>
        </div>

        <div className="my-3 h-px bg-border" />

        {/* Google method */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Google</p>
            <p className="mt-0.5 text-xs text-muted">{t.googleConnectDesc}</p>
          </div>
          {identitiesLoading ? (
            <span className="text-xs text-muted">{t.loadingMethods}</span>
          ) : isGoogleLinked ? (
            <span className="rounded bg-green-500/10 px-2 py-1 text-xs font-medium text-green-500">
              {t.connected}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void handleConnectGoogle()}
              disabled={isLinkingGoogle}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-hover disabled:opacity-50"
            >
              {isLinkingGoogle ? t.connectingGoogle : t.connectGoogle}
            </button>
          )}
        </div>

        {identitiesError && (
          <p className="mt-3 text-xs text-red-500">{identitiesError}</p>
        )}
      </div>

      {/* Email change */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm font-medium">{t.changeEmail}</p>
        {emailChangeStatus === "sent" && (
          <p className="mt-2 text-xs text-green-500">{t.changeEmailSent}</p>
        )}
        <div className="mt-3 flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value);
              setEmailChangeStatus("idle");
              setEmailError("");
            }}
            placeholder={t.newEmailPlaceholder}
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
          />
          <button
            type="button"
            onClick={() => void handleChangeEmail()}
            disabled={!newEmail.trim() || emailChanging}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-hover disabled:opacity-50"
          >
            {emailChanging ? t.changingEmail : t.changeEmailBtn}
          </button>
        </div>
        {emailError && (
          <p className="mt-2 text-xs text-red-500">{emailError}</p>
        )}
        <p className="mt-2 text-[11px] text-muted">{t.changeEmailDesc}</p>
      </div>

      {/* Divider */}
      <div className="my-2 h-px bg-border" />

      {/* Sign out */}
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="w-full rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        {dict.auth.signOut}
      </button>

      {/* Danger zone */}
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
        <p className="text-sm font-medium text-red-500">{t.dangerZone}</p>
        <p className="mt-1 text-xs text-muted">{t.deleteAccountDesc}</p>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          {t.deleteAccount}
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6">
            <h2 className="text-base font-bold">{t.deleteAccountConfirmTitle}</h2>
            <p className="mt-2 text-xs text-muted">{t.deleteAccountDesc}</p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => {
                setDeleteInput(e.target.value);
                setDeleteError("");
              }}
              placeholder={t.deleteAccountConfirmPlaceholder}
              className="mt-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-red-500"
            />
            {deleteError && (
              <p className="mt-2 text-xs text-red-500">{deleteError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteInput("");
                  setDeleteError("");
                }}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-hover"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteAccount()}
                disabled={!canDelete || deleting}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? t.deleting : t.deleteAccount}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
