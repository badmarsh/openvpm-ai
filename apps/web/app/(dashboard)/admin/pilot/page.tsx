"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Users,
  PawPrint,
  CheckCircle2,
  Euro,
  Boxes,
  FileSignature,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Plus,
  Loader2,
  ChevronRight,
  Sparkles,
  FlaskConical,
  MessageSquareOff,
  ExternalLink,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { useCurrencyFormatter } from "@/lib/locale/useCurrency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";

export default function PilotReconciliationPage() {
  const { t } = useI18n();
  const formatCurrency = useCurrencyFormatter();
  const utils = trpc.useUtils();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Form state for discrepancy report
  const [discrepancyForm, setDiscrepancyForm] = useState({
    incidentDate: todayStr,
    moduleWorkflow: "clinical",
    vetSoftwareReference: "",
    description: "",
    severity: "medium" as "low" | "medium" | "critical",
  });

  // Queries
  const parityQuery = trpc.extensions.reconciliation.getDailyParitySummary.useQuery(
    { date: selectedDate },
    { refetchOnWindowFocus: false }
  );

  const draftsQuery = trpc.extensions.reconciliation.getPendingClinicalDrafts.useQuery(
    undefined,
    { refetchOnWindowFocus: false }
  );

  const suppressionQuery = trpc.extensions.reconciliation.getSuppressedCommunications.useQuery(
    { date: selectedDate },
    { refetchOnWindowFocus: false }
  );

  const discrepanciesQuery = trpc.extensions.reconciliation.listDiscrepancies.useQuery(
    { limit: 50 },
    { refetchOnWindowFocus: false }
  );

  // Mutation
  const reportMutation = trpc.extensions.reconciliation.reportDiscrepancy.useMutation({
    onSuccess: () => {
      toast.success(
        t(
          "admin.pilot.reportSuccess",
          "Nezrovnalosť s VetSoftware v2 bola úspešne zaznamenaná."
        )
      );
      setReportModalOpen(false);
      setDiscrepancyForm({
        incidentDate: todayStr,
        moduleWorkflow: "clinical",
        vetSoftwareReference: "",
        description: "",
        severity: "medium",
      });
      utils.extensions.reconciliation.listDiscrepancies.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Nepodarilo sa uložiť hlásenie.");
    },
  });

  const handleRefreshAll = () => {
    parityQuery.refetch();
    draftsQuery.refetch();
    suppressionQuery.refetch();
    discrepanciesQuery.refetch();
    toast.info(t("common.refreshed", "Údaje boli aktualizované."));
  };

  const handleCreateDiscrepancy = (e: React.FormEvent) => {
    e.preventDefault();
    if (discrepancyForm.description.trim().length < 3) {
      toast.error("Popis nezrovnalosti musí mať aspoň 3 znaky.");
      return;
    }
    reportMutation.mutate({
      incidentDate: discrepancyForm.incidentDate,
      moduleWorkflow: discrepancyForm.moduleWorkflow,
      vetSoftwareReference: discrepancyForm.vetSoftwareReference || undefined,
      description: discrepancyForm.description.trim(),
      severity: discrepancyForm.severity,
    });
  };

  const parity = parityQuery.data ?? {
    clientsCreated: 0,
    patientsCreated: 0,
    completedVisits: 0,
    totalTurnover: 0,
    inventoryMovements: 0,
  };

  return (
    <div className="space-y-8">
      {/* ── Page Header & Date Filter ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {t("admin.pilot.title", "Denná kontrola & Reconciliácia s VetSoftware v2")}
            </h1>
            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300">
              Pilotný Shadow-Run
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "admin.pilot.subtitle",
              "Dátová parita, audit neautorizovaných AI konceptov a evidencia nezrovnalostí pre ambulanciu MVDr. Martina Sýkoru."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 shadow-2xs">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-7 w-auto border-0 p-0 text-xs font-medium focus-visible:ring-0"
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleRefreshAll}
            className="gap-1.5 h-9"
            disabled={parityQuery.isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${parityQuery.isFetching ? "animate-spin" : ""}`} />
            {t("common.refresh", "Obnoviť")}
          </Button>

          <Button
            size="sm"
            onClick={() => setReportModalOpen(true)}
            className="gap-1.5 h-9 bg-primary text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            {t("admin.pilot.reportDiscrepancyBtn", "Nahlásiť nezrovnalosť")}
          </Button>
        </div>
      </div>

      {/* ── SECTION 1: Sumár dátovej parity ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {t("admin.pilot.paritySummaryTitle", "Sumár dátovej parity za vybraný deň")} ({selectedDate})
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>{t("admin.pilot.clientsCreated", "Noví klienti")}</span>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {parityQuery.isLoading ? "..." : parity.clientsCreated}
            </p>
            <p className="text-[11px] text-muted-foreground">Založených v OpenVPM</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>{t("admin.pilot.patientsCreated", "Noví pacienti")}</span>
              <PawPrint className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {parityQuery.isLoading ? "..." : parity.patientsCreated}
            </p>
            <p className="text-[11px] text-muted-foreground">Zvieracie karty</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>{t("admin.pilot.completedVisits", "Ukončené návštevy")}</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {parityQuery.isLoading ? "..." : parity.completedVisits}
            </p>
            <p className="text-[11px] text-muted-foreground">Ošetrení v ambulancii</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>{t("admin.pilot.financialTurnover", "Finančný obrat")}</span>
              <Euro className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {parityQuery.isLoading ? "..." : formatCurrency(parity.totalTurnover)}
            </p>
            <p className="text-[11px] text-muted-foreground">Faktúry & e-Kasa doklady</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>{t("admin.pilot.inventoryMovements", "Skladové pohyby")}</span>
              <Boxes className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {parityQuery.isLoading ? "..." : parity.inventoryMovements}
            </p>
            <p className="text-[11px] text-muted-foreground">Položiek s pohybom</p>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: Audit klinických AI draftov (Zákon 39/2007 §3) ── */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <h2 className="text-base font-semibold text-foreground">
                {t("admin.pilot.clinicalAuditTitle", "Audit klinických AI draftov (Zákon č. 39/2007 Z. z. §3)")}
              </h2>
              {draftsQuery.data?.totalPending ? (
                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300">
                  {draftsQuery.data.totalPending} čaká na podpis
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Všetko autorizované
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(
                "admin.pilot.clinicalAuditDesc",
                "Zoznam všetkých SOAP záznamov a laboratórnych importov v stave draft. Podľa zákona nesmie byť žiadny AI návrh commitnutý bez explicitného podpisu veterinára."
              )}
            </p>
          </div>
        </div>

        {draftsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Overujem klinické drafty...
          </div>
        ) : draftsQuery.data?.totalPending === 0 ? (
          <div className="rounded-lg border border-emerald-300/60 bg-emerald-50/50 p-4 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200 flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Žiadne neuzavreté AI koncepty ani laboratórne nálezy nečakajú na podpis. Klinický denník je v úplnom súlade.</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* SOAP drafts */}
            {draftsQuery.data?.draftSoaps && draftsQuery.data.draftSoaps.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  Neuzavreté SOAP koncepty ({draftsQuery.data.draftSoaps.length})
                </p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-muted-foreground text-left border-b border-border">
                      <tr>
                        <th className="py-2.5 px-3 font-medium">Pacient</th>
                        <th className="py-2.5 px-3 font-medium">Autor / Lekár</th>
                        <th className="py-2.5 px-3 font-medium">Čas vytvorenia</th>
                        <th className="py-2.5 px-3 font-medium">Náhľad zápisu</th>
                        <th className="py-2.5 px-3 text-right font-medium">Akcia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {draftsQuery.data.draftSoaps.map((soap) => (
                        <tr key={soap.id} className="hover:bg-muted/20">
                          <td className="py-2.5 px-3 font-medium">{soap.patientName}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{soap.authorName}</td>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">
                            {soap.createdAt ? new Date(soap.createdAt).toLocaleString("sk-SK") : "—"}
                          </td>
                          <td className="py-2.5 px-3 max-w-xs truncate text-muted-foreground">
                            {soap.assessment || soap.subjective || "Koncept vyšetrenia"}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Link
                              href={`/records/new-soap/${soap.patientId}${soap.appointmentId ? `?appointmentId=${soap.appointmentId}` : ""}`}
                              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline text-xs"
                            >
                              Autorizovať a podpísať <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Lab drafts */}
            {draftsQuery.data?.draftLabs && draftsQuery.data.draftLabs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <FlaskConical className="h-3.5 w-3.5 text-amber-600" />
                  Neoverené laboratórne importy ({draftsQuery.data.draftLabs.length})
                </p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-muted-foreground text-left border-b border-border">
                      <tr>
                        <th className="py-2.5 px-3 font-medium">Pacient</th>
                        <th className="py-2.5 px-3 font-medium">Analyzátor / Vzorka</th>
                        <th className="py-2.5 px-3 font-medium">Abnormality / Kritické</th>
                        <th className="py-2.5 px-3 font-medium">Stav</th>
                        <th className="py-2.5 px-3 text-right font-medium">Akcia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {draftsQuery.data.draftLabs.map((lab) => (
                        <tr key={lab.id} className="hover:bg-muted/20">
                          <td className="py-2.5 px-3 font-medium">{lab.patientName}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {lab.analyzerType} {lab.sampleId ? `(${lab.sampleId})` : ""}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-amber-700 font-semibold">{lab.abnormalCount} abnormálnych</span>
                            {lab.criticalCount > 0 && (
                              <span className="ml-1.5 font-mono text-rose-700 font-bold">({lab.criticalCount} kritických!)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-300">
                              {lab.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Link
                              href="/lab-results"
                              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline text-xs"
                            >
                              Skontrolovať <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── SECTION 3: Prehľad potlačenej komunikácie (GDPR Čl. 22 / Sympathy Gate) ── */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareOff className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t("admin.pilot.suppressionTitle", "Prehľad potlačenej komunikácie (GDPR Čl. 22 / Sympathy Gate)")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t(
                  "admin.pilot.suppressionSubtitle",
                  "Správy zablokované bezpečnostnými a etickými filtrami (úhyn pacienta, chýbajúci súhlas, frekvenčný limit)."
                )}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {suppressionQuery.data?.length ?? 0} potlačených
          </Badge>
        </div>

        {suppressionQuery.isLoading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Načítavam potlačenú komunikáciu...
          </div>
        ) : !suppressionQuery.data || suppressionQuery.data.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground text-center">
            Žiadne automatické správy neboli pre zvolený deň potlačené.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground text-left border-b border-border">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Príjemca (Klient / Pacient)</th>
                  <th className="py-2.5 px-3 font-medium">Dôvod potlačenia</th>
                  <th className="py-2.5 px-3 font-medium">Blokovaná akcia</th>
                  <th className="py-2.5 px-3 font-medium">Kanál</th>
                  <th className="py-2.5 px-3 font-medium">Čas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {suppressionQuery.data.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="py-2 px-3 font-medium">
                      {item.clientName}
                      {item.patientName && (
                        <span className="text-muted-foreground ml-1">({item.patientName})</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        item.suppressionReason === "deceased_patient"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                          : item.suppressionReason === "no_consent"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {item.suppressionReason}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-muted-foreground">{item.blockedAction}</td>
                    <td className="py-2 px-3 uppercase font-mono text-[10px]">{item.channelAttempted || "SMS"}</td>
                    <td className="py-2 px-3 font-mono text-muted-foreground">
                      {item.blockedAt ? new Date(item.blockedAt).toLocaleTimeString("sk-SK") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── SECTION 4: Pilot Incident & Discrepancy Logger (1-klik spätná väzba) ── */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t("admin.pilot.discrepanciesTitle", "Evidencia nezrovnalostí s VetSoftware v2")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t(
                  "admin.pilot.discrepanciesSubtitle",
                  "1-klik spätná väzba personálu na zaznamenanie akéhokoľvek nesúladu medzi systémami počas shadow prevádzky."
                )}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setReportModalOpen(true)}
            className="gap-1.5 h-8 text-xs bg-primary text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("admin.pilot.newReport", "Zaznamenať rozdiel")}
          </Button>
        </div>

        {discrepanciesQuery.isLoading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Načítavam nahlásené rozdiely...
          </div>
        ) : !discrepanciesQuery.data || discrepanciesQuery.data.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground text-center">
            Zatiaľ neboli zaevidované žiadne nezrovnalosti s VetSoftware v2.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground text-left border-b border-border">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Závažnosť</th>
                  <th className="py-2.5 px-3 font-medium">Dátum</th>
                  <th className="py-2.5 px-3 font-medium">Modul</th>
                  <th className="py-2.5 px-3 font-medium">Referencia VetSoftware v2</th>
                  <th className="py-2.5 px-3 font-medium">Popis rozdielu</th>
                  <th className="py-2.5 px-3 font-medium">Nahlásil</th>
                  <th className="py-2.5 px-3 font-medium">Stav</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {discrepanciesQuery.data.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        item.severity === "critical"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                          : item.severity === "medium"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          : "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                      }`}>
                        {item.severity}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-muted-foreground">
                      {item.incidentDate ? new Date(item.incidentDate).toLocaleDateString("sk-SK") : "—"}
                    </td>
                    <td className="py-2 px-3 font-medium capitalize">{item.moduleWorkflow}</td>
                    <td className="py-2 px-3 font-mono text-muted-foreground">{item.vetSoftwareReference || "—"}</td>
                    <td className="py-2 px-3 max-w-sm">{item.description}</td>
                    <td className="py-2 px-3 text-muted-foreground">{item.reportedByName || "Personál"}</td>
                    <td className="py-2 px-3">
                      <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                        {item.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── DIALOG: Nahlásiť nezrovnalosť s VetSoftware v2 ── */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              {t("admin.pilot.modalTitle", "Nahlásiť nezrovnalosť s VetSoftware v2")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "admin.pilot.modalDesc",
                "Zaznamenajte akýkoľvek rozdiel vo výpočte, chýbajúci záznam alebo nesúlad s dosluhujúcim systémom."
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDiscrepancy} className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold" htmlFor="incidentDate">
                  Dátum zistenia *
                </label>
                <Input
                  id="incidentDate"
                  type="date"
                  value={discrepancyForm.incidentDate}
                  onChange={(e) =>
                    setDiscrepancyForm((prev) => ({ ...prev, incidentDate: e.target.value }))
                  }
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold" htmlFor="moduleWorkflow">
                  Modul / Workflow *
                </label>
                <select
                  id="moduleWorkflow"
                  value={discrepancyForm.moduleWorkflow}
                  onChange={(e) =>
                    setDiscrepancyForm((prev) => ({ ...prev, moduleWorkflow: e.target.value }))
                  }
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="clients_patients">Klienti & Pacienti</option>
                  <option value="clinical">Klinické záznamy & SOAP</option>
                  <option value="billing_ekasa">Faktúry & e-Kasa</option>
                  <option value="inventory">Sklad & Dodacie listy</option>
                  <option value="marketing_sms">SMS & Pripomienky</option>
                  <option value="other">Iný modul</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold" htmlFor="vetSoftwareRef">
                Identifikátor vo VetSoftware v2
              </label>
              <Input
                id="vetSoftwareRef"
                placeholder="Napr. Karta č. 1402, Faktúra 2026-081, Čip 941000..."
                value={discrepancyForm.vetSoftwareReference}
                onChange={(e) =>
                  setDiscrepancyForm((prev) => ({ ...prev, vetSoftwareReference: e.target.value }))
                }
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold" htmlFor="desc">
                Popis rozdielu / nezrovnalosti *
              </label>
              <Textarea
                id="desc"
                rows={3}
                placeholder="Podrobne popíšte, v čom sa údaje vo VetSoftware v2 a OpenVPM AI líšia..."
                value={discrepancyForm.description}
                onChange={(e) =>
                  setDiscrepancyForm((prev) => ({ ...prev, description: e.target.value }))
                }
                className="mt-1 text-xs"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold">Závažnosť *</label>
              <div className="mt-1.5 flex gap-2">
                {[
                  { id: "low", label: "Nízka (kozmetická)" },
                  { id: "medium", label: "Stredná (odchýlka)" },
                  { id: "critical", label: "Kritická (blokuje ošetrenie/účtovníctvo)" },
                ].map((s) => (
                  <label
                    key={s.id}
                    className={`flex-1 flex items-center justify-center p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                      discrepancyForm.severity === s.id
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "border-border hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      name="severity"
                      value={s.id}
                      checked={discrepancyForm.severity === s.id}
                      onChange={() =>
                        setDiscrepancyForm((prev) => ({ ...prev, severity: s.id as any }))
                      }
                      className="sr-only"
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReportModalOpen(false)}
                disabled={reportMutation.isPending}
              >
                Zrušiť
              </Button>
              <Button type="submit" size="sm" disabled={reportMutation.isPending}>
                {reportMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Ukladám...
                  </>
                ) : (
                  "Zaznamenať nezrovnalosť"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
