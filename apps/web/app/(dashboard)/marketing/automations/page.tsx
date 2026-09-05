"use client";

import { Zap, Clock, ShieldCheck, Smartphone, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function MarketingAutomationsPage() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const rulesQuery = trpc.extensions.marketing.listAutomationRules.useQuery();

  const toggleMutation = trpc.extensions.marketing.toggleAutomationRule.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.enabled
          ? `Pravidlo "${data.label}" bolo zapnuté.`
          : `Pravidlo "${data.label}" bolo pozastavené.`
      );
      utils.extensions.marketing.listAutomationRules.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa zmeniť stav pravidla.");
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Zap className="w-7 h-7 text-primary" />
            {t("marketing.automations.title", "Automatizované pravidlá")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t(
              "marketing.automations.subtitle",
              "Deterministické triggery správ. Systém sám stráži termíny očkovania, kontroly po operácii, žiadosti o recenzie a preventívny recall. Všetko bez zásahu LLM."
            )}
          </p>
        </div>
      </div>

      {/* Rules Grid */}
      {rulesQuery.isLoading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
          Načítavam automatizačné pravidlá...
        </div>
      ) : !rulesQuery.data || rulesQuery.data.length === 0 ? (
        <div className="p-12 text-center space-y-2 border rounded-xl bg-card">
          <AlertCircle className="w-10 h-10 text-muted-foreground/50 mx-auto" />
          <p className="text-sm font-medium text-foreground">Žiadne pravidlá nie sú nakonfigurované</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rulesQuery.data.map((rule) => {
            const isToggling = toggleMutation.isPending && toggleMutation.variables?.id === rule.id;

            return (
              <div
                key={rule.id}
                className={`p-5 rounded-xl border transition-all shadow-sm flex flex-col justify-between ${
                  rule.enabled ? "bg-card border-border" : "bg-muted/20 border-muted opacity-75"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-base text-foreground">{rule.label}</h2>
                        {rule.enabled ? (
                          <Badge className="bg-emerald-600 text-white text-[10px]">Aktívne</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-[10px]">
                            Pozastavené
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {rule.description}
                      </p>
                    </div>

                    {/* Switch Toggle */}
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        rule.enabled ? "bg-primary" : "bg-muted-foreground/30"
                      } ${isToggling ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          rule.enabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="pt-2 border-t flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span>Časovanie: <strong>{rule.timing || rule.triggerKey}</strong></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-primary" />
                      <span>Kanál: <strong>{rule.channel.toUpperCase()}</strong></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                      <span>Základ: <strong>{rule.legalBasis}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>Trigger: <code>{rule.triggerKey}</code></span>
                  <span>Kľúč šablóny: <code>{rule.key}</code></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compliance Information Card */}
      <div className="p-5 rounded-xl border bg-muted/30 space-y-2">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Klinické pravidlá a legislatívne limity (SR)
        </h3>
        <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1 leading-relaxed">
          <li><strong>Tichý nočný režim:</strong> Žiadne správy neodchádzajú medzi 20:00 a 08:00 ani v nedeľu (zaradia sa do fronty na najbližšie povolené ráno).</li>
          <li><strong>SMS Rate Limit:</strong> Maximálne 1 marketingová správa za 14 dní na jedného klienta (chráni pred spamovaním majiteľa).</li>
          <li><strong>Sympathy Gate:</strong> Pri úmrtí pacienta sa všetky automatizované správy a recall pre zviera okamžite blokujú a vytvorí sa úloha pre personál.</li>
          <li><strong>Právny základ:</strong> Zmluvné správy (pripomienka očkovania, kontrola po operácii) nevyžadujú marketingový opt-in; propagačné správy a recenzie áno.</li>
        </ul>
      </div>
    </div>
  );
}
