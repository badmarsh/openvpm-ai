"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Pill,
  BookOpen,
  FileCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  Info,
  Layers,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export function ClinicalAutomationsView() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [filterStatus, setFilterStatus] = useState<"open" | "resolved" | "dismissed" | "all">("open");

  const { data: alerts, isLoading, refetch } = trpc.extensions.clinicalGuardian.listAlerts.useQuery(
    { status: filterStatus, limit: 100 },
  );

  const resolveMutation = trpc.extensions.clinicalGuardian.resolveAlert.useMutation({
    onSuccess: () => {
      toast.success(t("clinicalGuardian.widget.resolvedSuccess", "Upozornenie bolo vyriešené."));
      utils.extensions.clinicalGuardian.listAlerts.invalidate();
      utils.extensions.clinicalGuardian.getSummary.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t("clinicalGuardian.widget.resolveError", "Nepodarilo sa označiť za vyriešené."));
    },
  });

  const dismissMutation = trpc.extensions.clinicalGuardian.dismissAlert.useMutation({
    onSuccess: () => {
      toast.success(t("clinicalGuardian.actions.dismissSuccess", "Upozornenie bolo vzaté na vedomie."));
      utils.extensions.clinicalGuardian.listAlerts.invalidate();
      utils.extensions.clinicalGuardian.getSummary.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t("clinicalGuardian.actions.dismissError", "Nepodarilo sa odmietnuť upozornenie."));
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
      utils.extensions.clinicalGuardian.listAlerts.invalidate();
      utils.extensions.clinicalGuardian.getSummary.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t("clinicalGuardian.widget.auditError", "Audit zlyhal."));
    },
  });

  return (
    <div className="space-y-6">
      {/* 1. Overview Cards: Active Clinical Safety Gates */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Pill className="h-4 w-4 text-destructive" />
                {t("clinicalGuardian.rules.medSafetyTitle", "Lieková bezpečnosť")}
              </CardTitle>
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                {t("common.active", "Aktívne")}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {t("clinicalGuardian.rules.medSafetyDesc", "Automatická detekcia kontraindikácií pri vyšetrení")}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>• NSAID + Systémové kortikoidy</p>
            <p>• Nefrotoxické lieky pri zlyhávaní obličiek</p>
            <p>• Zaznamenané alergie pacienta</p>
            <p>• Toxicita paracetamolu u mačiek</p>
            <p>• Neurotoxicita MDR1 plemien</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                {t("clinicalGuardian.rules.statutoryTitle", "Zákonné lehoty ŠVPS")}
              </CardTitle>
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                {t("common.active", "Aktívne")}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {t("clinicalGuardian.rules.statutoryDesc", "Dohľad nad lehotami Zákona č. 39/2007 Z. z.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>• Besnota: 5. a 14. deň pozorovania</p>
            <p>• Ochranné lehoty hospodárskych zvierat</p>
            <p>• CRSZ: Registrácia čipov do 7 dní</p>
            <p>• KVEPIS exporty a hlásenia RVPS</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {t("clinicalGuardian.rules.hitlTitle", "Human-in-the-Loop & Etika")}
              </CardTitle>
              <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                {t("common.enforced", "Vynútené")}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {t("clinicalGuardian.rules.hitlDesc", "Právne a etické poistky pre AI")}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>• Zákon 39/2007 §3: AI návrhy vyžadujú podpis lekára</p>
            <p>• Zákon 139/1998: Nulový AI prefill omamných látok</p>
            <p>• Sympathy Gate: Okamžitý stop správ pri úhyne</p>
            <p>• Plná autonómia lekára (Možnosť 1-A dialóg)</p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Alerts Management Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                {t("clinicalGuardian.alerts.title", "Zoznam upozornení Klinického strážcu")}
              </CardTitle>
              <CardDescription className="text-xs">
                {t(
                  "clinicalGuardian.alerts.subtitle",
                  "Evidencia otvorených, vyriešených a akceptovaných klinických a zákonných upozornení.",
                )}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => auditMutation.mutate()}
                disabled={auditMutation.isPending}
                className="gap-1.5 text-xs"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${auditMutation.isPending ? "animate-spin text-primary" : ""}`}
                />
                {t("clinicalGuardian.widget.runAudit", "Spustiť audit lehôt")}
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant={filterStatus === "open" ? "default" : "outline"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setFilterStatus("open")}
            >
              {t("clinicalGuardian.status.open", "Otvorené")}
            </Button>
            <Button
              variant={filterStatus === "resolved" ? "default" : "outline"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setFilterStatus("resolved")}
            >
              {t("clinicalGuardian.status.resolved", "Vyriešené")}
            </Button>
            <Button
              variant={filterStatus === "dismissed" ? "default" : "outline"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setFilterStatus("dismissed")}
            >
              {t("clinicalGuardian.status.dismissed", "Vzaté na vedomie")}
            </Button>
            <Button
              variant={filterStatus === "all" ? "default" : "outline"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setFilterStatus("all")}
            >
              {t("common.all", "Všetky")}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              {t("common.loading", "Načítavam...")}
            </div>
          ) : !alerts || alerts.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              <ShieldCheck className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-medium text-foreground">
                {t("clinicalGuardian.alerts.emptyTitle", "Žiadne upozornenia v zvolenej kategórii")}
              </p>
              <p className="mt-1">
                {t("clinicalGuardian.alerts.emptyDesc", "Klinický strážca nezistil žiadne nevyriešené riziká.")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {alerts.map((alert) => {
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
                  <div key={alert.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="mt-0.5 shrink-0">
                        {isCritical ? (
                          <ShieldAlert className="h-4 w-4 text-destructive" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{alert.title}</span>
                          <Badge
                            variant={isCritical ? "destructive" : "secondary"}
                            className="text-[10px] font-medium uppercase"
                          >
                            {alert.severity}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            {alert.category}
                          </Badge>
                          {alert.patientName && (
                            <Link
                              href={`/patients/${alert.patientId}`}
                              className="text-xs text-primary font-medium hover:underline"
                            >
                              ({alert.patientName})
                            </Link>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
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
                        {isStatutory ? t("clinicalGuardian.widget.goToStatutory", "Riešiť v moduloch") : t("clinicalGuardian.widget.openPatient", "Karta pacienta")}
                        <ExternalLink className="h-3 w-3" />
                      </Link>

                      {alert.status === "open" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2"
                            disabled={resolveMutation.isPending}
                            onClick={() => resolveMutation.mutate({ id: alert.id })}
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                            {t("clinicalGuardian.actions.resolve", "Vyriešiť")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2 text-muted-foreground"
                            disabled={dismissMutation.isPending}
                            onClick={() => dismissMutation.mutate({ id: alert.id })}
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5" />
                            {t("clinicalGuardian.actions.dismiss", "Zavrieť")}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
