"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
} from "@/lib/auth-password-policy";
import { useI18n } from "@/lib/i18n";

function AcceptInviteInner() {
  const { t } = useI18n();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  const accept = trpc.auth.acceptInvite.useMutation({
    onSuccess: () => setDone(true),
    onError: (err) => toast.error(err.message),
  });
  const passwordMeetsPolicy =
    password.length >= AUTH_PASSWORD_MIN_LENGTH &&
    password.length <= AUTH_PASSWORD_MAX_LENGTH;
  const canSubmit = passwordMeetsPolicy && password === confirm;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground">OpenVPM</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("auth.acceptInvite.title", "Accept your invite")}
          </p>
        </div>

        {done ? (
          <div className="text-center">
            <p className="text-sm text-foreground">
              {t(
                "auth.acceptInvite.success",
                "Your account is ready. You can now sign in.",
              )}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("auth.acceptInvite.signIn", "Sign in")}
            </Link>
          </div>
        ) : !token ? (
          <p className="text-center text-sm text-destructive">
            {t(
              "auth.acceptInvite.invalidLink",
              "This invite link is invalid. Ask your administrator to send a new one.",
            )}
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!passwordMeetsPolicy) {
                toast.error(
                  t(
                    "auth.acceptInvite.lengthError",
                    `Use ${AUTH_PASSWORD_MIN_LENGTH}-${AUTH_PASSWORD_MAX_LENGTH} characters.`,
                    {
                      min: AUTH_PASSWORD_MIN_LENGTH,
                      max: AUTH_PASSWORD_MAX_LENGTH,
                    },
                  ),
                );
                return;
              }
              if (password !== confirm) {
                toast.error(
                  t(
                    "auth.acceptInvite.mismatchError",
                    "Passwords don't match",
                  ),
                );
                return;
              }
              accept.mutate({ token, password });
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("auth.acceptInvite.createPassword", "Create a password")}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={AUTH_PASSWORD_MIN_LENGTH}
                maxLength={AUTH_PASSWORD_MAX_LENGTH}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={t(
                  "auth.acceptInvite.placeholder",
                  `At least ${AUTH_PASSWORD_MIN_LENGTH} characters`,
                  { min: AUTH_PASSWORD_MIN_LENGTH },
                )}
              />
            </div>
            <div>
              <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("auth.acceptInvite.confirmPassword", "Confirm password")}
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={AUTH_PASSWORD_MIN_LENGTH}
                maxLength={AUTH_PASSWORD_MAX_LENGTH}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={t(
                  "auth.acceptInvite.confirmPlaceholder",
                  "Re-enter your password",
                )}
              />
            </div>
            <button
              type="submit"
              disabled={!canSubmit || accept.isPending}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {accept.isPending
                ? t("auth.acceptInvite.activating", "Activating…")
                : t("auth.acceptInvite.activateButton", "Activate account")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteInner />
    </Suspense>
  );
}
