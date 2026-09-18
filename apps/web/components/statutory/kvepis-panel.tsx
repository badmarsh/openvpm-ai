"use client";

import { useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "sonner";

export function KvepisPanel() {
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [receiptInput, setReceiptInput] = useState("");
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [signatureInput, setSignatureInput] = useState("");
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  const utils = trpc.useUtils();

  const { data: submissionsData, isLoading } = trpc.extensions.kvepis.listSubmissions.useQuery({
    status: statusFilter as any,
  });
  const submissions = submissionsData?.items ?? [];

  const { data: credentials } = trpc.extensions.kvepis.getCredentials.useQuery();

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
      toast.error("XML formulár nie je k dispozícii.");
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

      {/* Filter tabov */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/40 p-1 text-xs">
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
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="p-3">{t("statutory.kvepis.colRef", "Ref. číslo")}</th>
                <th className="p-3">{t("statutory.kvepis.colType", "Typ podania")}</th>
                <th className="p-3">{t("statutory.kvepis.colPatient", "Pacient & Majiteľ")}</th>
                <th className="p-3">{t("statutory.kvepis.colStatus", "Stav")}</th>
                <th className="p-3">{t("statutory.kvepis.colReceipt", "Doručenka / KEP")}</th>
                <th className="p-3 text-right">{t("statutory.kvepis.colActions", "Akcie")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {submissions.map((sub) => (
                <tr key={sub.id} className="hover:bg-muted/20">
                  <td className="p-3 font-mono font-medium">{sub.referenceNumber}</td>
                  <td className="p-3">
                    <span className="text-xs">
                      {sub.submissionType === "rabies_notification"
                        ? t("statutory.kvepis.typeRabies", "Vakcinácia besnota (RVPS)")
                        : sub.submissionType === "treatment_diary_batch"
                          ? t("statutory.kvepis.typeTreatment", "Kniha ošetrení (Farma)")
                          : t("statutory.kvepis.typeMovement", "Premiestnenie zvierat")}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{sub.patientName || "—"}</div>
                    <div className="text-xs text-muted-foreground">{sub.species || sub.farmIco || ""}</div>
                  </td>
                  <td className="p-3">{statusBadge(sub.status)}</td>
                  <td className="p-3">
                    {sub.receiptReceivedAt ? (
                      <span className="font-mono text-xs text-emerald-600">
                        {new Date(sub.receiptReceivedAt).toLocaleDateString("sk-SK")}
                      </span>
                    ) : sub.payloadHash ? (
                      <span className="font-mono text-xs text-purple-600">
                        KEP: {sub.payloadHash.substring(0, 10)}...
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => downloadXml(sub.referenceNumber)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      XML
                    </Button>
                    {sub.status === "VALIDATED" && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 gap-1"
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
                        className="h-8 gap-1"
                        onClick={() => {
                          setSelectedSubmissionId(sub.id);
                          setShowReceiptModal(true);
                        }}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {t("statutory.kvepis.btnReceipt", "Doručenka")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modálne okno pre zadanie doručenky z ÚPVS */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">{t("statutory.kvepis.receiptModalTitle", "Evidencia doručenky z ÚPVS / KVEPIS")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("statutory.kvepis.receiptModalDesc", "Zadajte evidenčné číslo doručenky potvrdzujúcej prevzatie podania ŠVPS SR.")}
            </p>
            <div className="mt-4">
              <label className="text-xs font-medium">{t("statutory.kvepis.receiptModalLabel", "Číslo potvrdenia / Doručenka *")}</label>
              <input
                type="text"
                value={receiptInput}
                onChange={(e) => setReceiptInput(e.target.value)}
                placeholder={t("statutory.kvepis.receiptModalPlaceholder", "napr. UPVS-ACK-2026-98124")}
                className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
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
            </div>
          </div>
        </div>
      )}

      {/* Modálne okno pre evidenciu KEP podpisu */}
      {showSignatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">{t("statutory.kvepis.signatureModalTitle", "Záznam kvalifikovaného elektronického podpisu (KEP)")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("statutory.kvepis.signatureModalDesc", "Po podpise XML v aplikácii D.Signer vložte kontrolný SHA-256 odtlačok podpísaného kontajnera.")}
            </p>
            <div className="mt-4">
              <label className="text-xs font-medium">{t("statutory.kvepis.signatureModalLabel", "Odtlačok podpisu (Hash) *")}</label>
              <input
                type="text"
                value={signatureInput}
                onChange={(e) => setSignatureInput(e.target.value)}
                placeholder={t("statutory.kvepis.signatureModalPlaceholder", "napr. 7a8f... (SHA-256 hex digest)")}
                className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
