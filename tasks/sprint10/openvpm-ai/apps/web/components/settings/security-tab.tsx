"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  User,
  Mail,
  Building,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { formatUserRole } from "@/lib/users/role";
import {
  AUTH_PASSWORD_MIN_LENGTH,
  AUTH_PASSWORD_MAX_LENGTH,
} from "@/lib/auth-password-policy";

export function SecurityTab() {
  const { t } = useI18n();
  const { data: session } = useSession();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: isPlatformAdminUser } = trpc.admin.isPlatformAdmin.useQuery(
    undefined,
    { retry: false },
  );

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success(
        t("settings.security.passwordChanged", "Heslo bolo úspešne zmenené."),
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => {
      toast.error(
        err.message ||
          t(
            "settings.security.passwordError",
            "Nepodarilo sa zmeniť heslo. Skontrolujte zadané údaje.",
          ),
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error(
        t(
          "settings.security.currentPasswordRequired",
          "Zadajte vaše súčasné heslo.",
        ),
      );
      return;
    }

    if (newPassword.length < AUTH_PASSWORD_MIN_LENGTH) {
      toast.error(
        t(
          "settings.security.passwordMinLength",
          `Nové heslo musí mať aspoň ${AUTH_PASSWORD_MIN_LENGTH} znakov.`,
          { min: AUTH_PASSWORD_MIN_LENGTH },
        ),
      );
      return;
    }

    if (newPassword.length > AUTH_PASSWORD_MAX_LENGTH) {
      toast.error(
        t(
          "settings.security.passwordMaxLength",
          `Nové heslo môže mať najviac ${AUTH_PASSWORD_MAX_LENGTH} znakov.`,
          { max: AUTH_PASSWORD_MAX_LENGTH },
        ),
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(
        t("settings.security.passwordsDoNotMatch", "Nové heslá sa nezhodujú."),
      );
      return;
    }

    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  const isFormValid =
    currentPassword.length > 0 &&
    newPassword.length >= AUTH_PASSWORD_MIN_LENGTH &&
    newPassword.length <= AUTH_PASSWORD_MAX_LENGTH &&
    newPassword === confirmPassword;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Account Profile Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex items-center gap-3 pb-4 border-b border-border/60">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("settings.security.profileTitle", "Používateľský profil")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t(
                "settings.security.profileDesc",
                "Informácie o vašom prihlásenom účte",
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-medium text-muted-foreground block">
                {t("settings.security.name", "Meno")}
              </span>
              <span className="text-sm font-semibold text-foreground truncate block">
                {session?.user?.name || "—"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-medium text-muted-foreground block">
                {t("settings.security.email", "E-mail")}
              </span>
              <span className="text-sm font-semibold text-foreground truncate block">
                {session?.user?.email || "—"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
            <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-medium text-muted-foreground block">
                {t("settings.security.role", "Rola")}
              </span>
              <span className="text-sm font-semibold text-foreground capitalize block">
                {session?.user?.role
                  ? formatUserRole(session.user.role, t)
                  : "—"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
            {isPlatformAdminUser ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <Building className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-medium text-muted-foreground block">
                {t("settings.security.operatorStatus", "Platform Operator")}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isPlatformAdminUser ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[11px] font-medium">
                    {t("settings.security.operatorGranted", "Platform Admin")}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {t("settings.security.operatorStandard", "Štandardný používateľ")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex items-center gap-3 pb-4 border-b border-border/60">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("settings.security.changePasswordTitle", "Zmena hesla")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t(
                "settings.security.changePasswordDesc",
                "Aktualizujte si prihlasovacie heslo k vášmu účtu",
              )}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="current-password"
              className="text-xs font-medium text-foreground"
            >
              {t("settings.security.currentPassword", "Súčasné heslo")}
            </label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={changePasswordMutation.isPending}
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="new-password"
                className="text-xs font-medium text-foreground"
              >
                {t("settings.security.newPassword", "Nové heslo")}
              </label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder={t(
                  "settings.security.passwordMinPlaceholder",
                  `Min. ${AUTH_PASSWORD_MIN_LENGTH} znakov`,
                  { min: AUTH_PASSWORD_MIN_LENGTH },
                )}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={changePasswordMutation.isPending}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirm-password"
                className="text-xs font-medium text-foreground"
              >
                {t("settings.security.confirmPassword", "Potvrdenie nového hesla")}
              </label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={changePasswordMutation.isPending}
                className="h-9"
              />
            </div>
          </div>

          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              {t("settings.security.passwordsDoNotMatch", "Nové heslá sa nezhodujú.")}
            </p>
          )}

          {newPassword && confirmPassword && newPassword === confirmPassword && (
            <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("settings.security.passwordsMatch", "Heslá sa zhodujú.")}
            </p>
          )}

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              disabled={!isFormValid || changePasswordMutation.isPending}
              className="h-9 px-4 gap-2"
            >
              {changePasswordMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t("settings.security.saving", "Ukladám...")}</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  <span>{t("settings.security.submit", "Zmeniť heslo")}</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
