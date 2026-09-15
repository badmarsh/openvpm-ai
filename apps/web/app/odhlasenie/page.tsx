"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  MailCheck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

function UnsubscribeContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const c = searchParams.get("c") ?? undefined;
  const token = searchParams.get("token") ?? undefined;

  const [unsubscribed, setUnsubscribed] = useState(false);

  const infoQuery = trpc.extensions.marketing.getUnsubscribeInfo.useQuery(
    { token, clientId: c },
    { enabled: !!(c || token), refetchOnWindowFocus: false }
  );

  const unsubMutation = trpc.extensions.marketing.unsubscribeByToken.useMutation({
    onSuccess: () => {
      setUnsubscribed(true);
    },
  });

  if (!c && !token) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4 shadow-sm">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-xl font-bold">{t("odhlasenie.invalidLinkTitle", "Neplatný odkaz")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("odhlasenie.invalidLinkDesc", "Odkaz na odhlásenie neobsahuje platný identifikátor. Ak si želáte odhlásiť správy, kontaktujte vašu veterinárnu kliniku priamo.")}
        </p>
      </div>
    );
  }

  if (infoQuery.isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center space-y-3 shadow-sm">
        <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">{t("odhlasenie.verifying", "Overujem údaje...")}</p>
      </div>
    );
  }

  const info = infoQuery.data;

  if (!info || !info.found) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4 shadow-sm">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-xl font-bold">{t("odhlasenie.expiredTitle", "Odkaz vypršal alebo je neplatný")}</h1>
        <p className="text-sm text-muted-foreground">
          {info?.message || t("odhlasenie.notFoundFallback", "Klient nebol nájdený. Kontaktujte nás prosím telefonicky.")}
        </p>
      </div>
    );
  }

  const isAlreadyUnsubscribed = unsubscribed || !info.smsConsent;

  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-6 shadow-sm">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
        {isAlreadyUnsubscribed ? (
          <CheckCircle2 className="h-7 w-7 text-emerald-500" />
        ) : (
          <ShieldCheck className="h-7 w-7 text-primary" />
        )}
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">
          {isAlreadyUnsubscribed
            ? t("odhlasenie.alreadyUnsubscribedTitle", "Marketingové správy sú odhlásené")
            : t("odhlasenie.unsubscribedTitle", "Odhlásenie z marketingových správ")}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {info.practiceName}
        </p>
      </div>

      {isAlreadyUnsubscribed ? (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-foreground space-y-2">
          <p className="font-semibold text-emerald-700 dark:text-emerald-300">
            {t("odhlasenie.successMessage", "Vážená/vážený {name}, váš súhlas s marketingovými správami bol úspešne odvolaný.", { name: info.clientName ?? "" })}
          </p>
          <p className="text-muted-foreground leading-relaxed">
            {t("odhlasenie.successDesc", "Nebudeme vám posielať žiadne propagačné ponuky ani sezónne novinky. Dôležité lekárske upozornenia (výsledky vyšetrení, potvrdenia plánovaných termínov) vám budeme doručovať naďalej na základe poskytovania veterinárnej starostlivosti.")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            {t("odhlasenie.confirmIntro", "Vážená/vážený {name}, jedným kliknutím odvoláte svoj súhlas s odberom marketingových a propagačných SMS/email správ od {practice}.", { name: info.clientName ?? "", practice: info.practiceName ?? "" })}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("odhlasenie.transactionalNote", "Transakčné správy (potvrdenia dohodnutých termínov, pripomienky návštevy) vám budeme doručovať naďalej – patria k riadnemu poskytovaniu veterinárnej starostlivosti.")}
          </p>

          <Button
            size="lg"
            variant="destructive"
            disabled={unsubMutation.isPending}
            onClick={() => unsubMutation.mutate({ token, clientId: c })}
            className="w-full gap-2 font-bold shadow-md"
          >
            {unsubMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("odhlasenie.unsubscribeButton", "Odhlásiť marketingové správy")}
          </Button>
        </div>
      )}

      {info.practicePhone && (
        <div className="pt-4 border-t border-border text-xs text-muted-foreground">
          {t("odhlasenie.contactPrompt", "Potrebujete sa spojiť s recepciou? Volajte na")}{" "}
          <a href={`tel:${info.practicePhone}`} className="font-semibold text-primary underline">
            {info.practicePhone}
          </a>
        </div>
      )}
    </div>
  );
}

export default function UnsubscribePage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      <div className="max-w-md w-full">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-border bg-card p-12 text-center space-y-3 shadow-sm">
              <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">{t("odhlasenie.loading", "Načítavam...")}</p>
            </div>
          }
        >
          <UnsubscribeContent />
        </Suspense>
      </div>
    </div>
  );
}
