"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  WifiOff,
  Send,
  Printer,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Download,
  FileSpreadsheet,
  Lock,
  CalendarDays,
  Coins,
  CreditCard,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type ReceiptStatus = "PENDING" | "SENT" | "CONFIRMED" | "FAILED" | "OFFLINE_STORED";
type ActiveTab = "receipts" | "closures" | "accountant";

const STATUS_CONFIG: Record<
  ReceiptStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  PENDING: {
    label: "Čaká",
    color: "bg-muted text-muted-foreground",
    icon: Clock,
  },
  SENT: {
    label: "Odoslané",
    color: "bg-info-muted text-info-muted-foreground",
    icon: Send,
  },
  CONFIRMED: {
    label: "Potvrdené",
    color: "bg-success-muted text-success-muted-foreground",
    icon: CheckCircle2,
  },
  FAILED: {
    label: "Chyba",
    color: "bg-destructive/10 text-destructive",
    icon: XCircle,
  },
  OFFLINE_STORED: {
    label: "Offline",
    color: "bg-warning-muted text-warning-muted-foreground",
    icon: WifiOff,
  },
};

const PAYMENT_LABEL: Record<string, string> = {
  CASH: "Hotovosť",
  CARD: "Karta",
  TRANSFER: "Prevod",
};

const VAT_LABEL: Record<string, string> = {
  ZERO: "0 %",
  REDUCED: "10 %",
  STANDARD: "20 %",
  REDUCED_5: "5 %",
  REDUCED_19: "19 %",
  STANDARD_23: "23 %",
};

const PAGE_SIZE = 20;

function EkasaReceiptsContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    tabParam === "closures" || tabParam === "accountant" ? tabParam : "receipts"
  );

  useEffect(() => {
    if (tabParam === "closures" || tabParam === "accountant" || tabParam === "receipts") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | undefined>();
  const [printingId, setPrintingId] = useState<string | null>(null);

  // Filter for accountant export
  const now = new Date();
  const [exportYear, setExportYear] = useState<number>(now.getFullYear());
  const [exportMonth, setExportMonth] = useState<number>(now.getMonth() + 1);

  const utils = trpc.useUtils();

  // Queries
  const {
    data: receipts,
    isLoading: isLoadingReceipts,
    refetch: refetchReceipts,
  } = trpc.ekasa.getReceipts.useQuery({
    limit: PAGE_SIZE,
    offset,
    status: statusFilter,
  });

  const {
    data: dailySummaryData,
    isLoading: isLoadingSummary,
    refetch: refetchSummary,
  } = trpc.ekasa.getDailyClosureSummary.useQuery(undefined, {
    enabled: activeTab === "closures",
  });

  const {
    data: closures,
    isLoading: isLoadingClosures,
    refetch: refetchClosures,
  } = trpc.ekasa.getDailyClosures.useQuery(undefined, {
    enabled: activeTab === "closures",
  });

  const {
    data: accountantData,
    isLoading: isLoadingAccountant,
    refetch: refetchAccountant,
  } = trpc.ekasa.getAccountantExport.useQuery(
    { year: exportYear, month: exportMonth },
    { enabled: activeTab === "accountant" }
  );

  // Mutations
  const retryMutation = trpc.ekasa.retryReceipt.useMutation({
    onSuccess: () => {
      toast.success("Doklad bol úspešne odoslaný");
      refetchReceipts();
    },
    onError: (err) => {
      toast.error(`Chyba pri odoslaní: ${err.message}`);
    },
  });

  const closureMutation = trpc.ekasa.performDailyClosure.useMutation({
    onSuccess: (res) => {
      toast.success(`Denná uzávierka ${res.closureNumber} bola úspešne vykonaná!`);
      refetchSummary();
      refetchClosures();
    },
    onError: (err) => {
      toast.error(`Chyba pri uzávierke: ${err.message}`);
    },
  });

  const handlePrint = async (receiptId: string) => {
    setPrintingId(receiptId);
    try {
      const result = await utils.ekasa.printReceipt.fetch({
        receiptId,
      });
      if (result?.html) {
        const win = window.open("", "_blank", "width=400,height=700");
        win?.document.write(result.html);
        win?.document.close();
        setTimeout(() => win?.print(), 500);
      }
    } finally {
      setPrintingId(null);
    }
  };

  const downloadCsv = () => {
    if (!accountantData?.csv) return;
    const blob = new Blob([accountantData.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `ekasa-uzavierky-${exportYear}-${exportMonth.toString().padStart(2, "0")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export pre účtovníčku bol stiahnutý");
  };

  const statuses: ReceiptStatus[] = [
    "CONFIRMED",
    "FAILED",
    "OFFLINE_STORED",
    "PENDING",
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">e-Kasa Pokladňa</h1>
            <p className="text-sm text-muted-foreground">
              Elektronická evidencia tržieb Finančnej správy SR (Zákon č. 289/2008 Z. z.)
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex rounded-lg border border-border bg-muted/30 p-1">
          <button
            onClick={() => setActiveTab("receipts")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === "receipts"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            Doklady
          </button>
          <button
            onClick={() => setActiveTab("closures")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === "closures"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            Denné uzávierky (Z-report)
          </button>
          <button
            onClick={() => setActiveTab("accountant")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === "accountant"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export pre účtovníctvo
          </button>
        </div>
      </div>

      {/* Pre-certification / Emulation Notice Banner */}
      <div className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="border-amber-500/50 bg-amber-500/20 text-amber-900 dark:text-amber-200 font-semibold shrink-0"
          >
            Režim pilotnej emulácie
          </Badge>
          <p className="text-xs text-amber-900 dark:text-amber-200">
            e-Kasa beží v predcertifikačnom režime (interná evidencia, výpočet DPH a tlač dokladov). Pre legislatívne záväzné fiškálne doklady pred FS SR je potrebné pripojenie k certifikovanému CHDÚ alebo fiškálnemu driveru (napr. FiskalPRO / Varos).
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DOKLADY                                                            */}
      {/* ========================================================================= */}
      {activeTab === "receipts" && (
        <div className="space-y-4">
          {/* Status filter badges & Refresh */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setStatusFilter(undefined);
                  setOffset(0);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  !statusFilter
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                Všetky
              </button>
              {statuses.map((s) => {
                const cfg = STATUS_CONFIG[s];
                const Icon = cfg.icon;
                return (
                  <button
                    key={s}
                    onClick={() => {
                      setStatusFilter(s);
                      setOffset(0);
                    }}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      statusFilter === s
                        ? cfg.color + " ring-2 ring-offset-1 ring-current"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => refetchReceipts()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Obnoviť
            </button>
          </div>

          {/* Table */}
          <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
            {isLoadingReceipts ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !receipts || receipts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Receipt className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="font-medium text-muted-foreground">Žiadne doklady</p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  {statusFilter
                    ? `Žiadne doklady so statusom „${STATUS_CONFIG[statusFilter].label}“`
                    : "Doklady sa vytvárajú automaticky pri zaznamenaní platby"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {[
                        "Číslo dokladu",
                        "Dátum",
                        "Suma",
                        "DPH",
                        "Platba",
                        "Status",
                        "UID",
                        "Akcie",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {receipts.map((r) => {
                      const statusCfg =
                        STATUS_CONFIG[r.status as ReceiptStatus] ??
                        STATUS_CONFIG.PENDING;
                      const StatusIcon = statusCfg.icon;
                      const isPrintingThis = printingId === r.id;

                      return (
                        <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-mono font-medium text-xs">
                            {r.receiptNumber}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {r.issuedAt
                              ? new Date(r.issuedAt).toLocaleString("sk-SK", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })
                              : "—"}
                          </td>
                          <td className="px-4 py-3 font-semibold tabular-nums text-foreground">
                            {Number(r.amountTotal).toFixed(2)} €
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {VAT_LABEL[r.vatRate] ?? r.vatRate}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {PAYMENT_LABEL[r.paymentMethod] ?? r.paymentMethod}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.color}`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {statusCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground max-w-[120px] truncate">
                            {r.uid ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handlePrint(r.id)}
                                disabled={isPrintingThis}
                                title="Tlačiť doklad"
                                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors"
                              >
                                {isPrintingThis ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                Tlačiť
                              </button>

                              {(r.status === "FAILED" ||
                                r.status === "OFFLINE_STORED") && (
                                <button
                                  onClick={() => retryMutation.mutate({ receiptId: r.id })}
                                  disabled={retryMutation.isPending}
                                  title="Opakovať odoslanie"
                                  className="inline-flex items-center gap-1 rounded-md border border-warning-muted/50 bg-warning-muted/30 px-2 py-1 text-xs font-medium text-warning-muted-foreground hover:bg-warning-muted/50 disabled:opacity-50 transition-colors"
                                >
                                  <RefreshCw
                                    className={`h-3 w-3 ${
                                      retryMutation.isPending ? "animate-spin" : ""
                                    }`}
                                  />
                                  Odoslať
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {receipts && receipts.length > 0 && (
              <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
                <span>Zobrazené záznamy od {offset + 1}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
                    disabled={offset === 0}
                    className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-accent disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Predchádzajúce
                  </button>
                  <button
                    onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                    disabled={receipts.length < PAGE_SIZE}
                    className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-accent disabled:opacity-40 transition-colors"
                  >
                    Ďalšie
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DENNÉ UZÁVIERKY (Z-REPORT)                                          */}
      {/* ========================================================================= */}
      {activeTab === "closures" && (
        <div className="space-y-6">
          {/* Today's Status Banner Card */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    Dnešný deň ({dailySummaryData?.date ?? "Dnes"})
                  </h2>
                  {dailySummaryData?.isClosed ? (
                    <Badge className="bg-emerald-600">
                      Uzavreté: {dailySummaryData.closureNumber}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-400 text-amber-600 bg-amber-50">
                      Otvorený deň (priebežný stav)
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dailySummaryData?.isClosed
                    ? `Uzávierka bola vykonaná dňa ${new Date(
                        dailySummaryData.closedAt ?? ""
                      ).toLocaleTimeString("sk-SK")}`
                    : "Uzávierka sa automaticky vygeneruje o 23:59 alebo ju môžete spustiť manuálne."}
                </p>
              </div>

              {!dailySummaryData?.isClosed && (
                <Button
                  onClick={() => closureMutation.mutate({})}
                  disabled={closureMutation.isPending}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {closureMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  Vykonať dennú uzávierku (Z-report)
                </Button>
              )}
            </div>

            {/* Daily stats grid */}
            {isLoadingSummary ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : dailySummaryData?.summary ? (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <span className="text-xs text-muted-foreground">Celková tržba dňa</span>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {dailySummaryData.summary.totalAmount.toFixed(2)} €
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {dailySummaryData.summary.receiptsCount} dokladov
                  </span>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <span className="text-xs text-muted-foreground">V hotovosti</span>
                  <p className="mt-1 text-xl font-bold text-emerald-600">
                    {dailySummaryData.summary.cashAmount.toFixed(2)} €
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <span className="text-xs text-muted-foreground">Platobnou kartou</span>
                  <p className="mt-1 text-xl font-bold text-blue-600">
                    {dailySummaryData.summary.cardAmount.toFixed(2)} €
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <span className="text-xs text-muted-foreground">DPH 23 % (základ / daň)</span>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {dailySummaryData.summary.vatBreakdown.vat23.base.toFixed(2)} € /{" "}
                    <span className="text-emerald-600">
                      {dailySummaryData.summary.vatBreakdown.vat23.vat.toFixed(2)} €
                    </span>
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {/* Past Closures Table */}
          <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
            <div className="border-b border-border/60 px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">
                História denných uzávierok
              </h3>
            </div>

            {isLoadingClosures ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !closures || closures.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Zatiaľ neboli zaznamenané žiadne denné uzávierky.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {["Dátum", "Číslo Z-reportu", "Dokladov", "Hotovosť", "Karta", "Spolu", "Stav"].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {closures.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-xs">{c.date}</td>
                        <td className="px-4 py-3 font-mono text-xs">{c.closureNumber}</td>
                        <td className="px-4 py-3 text-xs">{c.receiptsCount}</td>
                        <td className="px-4 py-3 text-xs tabular-nums text-emerald-600 font-medium">
                          {Number(c.cashAmount).toFixed(2)} €
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums text-blue-600 font-medium">
                          {Number(c.cardAmount).toFixed(2)} €
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums font-bold text-foreground">
                          {Number(c.totalAmount).toFixed(2)} €
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="default" className="bg-emerald-600">
                            Uzavreté
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: EXPORT PRE ÚČTOVNÍCTVO                                              */}
      {/* ========================================================================= */}
      {activeTab === "accountant" && (
        <div className="space-y-6">
          {/* Controls: Month picker & Download buttons */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <select
                  value={exportMonth}
                  onChange={(e) => setExportMonth(Number(e.target.value))}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {[
                    "Január",
                    "Február",
                    "Marec",
                    "Apríl",
                    "Máj",
                    "Jún",
                    "Júl",
                    "August",
                    "September",
                    "Október",
                    "November",
                    "December",
                  ].map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  value={exportYear}
                  onChange={(e) => setExportYear(Number(e.target.value))}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {[2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              onClick={downloadCsv}
              disabled={isLoadingAccountant || !accountantData?.closures?.length}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Download className="h-4 w-4" />
              Stiahnuť CSV pre účtovníčku
            </Button>
          </div>

          {/* Monthly Totals Cards */}
          {isLoadingAccountant ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !accountantData || accountantData.closuresCount === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
              <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="font-medium">Pre zvolený mesiac zatiaľ nie sú evidované žiadne uzávierky.</p>
              <p className="mt-1 text-xs">
                Denné uzávierky sa automaticky zapisujú o 23:59 každého pracovného dňa.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                  <span className="text-xs text-muted-foreground">Celkové tržby za mesiac</span>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {accountantData.totals.totalAmount.toFixed(2)} €
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {accountantData.closuresCount} uzávierok / {accountantData.receiptsCount} bločkov
                  </span>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                  <span className="text-xs text-muted-foreground">Tržby v hotovosti</span>
                  <p className="mt-1 text-2xl font-bold text-emerald-600">
                    {accountantData.totals.cashAmount.toFixed(2)} €
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                  <span className="text-xs text-muted-foreground">Tržby platobnou kartou</span>
                  <p className="mt-1 text-2xl font-bold text-blue-600">
                    {accountantData.totals.cardAmount.toFixed(2)} €
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                  <span className="text-xs text-muted-foreground">Bankové prevody</span>
                  <p className="mt-1 text-2xl font-bold text-purple-600">
                    {accountantData.totals.transferAmount.toFixed(2)} €
                  </p>
                </div>
              </div>

              {/* VAT Breakdown Card */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-3">
                <h3 className="font-semibold text-sm text-foreground">
                  Rozpad sadzieb DPH pre daňové priznanie (SR)
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <span className="font-medium text-foreground">Základná sadzba 23 %</span>
                    <p className="mt-1">Základ: <strong>{accountantData.totals.vat23.base.toFixed(2)} €</strong></p>
                    <p>DPH: <strong className="text-emerald-600">{accountantData.totals.vat23.vat.toFixed(2)} €</strong></p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <span className="font-medium text-foreground">Znížená sadzba 19 %</span>
                    <p className="mt-1">Základ: <strong>{accountantData.totals.vat19.base.toFixed(2)} €</strong></p>
                    <p>DPH: <strong className="text-emerald-600">{accountantData.totals.vat19.vat.toFixed(2)} €</strong></p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <span className="font-medium text-foreground">Znížená sadzba 5 %</span>
                    <p className="mt-1">Základ: <strong>{accountantData.totals.vat5.base.toFixed(2)} €</strong></p>
                    <p>DPH: <strong className="text-emerald-600">{accountantData.totals.vat5.vat.toFixed(2)} €</strong></p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <span className="font-medium text-foreground">Oslobodené od DPH 0 %</span>
                    <p className="mt-1">Základ: <strong>{accountantData.totals.vat0.base.toFixed(2)} €</strong></p>
                    <p>DPH: <strong>0.00 €</strong></p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function EkasaReceiptsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <EkasaReceiptsContent />
    </Suspense>
  );
}
