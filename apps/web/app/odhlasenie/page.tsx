"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  PawPrint,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Loader2,
  Info,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [unsubscribed, setUnsubscribed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const unsubscribeMutation = trpc.extensions.marketing.unsubscribeByToken.useMutation({
    onSuccess: () => {
      setUnsubscribed(true);
      setErrorMessage(null);
    },
    onError: (err) => {
      setErrorMessage(err.message || "Nepodarilo sa spracovať odhlásenie. Odkaz môže byť neplatný alebo expirovaný.");
    },
  });

  const handleConfirm = () => {
    if (!token) return;
    unsubscribeMutation.mutate({ token });
  };

  if (!token) {
    return (
      <div className="text-center py-6 space-y-3">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Chýbajúci overovací kód</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Pre odhlásenie z odberu správ použite prosím priamy odkaz doručený v SMS správe alebo emaile.
        </p>
      </div>
    );
  }

  if (unsubscribed) {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="w-14 h-14 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">Boli ste úspešne odhlásený</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Vaše telefónne číslo a email boli odhlásené z odberu marketingových správ, informačných
            bulletinov a propagačných akcií našej veterinárnej kliniky.
          </p>
        </div>

        <div className="pt-4 border-t text-left">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/50 text-xs text-muted-foreground">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p>
              Ak si v budúcnosti budete želať opätovné zasielanie tipov a preventívnych pripomienok,
              môžete súhlas kedykoľvek obnoviť priamo na recepcii kliniky.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-lg font-bold text-foreground">Potvrdenie odhlásenia</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Kliknutím na tlačidlo nižšie potvrdíte odvolanie súhlasu so zasielaním marketingových a
          propagačných správ v zmysle GDPR.
        </p>
      </div>

      <div className="rounded-xl border border-muted-foreground/20 bg-muted/30 p-4 space-y-2 text-xs text-muted-foreground leading-relaxed">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span>Informácia o transakčných správach (GDPR)</span>
        </div>
        <p>
          Toto odhlásenie sa vzťahuje na marketingové oznámenia a newslettere. Pripomienky dohodnutých
          termínov ošetrenia, urgentné správy týkajúce sa hospitalizácie alebo dôležité výsledky
          laboratórnych testov vám budú naďalej doručované v rámci poskytovania riadnej veterinárnej
          starostlivosti.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
          {errorMessage}
        </div>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={unsubscribeMutation.isPending}
        className="w-full h-11 px-4 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm shadow-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        {unsubscribeMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Odhlasujem...
          </>
        ) : (
          "Odhlásiť z marketingových správ"
        )}
      </button>
    </div>
  );
}

export default function PublicUnsubscribePage() {
  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      <div className="max-w-md w-full bg-card border rounded-2xl shadow-sm overflow-hidden">
        <header className="p-6 border-b bg-muted/40 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mx-auto shadow-sm">
            <PawPrint className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Správa súhlasov (GDPR)</h1>
          <p className="text-xs text-muted-foreground">Nastavenia komunikácie veterinárnej kliniky</p>
        </header>

        <div className="p-6 sm:p-8">
          <Suspense
            fallback={
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Načítavam...
              </div>
            }
          >
            <UnsubscribeContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
