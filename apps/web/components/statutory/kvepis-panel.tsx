"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Globe,
  FileCheck2,
  FileText,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building,
  RefreshCw,
  Plus,
  Loader2,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/locale/format";
import { toast } from "sonner";

/**
 * Legal submission lifecycle collapsed into the three states the practice
 * actually works with: already filed, waiting for export/signature, or failed.
 */
const SEND_STATE_BUCKETS: Record<string, string[]> = {
  sent: ["SUBMITTED", "ACKNOWLEDGED"],
  awaiting: ["DRAFT", "VALIDATED", "SIGNED"],
  error: ["REJECTED"],
};

type SendStateFilter = "sent" | "awaiting" | "error" | undefined;

function dayKey(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function KvepisPanel() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [sendState, setSendState] = useState<SendStateFilter>();
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [receiptInput, setReceiptInput] = useState("");
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [signatureInput, setSignatureInput] = useState("");
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  const utils = trpc.useUtils();

  const { data: submissionsData, isLoading } = trpc.extensions.kvepis.listSubmissions.useQuery({
    status: statusFilter as any,
  });
  /**
   * Send-state + reporting-date narrowing happens client-side because the
   * list endpoint filters on a single lifecycle status, while the register
   * needs the three operator-facing buckets combined with a date window.
   */
  const submissions = useMemo(() => {
    const items = submissionsData?.items ?? [];
    return items.filter((sub) => {
      if (sendState && !SEND_STATE_BUCKETS[sendState]?.includes(sub.status)) {
        return false;
      }
      const reportedOn = dayKey(sub.createdAt) ?? dayKey(sub.submittedAt);
      if (reportFrom && (!reportedOn || reportedOn < reportFrom)) return false;
      if (reportTo && (!reportedOn || reportedOn > reportTo)) return false;
      return true;
    });
  }, [submissionsData?.items, sendState, reportFrom, reportTo]);

  const { data: credentials } = trpc.extensions.kvepis.getCredentials.useQuery();

  /**
   * XML sa negeneruje na serveri pri každom čítaní zoznamu — vyžiada sa až
   * pri kliku na „XML", aby register neposielal veľké payloady naprázdno.
   */
  const buildExportMutation = trpc.extensions.kvepis.validateAndBuild.useMutation({
    onError: (err: { message: string }) => {
      toast.error(err.message);
    },
  });

  const recordReceiptMutation = trpc.extensions.kvepis.recordReceipt.useMutation({
    onSuccess: () => {
      toast.success(t("statutory.kvepis.receiptSaved", "Doručenka z ÚPVS/KVEPIS úspešne zaznamenaná."));
      utils.extensions.kvepis.listSubmissions.invalidate();
      setShowReceiptModal(false);
      setReceiptInput("");
    },
    onError: (err: { message: string }) => {
      toast.error(err.message);
    },
  });

  const recordSignatureMutation = trpc.extensions.kvepis.recordSignature.useMutation({
    onSuccess: () => {
      toast.success(t("statutory.kvepis.signatureSaved", "Elektronický podpis (KEP) bol zaznamenaný."));
      utils.extensions.kvepis.listSubmissions.invalidate();
      setShowSignatureModal(false);
      setSignatureInput("");
    },
    onError: (err: { message: string }) => {
      toast.error(err.message);
    },
  });

  const downloadXml = (submissionRef: string, xmlContent?: string | null) => {
    if (!xmlContent) {
      toast.error(
        t("statutory.kvepis.xmlUnavailable", "The XML form is not available.")
      );
      return;
    }
    const blob = new Blob([xmlContent], { type: "application/xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${submissionRef}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(t("statutory.kvepis.xmlDownloaded", "XML stiahnuté pre podpis v D.Signer."));
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "ACKNOWLEDGED":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t("statutory.kvepis.statusAcknowledged", "Potvrdené ŠVPS")}
          </Badge>
        );
      case "SUBMITTED":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 gap-1">
            <Clock className="h-3 w-3" />
            {t("statutory.kvepis.statusSubmitted", "Odoslané")}
          </Badge>
        );
      case "SIGNED":
        return (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 gap-1">
            <ShieldCheck className="h-3 w-3" />
            {t("statutory.kvepis.statusSigned", "Podpísané KEP")}
          </Badge>
        );
      case "VALIDATED":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1">
            <FileCheck2 className="h-3 w-3" />
            {t("statutory.kvepis.statusValidated", "Platné na podpis")}
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 gap-1">
            <AlertTriangle className="h-3 w-3" />
            {t("statutory.kvepis.statusRejected", "Odmietnuté")}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground gap-1">
            <FileText className="h-3 w-3" />
            {t("statutory.kvepis.statusDraft", "Rozpracované")}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Informačný banner KVEPIS & ÚPVS */}
      <div className="flex flex-col gap-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-blue-500/10 p-2.5 text-blue-600">
            <Globe className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-semibold text-foreground">
                {t("statutory.kvepis.title", "KVEPIS & ÚPVS Submission Hub (ŠVPS SR)")}
              </h3>
              <Badge variant="outline" className="text-xs">
                Zákon č. 39/2007 Z. z.
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                "statutory.kvepis.desc",
                "Riadené elektronické podania na Štátnu veterinárnu a potravinovú správu SR: Kniha besnoty, kniha ošetrení hospodárskych zvierat a sprievodné doklady."
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/statutory/kvepis">
            <Button size="sm" className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              {t("statutory.kvepis.hubBtn", "KVEPIS Hub")}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.open("https://svps.sk/kvepis/", "_blank")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("statutory.kvepis.portalBtn", "Portál ŠVPS")}
          </Button>
        </div>
      </div>

      {/* Stav registračných údajov kliniky */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-3.5">
          <span className="text-xs text-muted-foreground">{t("statutory.kvepis.clinicIco", "IČO Ambulancie")}</span>
          <p className="mt-1 font-mono text-sm font-semibold">{credentials?.ico || "—"}</p>
        </div>
        <div className="rounded-lg border bg-card p-3.5">
          <span className="text-xs text-muted-foreground">{t("statutory.kvepis.upvsMailbox", "ÚPVS Schránka")}</span>
          <p className="mt-1 font-mono text-sm font-semibold">{credentials?.upvsSchranka || "SK-UPVS-DEFAULT"}</p>
        </div>
        <div className="rounded-lg border bg-card p-3.5">
          <span className="text-xs text-muted-foreground">{t("statutory.kvepis.kvlNumber", "Číslo KVL SR")}</span>
          <p className="mt-1 font-mono text-sm font-semibold">{credentials?.kvlId || "—"}</p>
        </div>
        <div className="rounded-lg border bg-card p-3.5">
          <span className="text-xs text-muted-foreground">{t("statutory.kvepis.integrationMode", "Režim integrácie")}</span>
          <div className="mt-1">
            <Badge variant="outline" className={credentials?.isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}>
              {credentials?.integrationMode === "B2G" ? t("statutory.kvepis.directB2g", "Priame B2G / ÚPVS") : t("statutory.kvepis.guidedSubmission", "Asistované podanie (GUIDED)")}
            </Badge>
          </div>
        </div>
      </div>

      {/* Filtre: stav odoslania + dátum hlásenia */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/40 p-1 text-xs">
          {[
            { id: undefined, label: t("statutory.kvepis.sendStateAll", "Všetky stavy") },
            { id: "sent", label: t("statutory.kvepis.sendStateSent", "Odoslané") },
            { id: "awaiting", label: t("statutory.kvepis.sendStateAwaiting", "Čaká na export") },
            { id: "error", label: t("statutory.kvepis.sendStateError", "Chyba") },
          ].map((f) => (
            <button
              key={f.id ?? "all"}
              onClick={() => setSendState(f.id as SendStateFilter)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                sendState === f.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border bg-muted/40 p-1 text-xs">
            {[
              { id: undefined, label: t("statutory.kvepis.filterAll", "Všetky podania") },
              { id: "VALIDATED", label: t("statutory.kvepis.filterReadyToSign", "Pripravené na podpis") },
              { id: "SIGNED", label: t("statutory.kvepis.filterSigned", "Podpísané") },
              { id: "ACKNOWLEDGED", label: t("statutory.kvepis.filterAcknowledged", "Potvrdené doručenkou") },
              { id: "DRAFT", label: t("statutory.kvepis.filterDraft", "Chybné / Rozpracované") },
            ].map((f) => (
              <button
                key={f.id ?? "all"}
                onClick={() => setStatusFilter(f.id)}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  statusFilter === f.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <span>{t("statutory.kvepis.reportDateFrom", "Dátum hlásenia od")}</span>
            <DatePicker
              value={reportFrom}
              onChange={(val) => setReportFrom(val)}
              className="h-9 w-36 text-xs"
            />
            <span>{t("statutory.kvepis.reportDateTo", "do")}</span>
            <DatePicker
              value={reportTo}
              onChange={(val) => setReportTo(val)}
              className="h-9 w-36 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Tabuľka / Zoznam podaní */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          {t("statutory.kvepis.loading", "Načítavam KVEPIS podania...")}
        </div>
      ) : !submissions || submissions.length === 0 ? (
        <EmptyState
          icon={Globe}
          title={t("statutory.kvepis.emptyTitle", "Žiadne KVEPIS podania")}
          description={t("statutory.kvepis.emptyDesc", "Neevidujete žiadne čakajúce ani odoslané podania na ŠVPS SR pre zvolený filter.")}
          action={{
            label: t("statutory.kvepis.emptyCta", "Vytvoriť export KVEPIS"),
            onClick: () => router.push("/statutory/kvepis"),
            icon: Plus,
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("statutory.kvepis.colReportDate", "Dátum hlásenia")}</TableHead>
                <TableHead>{t("statutory.kvepis.colRef", "Ref. číslo")}</TableHead>
                <TableHead>{t("statutory.kvepis.colType", "Typ podania")}</TableHead>
                <TableHead>{t("statutory.kvepis.colPatient", "Pacient & Majiteľ")}</TableHead>
                <TableHead>{t("statutory.kvepis.colSendState", "Stav odoslania")}</TableHead>
                <TableHead>{t("statutory.kvepis.colStatus", "Stav")}</TableHead>
                <TableHead>{t("statutory.kvepis.colReceipt", "Doručenka / KEP")}</TableHead>
                <TableHead className="text-right">{t("statutory.kvepis.colActions", "Akcie")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="px-3 py-2.5 whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {formatDate(sub.createdAt ?? sub.submittedAt ?? "", "SK", locale)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 font-mono text-xs font-medium">
                    {sub.referenceNumber}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-xs">
                    {sub.submissionType === "rabies_notification"
                      ? t("statutory.kvepis.typeRabies", "Vakcinácia besnota (RVPS)")
                      : sub.submissionType === "treatment_diary_batch"
                        ? t("statutory.kvepis.typeTreatment", "Kniha ošetrení (Farma)")
                        : sub.submissionType === "infectious_disease_alert"
                          ? t("statutory.kvepis.typeInfectious", "Hlásenie infekčného ochorenia")
                          : t("statutory.kvepis.typeMovement", "Premiestnenie zvierat")}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="text-sm font-medium">{sub.patientName || "—"}</div>
                    <div className="text-xs text-muted-foreground">{sub.species || sub.farmIco || ""}</div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    {SEND_STATE_BUCKETS.sent.includes(sub.status) ? (
                      <Badge variant="outline" className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        {t("statutory.kvepis.sendStateSent", "Odoslané")}
                      </Badge>
                    ) : SEND_STATE_BUCKETS.awaiting.includes(sub.status) ? (
                      <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                        <Clock className="h-3 w-3" />
                        {t("statutory.kvepis.sendStateAwaiting", "Čaká na export")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300">
                        <AlertTriangle className="h-3 w-3" />
                        {t("statutory.kvepis.sendStateError", "Chyba")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">{statusBadge(sub.status)}</TableCell>
                  <TableCell className="px-3 py-2.5">
                    {sub.receiptReceivedAt ? (
                      <span className="font-mono text-xs text-emerald-600">
                        {formatDate(sub.receiptReceivedAt, "SK", locale)}
                      </span>
                    ) : sub.payloadHash ? (
                      <span className="font-mono text-xs text-violet-600">
                        KEP: {sub.payloadHash.substring(0, 10)}...
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 space-x-2 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      disabled={buildExportMutation.isPending}
                      onClick={() =>
                        buildExportMutation.mutate(
                          { submissionId: sub.id },
                          {
                            onSuccess: (res) => {
                              if (res.valid && res.payload?.xml) {
                                downloadXml(sub.referenceNumber, res.payload.xml);
                              } else {
                                toast.error(
                                  t(
                                    "statutory.kvepis.xmlInvalid",
                                    "Podanie nie je validné – XML sa nedá vygenerovať."
                                  )
                                );
                              }
                            },
                          }
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" />
                      XML
                    </Button>
                    {sub.status === "VALIDATED" && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={() => {
                          setSelectedSubmissionId(sub.id);
                          setShowSignatureModal(true);
                        }}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {t("statutory.kvepis.btnSign", "Podpísať")}
                      </Button>
                    )}
                    {sub.status === "SIGNED" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={() => {
                          setSelectedSubmissionId(sub.id);
                          setShowReceiptModal(true);
                        }}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {t("statutory.kvepis.btnReceipt", "Doručenka")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modálne okno pre zadanie doručenky z ÚPVS */}
      <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-base">
              {t("statutory.kvepis.receiptModalTitle", "Evidencia doručenky z ÚPVS / KVEPIS")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("statutory.kvepis.receiptModalDesc", "Zadajte evidenčné číslo doručenky potvrdzujúcej prevzatie podania ŠVPS SR.")}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-xs font-medium">
              {t("statutory.kvepis.receiptModalLabel", "Číslo potvrdenia / Doručenka *")}
            </label>
            <input
              type="text"
              value={receiptInput}
              onChange={(e) => setReceiptInput(e.target.value)}
              placeholder={t("statutory.kvepis.receiptModalPlaceholder", "napr. UPVS-ACK-2026-98124")}
              className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowReceiptModal(false)}>
              {t("common.cancel", "Zrušiť")}
            </Button>
            <Button
              disabled={!receiptInput.trim() || recordReceiptMutation.isPending}
              onClick={() => {
                if (selectedSubmissionId && receiptInput.trim()) {
                  recordReceiptMutation.mutate({
                    submissionId: selectedSubmissionId,
                    receiptReference: receiptInput.trim(),
                  });
                }
              }}
            >
              {t("statutory.kvepis.btnSaveReceipt", "Uložiť doručenku")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modálne okno pre evidenciu KEP podpisu */}
      <Dialog open={showSignatureModal} onOpenChange={setShowSignatureModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-base">
              {t("statutory.kvepis.signatureModalTitle", "Záznam kvalifikovaného elektronického podpisu (KEP)")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("statutory.kvepis.signatureModalDesc", "Po podpise XML v aplikácii D.Signer vložte kontrolný SHA-256 odtlačok podpísaného kontajnera.")}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-xs font-medium">
              {t("statutory.kvepis.signatureModalLabel", "Odtlačok podpisu (Hash) *")}
            </label>
            <input
              type="text"
              value={signatureInput}
              onChange={(e) => setSignatureInput(e.target.value)}
              placeholder={t("statutory.kvepis.signatureModalPlaceholder", "napr. 7a8f... (SHA-256 hex digest)")}
              className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowSignatureModal(false)}>
              {t("common.cancel", "Zrušiť")}
            </Button>
            <Button
              disabled={signatureInput.trim().length < 16 || recordSignatureMutation.isPending}
              onClick={() => {
                if (selectedSubmissionId && signatureInput.trim()) {
                  recordSignatureMutation.mutate({
                    submissionId: selectedSubmissionId,
                    signatureHash: signatureInput.trim(),
                  });
                }
              }}
            >
              {t("statutory.kvepis.btnConfirmSignature", "Potvrdiť KEP podpis")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
