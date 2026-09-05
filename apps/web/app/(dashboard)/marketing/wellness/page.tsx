"use client";

import { useState } from "react";
import {
  Heart,
  Plus,
  CheckCircle2,
  Calendar,
  Gift,
  ShieldAlert,
  Loader2,
  PawPrint,
  User,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function MarketingWellnessPage() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null);
  const [benefitKey, setBenefitKey] = useState("");
  const [benefitNotes, setBenefitNotes] = useState("");

  const plansQuery = trpc.wellness.listPlans.useQuery();
  const enrollmentsQuery = trpc.wellness.listEnrollments.useQuery({});

  const redemptionsQuery = trpc.extensions.marketing.listWellnessRedemptions.useQuery(
    { enrollmentId: selectedEnrollmentId! },
    { enabled: !!selectedEnrollmentId }
  );

  const redeemMutation = trpc.extensions.marketing.redeemWellnessBenefit.useMutation({
    onSuccess: () => {
      toast.success("Benefit z balíčka bol úspešne uplatnený.");
      setBenefitKey("");
      setBenefitNotes("");
      if (selectedEnrollmentId) {
        utils.extensions.marketing.listWellnessRedemptions.invalidate({
          enrollmentId: selectedEnrollmentId,
        });
      }
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa uplatniť benefit.");
    },
  });

  const handleRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollmentId || !benefitKey.trim()) {
      toast.error("Zadajte názov čerpaného benefitu.");
      return;
    }

    redeemMutation.mutate({
      enrollmentId: selectedEnrollmentId,
      benefitKey: benefitKey.trim(),
      notes: benefitNotes.trim() || undefined,
    });
  };

  const enrollments = enrollmentsQuery.data ?? [];
  const plans = plansQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Heart className="w-7 h-7 text-primary" />
            {t("marketing.wellness.title", "Wellness plány & programy")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t(
              "marketing.wellness.subtitle",
              "Preventívne programy kliniky a evidencia čerpania benefitov počas návštevy pacienta. Rešpektuje Sympathy Flow (blokované pre zosnulých pacientov)."
            )}
          </p>
        </div>
      </div>

      {/* Available Plans Summary */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Aktívne preventívne balíčky kliniky</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className="p-4 rounded-xl border bg-card shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-foreground">{plan.name}</h3>
                <Badge variant="secondary" className="text-[10px]">
                  {plan.active ? "Aktívny" : "Neaktívny"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {plan.description || "Komplexný ročný plán preventívnej starostlivosti."}
              </p>
              <div className="pt-2 border-t flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Frekvencia:</span>
                <span>{plan.billingInterval === "monthly" ? "Mesačne" : "Ročne"}</span>
              </div>
            </div>
          ))}
          {plans.length === 0 && !plansQuery.isLoading && (
            <div className="p-4 rounded-xl border bg-muted/30 text-xs text-muted-foreground col-span-3 text-center">
              Zatiaľ nie sú vytvorené žiadne wellness plány v module nastavení.
            </div>
          )}
        </div>
      </div>

      {/* Enrollments & Redemption Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Enrollments */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Zapísaní pacienti vo wellness programe ({enrollments.length})
          </h2>

          {enrollmentsQuery.isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground border rounded-xl bg-card">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
              Načítavam wellness zápisy...
            </div>
          ) : enrollments.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground border rounded-xl bg-card">
              Žiadny pacient zatiaľ nie je zapísaný vo wellness programe.
            </div>
          ) : (
            <div className="divide-y border rounded-xl bg-card overflow-hidden text-xs shadow-sm">
              {enrollments.map((en) => {
                const isSelected = selectedEnrollmentId === en.enrollmentId;
                const isCancelled = en.status === "cancelled";

                return (
                  <div
                    key={en.enrollmentId}
                    onClick={() => !isCancelled && setSelectedEnrollmentId(en.enrollmentId)}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-primary/5 border-l-4 border-l-primary"
                        : "hover:bg-muted/40"
                    } ${isCancelled ? "opacity-60 bg-muted/20 cursor-not-allowed" : ""}`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          {en.patientName ?? "Pacient"}
                        </span>
                        {isCancelled ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Ukončené
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700">
                            Aktívny zápis
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                        <span>Balíček: <strong>{en.planName}</strong></span>
                        <span>Majiteľ: {en.clientFirstName} {en.clientLastName}</span>
                        <span>Platnosť od: {new Date(en.startDate).toLocaleDateString("sk-SK")}</span>
                      </div>
                    </div>

                    {!isCancelled && (
                      <Button
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className="shrink-0 self-start sm:self-center text-xs"
                      >
                        <Gift className="w-3.5 h-3.5 mr-1" />
                        {isSelected ? "Vybrané" : "Čerpať benefit"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1 Col: Redemption Panel */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Čerpanie benefitu</h2>

          {selectedEnrollmentId ? (
            <div className="p-5 rounded-xl border bg-card shadow-sm space-y-4">
              <form onSubmit={handleRedeem} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Názov benefitu *</label>
                  <Input
                    value={benefitKey}
                    onChange={(e) => setBenefitKey(e.target.value)}
                    placeholder="Napr. Bezplatná preventívna prehliadka, Strihanie pazúrikov, Zľava 10% na čistenie zubov"
                    className="text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Poznámka lekára / recepcie</label>
                  <Input
                    value={benefitNotes}
                    onChange={(e) => setBenefitNotes(e.target.value)}
                    placeholder="Napr. vykonané v rámci vyšetrenia"
                    className="text-xs"
                  />
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={redeemMutation.isPending}
                  className="w-full text-xs gap-1.5"
                >
                  {redeemMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Potvrdiť uplatnenie benefitu
                </Button>
              </form>

              {/* History of redemptions */}
              <div className="pt-3 border-t space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  História čerpania pacienta
                </h4>

                {redemptionsQuery.isLoading ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                    Načítavam históriu...
                  </div>
                ) : !redemptionsQuery.data || redemptionsQuery.data.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">
                    Zatiaľ nebol uplatnený žiadny benefit.
                  </p>
                ) : (
                  <div className="divide-y text-xs space-y-2">
                    {redemptionsQuery.data.map((r) => (
                      <div key={r.id} className="pt-2 flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-foreground">{r.benefitKey}</div>
                          {r.notes && <div className="text-[11px] text-muted-foreground">{r.notes}</div>}
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(r.redeemedAt).toLocaleDateString("sk-SK")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-dashed bg-muted/20 text-center space-y-2">
              <Gift className="w-8 h-8 text-muted-foreground/50 mx-auto" />
              <p className="text-xs font-medium text-foreground">Nevybrali ste žiadneho pacienta</p>
              <p className="text-[11px] text-muted-foreground">
                Kliknite na pacienta v zozname vľavo pre zobrazenie histórie a uplatnenie benefitu.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
