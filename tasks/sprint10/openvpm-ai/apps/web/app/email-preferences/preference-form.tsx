"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type State = "ready" | "saving" | "saved" | "error";

export function EmailPreferenceForm({ token }: { token: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<State>(token ? "ready" : "error");
  const [error, setError] = useState(
    token ? "" : t("emailPreferences.invalidLink", "Tento odkaz na nastavenie emailov je neplatný alebo neúplný."),
  );

  async function unsubscribe() {
    setState("saving");
    setError("");
    try {
      const response = await fetch(
        `/api/email-preferences/unsubscribe?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "List-Unsubscribe=One-Click",
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? t("emailPreferences.saveError", "Nastavenie sa nepodarilo uloži."));
      }
      setState("saved");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("emailPreferences.saveErrorRetry", "Nastavenie sa nepodarilo uloži. Skúste to znova."),
      );
      setState("error");
    }
  }

  if (state === "saved") {
    return (
      <div
        className="mt-6 flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"
        role="status"
      >
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-medium">{t("emailPreferences.savedTitle", "Nastavenie uložené")}</p>
          <p className="mt-1 text-xs leading-5">
            {t("emailPreferences.savedDesc", "Voliteľné emaily OpenVPM sú teraz vypnuté. Nebol potrebný žiadny prihlasovací účet ani telefonát.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <Button
        type="button"
        onClick={unsubscribe}
        disabled={!token || state === "saving"}
        className="w-full"
      >
        {state === "saving" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        {t("emailPreferences.turnOffButton", "Vypnúť voliteľné emaily")}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          {t("emailPreferences.immediateNote", "Okamžité, nie je potrebné prihlásenie.")}
        </p>
      )}
    </div>
  );
}
