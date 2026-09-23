"use client";

import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function ClinicalGuardianWidget() {
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.extensions.clinicalGuardian.getSummary.useQuery(
    undefined,
    { refetchInterval: 60_000 },
  );

  const resolveMutation = trpc.extensions.clinicalGuardian.resolveAlert.useMutation({
    onSuccess: () => {
      toast.success(t("clinicalGuardian.widget.resolvedSuccess", "Upozornenie bolo vyriešené."));
      utils.extensions.clinicalGuardian.getSummary.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t("clinicalGuardian.widget.resolveError", "Nepodarilo sa označiť za vyriešené."));
    },
  });

  const auditMutation = trpc.extensions.clinicalGuardian.runAuditNow.useMutation({
    onSuccess: (res) => {
      toast.success(
        t(
          "clinicalGuardian.widget.auditSuccess",
          `Audit zákonných lehôt dokončený (${res.count} nových upozornení).`,
          { count: res.count },
        ),
      );
      utils.extensions.clinicalGuardian.getSummary.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t("clinicalGuardian.widget.auditError", "Audit zlyhal."));
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-3 w-64 rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return null;
  }

  const alerts = data?.alerts || [];
  const criticalCount = data?.criticalCount || 0;
  const statutoryCount = data?.statutoryCount || 0;

  return (
    <section
      className="rounded-lg border border-border bg-card shadow-sm"
      aria-labelledby="clinical-guardian-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              criticalCount > 0
                ? "bg-destructive/15 text-destructive"
                : "bg-success/15 text-success"
            }`}
          >
            {criticalCount > 0 ? (
              <ShieldAlert className="h-5 w-5" />
            ) : (
              <ShieldCheck className="h-5 w-5" />
            )}
          </div>
          <div>
            <h2 id="clinical-guardian-heading" className="font-heading text-lg font-semibold">
              {t("clinicalGuardian.widget.title", "Klinický strážca & Zákonné lehoty")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t(
                "clinicalGuardian.widget.subtitle",
                "Automatický dohľad nad liekovými kontraindikáciami a lehotami ŠVPS / KVL SR.",
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <Badge variant="destructive" className="gap-1 text-xs">
              <ShieldAlert className="h-3 w-3" />
              {t("clinicalGuardian.widget.criticalBadge", "{count} kritických", {
                count: criticalCount,
              })}
            </Badge>
          )}

          {statutoryCount > 0 && (
            <Badge variant="warning" className="gap-1 text-xs">
              <Clock className="h-3 w-3" />
              {t("clinicalGuardian.widget.statutoryBadge", "{count} zákonných", {
                count: statutoryCount,
              })}
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => auditMutation.mutate()}
            disabled={auditMutation.isPending}
            title={t("clinicalGuardian.widget.runAudit", "Skontrolovať zákonné lehoty teraz")}
          >
            <RefreshCw
              className={`h-4 w-4 ${auditMutation.isPending ? "animate-spin text-primary" : ""}`}
            />
            <span className="sr-only sm:not-sr-only sm:ml-1 text-xs">
              {t("clinicalGuardian.widget.auditButton", "Audit")}
            </span>
          </Button>

          <Link
            href="/automations?tab=clinical"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline ml-2"
          >
            {t("common.viewAll", "Zobraziť všetko")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="divide-y divide-border">
        {alerts.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <ShieldCheck className="mx-auto h-8 w-8 text-success mb-2 opacity-80" />
            <p className="font-medium text-foreground">
              {t("clinicalGuardian.widget.allGoodTitle", "Všetky klinické kontroly a zákonné lehoty v poriadku")}
            </p>
            <p className="text-xs mt-1">
              {t("clinicalGuardian.widget.allGoodDesc", "Neboli zistené žiadne kontraindikácie ani omeškané hlásenia besnoty či CRSZ.")}
            </p>
          </div>
        ) : (
          alerts.slice(0, 5).map((alert) => {
            const isCritical = alert.severity === "critical";
            const isStatutory = alert.category === "statutory_deadline";

            let destinationUrl = alert.patientId ? `/patients/${alert.patientId}` : "/statutory";
            if (isStatutory) {
              if (alert.title.toLowerCase().includes("besnot")) {
                destinationUrl = "/statutory?tab=rabies";
              } else if (alert.title.toLowerCase().includes("čip") || alert.title.toLowerCase().includes("crsz")) {
                destinationUrl = "/statutory?tab=crsz";
              } else if (alert.title.toLowerCase().includes("ochrann")) {
                destinationUrl = "/statutory?tab=withdrawals";
              }
            }

            return (
              <div
                key={alert.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="mt-0.5 shrink-0">
                    {isCritical ? (
                      <ShieldAlert className="h-4 w-4 text-destructive" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {alert.title}
                      </span>
                      {alert.patientName && (
                        <Link
                          href={`/patients/${alert.patientId}`}
                          className="text-xs text-primary font-medium hover:underline"
                        >
                          ({alert.patientName})
                        </Link>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {alert.message}
                    </p>
                    {alert.suggestedAction && (
                      <p className="text-[11px] text-foreground font-medium mt-1">
                        <span className="text-primary font-semibold">
                          {t("clinicalGuardian.widget.actionPrefix", "Odporúčaný krok:")}{" "}
                        </span>
                        {alert.suggestedAction}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <Link
                    href={destinationUrl}
                    className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {isStatutory
                      ? t("clinicalGuardian.widget.goToStatutory", "Riešiť v moduloch")
                      : t("clinicalGuardian.widget.openPatient", "Karta pacienta")}
                    <ExternalLink className="h-3 w-3" />
                  </Link>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    disabled={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate({ id: alert.id })}
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                    {t("clinicalGuardian.widget.resolveButton", "Vyriešené")}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
