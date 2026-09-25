"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  ReceiptEuro,
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
  Ban,
  Banknote,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { StatusPulseBadge, type StatusPulseVariant } from "@/components/ui/status-pulse-badge";
import { EkasaReceiptsSkeleton } from "@/components/ui/content-skeletons";
import { ThermalReceiptDrawer } from "@/components/ekasa/thermal-receipt-drawer";
import { IntegrationModeBanner } from "@/components/common/integration-mode-banner";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader, PageSectionHeader } from "@/components/layout/page-header";
import {
  DataTableFrame,
  KpiCard,
  KpiGrid,
  PageToolbar,
  filterControlClass,
  pageShellClass,
  underlineTabsListClass,
  underlineTabsTriggerClass,
} from "@/components/layout/page-kit";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import { useCurrencyFormatter } from "@/lib/locale/useCurrency";
import { formatDate, formatDateTime } from "@/lib/locale/format";

type ReceiptStatus = "PENDING" | "SENT" | "CONFIRMED" | "FAILED" | "OFFLINE_STORED";
type ActiveTab = "receipts" | "closures" | "accountant";

/** Fiscal verification vocabulary surfaced to the operator. */
type VerificationState = "valid" | "offline" | "pending" | "failed" | "storno";

const STATUS_CONFIG: Record<
  ReceiptStatus,
  { color: string; icon: React.ElementType }
> = {
  PENDING: {
    color: "bg-muted text-muted-foreground",
    icon: Clock,
  },
  SENT: {
    color: "bg-info-muted text-info-muted-foreground",
    icon: Send,
  },
  CONFIRMED: {
    color: "bg-success-muted text-success-muted-foreground",
    icon: CheckCircle2,
  },
  FAILED: {
    color: "bg-destructive/10 text-destructive",
    icon: XCircle,
  },
  OFFLINE_STORED: {
    color: "bg-warning-muted text-warning-muted-foreground",
    icon: WifiOff,
  },
};

const VERIFICATION_VARIANT: Record<VerificationState, StatusPulseVariant> = {
  valid: "confirmed",
  offline: "offline",
  pending: "pending",
  failed: "failed",
  storno: "failed",
};

function verificationStateOf(receipt: {
  status: ReceiptStatus;
  receiptType?: string | null;
}): VerificationState {
  if (receipt.receiptType === "STORNO") return "storno";
  switch (receipt.status) {
    case "CONFIRMED":
      return "valid";
    case "OFFLINE_STORED":
      return "offline";
    case "FAILED":
      return "failed";
    default:
      return "pending";
  }
}

const PAYMENT_LABEL: Record<string, { key: string; fallback: string }> = {
  CASH: { key: "ekasa.paymentCash", fallback: "Cash" },
  CARD: { key: "ekasa.paymentCard", fallback: "Card" },
  TRANSFER: { key: "ekasa.paymentTransfer", fallback: "Transfer" },
};

function paymentMethodLabel(
  t: (key: string, fallback?: string) => string,
  method: string
): string {
  const entry = PAYMENT_LABEL[method];
  return entry ? t(entry.key, entry.fallback) : method;
}

const VAT_LABEL: Record<string, string> = {
  ZERO: "0 %",
  REDUCED: "10 %",
  STANDARD: "20 %",
  REDUCED_5: "5 %",
  REDUCED_19: "19 %",
  STANDARD_23: "23 %",
};

/** Month labels follow the active UI language (never a fixed `sk-SK` string). */
const MONTH_KEYS = [
  "ekasa.page.months.january",
  "ekasa.page.months.february",
  "ekasa.page.months.march",
  "ekasa.page.months.april",
  "ekasa.page.months.may",
  "ekasa.page.months.june",
  "ekasa.page.months.july",
  "ekasa.page.months.august",
  "ekasa.page.months.september",
  "ekasa.page.months.october",
  "ekasa.page.months.november",
  "ekasa.page.months.december",
];

const MONTH_FALLBACKS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const PAGE_SIZE = 20;

function EkasaReceiptsContent() {
  const { t, locale } = useI18n();
  const formatAmount = useCurrencyFormatter();
  const router = useRouter();
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
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [stornoTarget, setStornoTarget] = useState<any | null>(null);
  const [stornoReason, setStornoReason] = useState("");

  // Filter for accountant export
  const now = new Date();
  const [exportYear, setExportYear] = useState<number>(now.getFullYear());
  const [exportMonth, setExportMonth] = useState<number>(now.getMonth() + 1);

  const utils = trpc.useUtils();
  const { data: ekasaConfig } = trpc.extensions.ekasa.getConfig.useQuery();

  // Queries
  const {
    data: receipts,
    isLoading: isLoadingReceipts,
    refetch: refetchReceipts,
  } = trpc.extensions.ekasa.getReceipts.useQuery({
    limit: PAGE_SIZE,
    offset,
    status: statusFilter,
  });

  const {
    data: dailySummaryData,
    isLoading: isLoadingSummary,
    refetch: refetchSummary,
  } = trpc.extensions.ekasa.getDailyClosureSummary.useQuery(undefined, {
    enabled: activeTab === "closures",
  });

  const {
    data: closures,
    isLoading: isLoadingClosures,
    refetch: refetchClosures,
  } = trpc.extensions.ekasa.getDailyClosures.useQuery(undefined, {
    enabled: activeTab === "closures",
  });

  const {
    data: accountantData,
    isLoading: isLoadingAccountant,
    refetch: refetchAccountant,
  } = trpc.extensions.ekasa.getAccountantExport.useQuery(
    { year: exportYear, month: exportMonth },
    { enabled: activeTab === "accountant" }
  );

  // Mutations
  const retryMutation = trpc.extensions.ekasa.retryReceipt.useMutation({
    onSuccess: () => {
      toast.success(t("ekasa.page.toast.resent", "Doklad bol úspešne odoslaný"));
      refetchReceipts();
    },
    onError: (err) => {
      toast.error(t("ekasa.page.toast.resendError", "Chyba pri odoslaní: {message}", { message: err.message }));
    },
  });

  const stornoMutation = trpc.extensions.ekasa.stornoReceipt.useMutation({
    onSuccess: () => {
      toast.success(t("ekasa.page.toast.stornoOk", "Doklad bol úspešne stornovaný"));
      setStornoTarget(null);
      setStornoReason("");
      setSelectedReceipt(null);
      refetchReceipts();
    },
    onError: (err) => {
      toast.error(t("ekasa.page.toast.stornoError", "Chyba pri storne: {message}", { message: err.message }));
    },
  });

  const closureMutation = trpc.extensions.ekasa.performDailyClosure.useMutation({
    onSuccess: (res) => {
      toast.success(
        t("ekasa.page.toast.closureOk", "Denná uzávierka {number} bola úspešne vykonaná!", {
          number: res.closureNumber,
        }),
      );
      refetchSummary();
      refetchClosures();
    },
    onError: (err) => {
      toast.error(t("ekasa.page.toast.closureError", "Chyba pri uzávierke: {message}", { message: err.message }));
    },
  });

  const handlePrint = async (receiptId: string) => {
    setPrintingId(receiptId);
    try {
      const result = await utils.extensions.ekasa.printReceipt.fetch({
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
    toast.success(t("ekasa.page.toast.csvDownloaded", "CSV export pre účtovníčku bol stiahnutý"));
  };

  const statuses: ReceiptStatus[] = [
    "CONFIRMED",
    "FAILED",
    "OFFLINE_STORED",
    "PENDING",
  ];

  return (
    <div className={pageShellClass}>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand shrink-0">
              <ReceiptEuro className="h-5 w-5" />
            </span>
            <span className="flex items-center gap-2.5 flex-wrap">
              <span>{t("ekasa.page.title", "e-Kasa Pokladňa")}</span>
              <IntegrationModeBanner module="ekasa" size="sm" />
            </span>
          </span>
        }
        subtitle={t(
          "ekasa.page.subtitle",
          "Elektronická evidencia tržieb Finančnej správy SR (Zákon č. 289/2008 Z. z.)",
        )}
        actions={
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as ActiveTab)}
          >
            <TabsList className={underlineTabsListClass}>
              <TabsTrigger value="receipts" className={underlineTabsTriggerClass}>
                <ReceiptEuro className="h-4 w-4" />
                {t("ekasa.page.tabs.receipts", "Doklady")}
              </TabsTrigger>
              <TabsTrigger value="closures" className={underlineTabsTriggerClass}>
                <Lock className="h-4 w-4" />
                {t("ekasa.page.tabs.closures", "Uzávierky")}
              </TabsTrigger>
              <TabsTrigger value="accountant" className={underlineTabsTriggerClass}>
                <FileSpreadsheet className="h-4 w-4" />
                {t("ekasa.page.tabs.accountant", "Pre účtovníka")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {/* Pre-certification / Emulation Notice Banner */}
      <div className="flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Badge
            variant="warning"
            className="font-semibold shrink-0"
          >
            {t("ekasa.page.pilotBadge", "Režim pilotnej emulácie")}
          </Badge>
          <p className="text-xs text-warning-muted-foreground">
            {t(
              "ekasa.page.pilotNotice",
              "e-Kasa beží v predcertifikačnom režime (interná evidencia, výpočet DPH a tlač dokladov). Pre legislatívne záväzné fiškálne doklady pred FS SR je potrebné pripojenie k certifikovanému CHDÚ alebo fiškálnemu driveru (napr. FiskalPRO / Varos).",
            )}
          </p>
        </div>
      </div>

      {/* Quick Action: Denná uzávierka */}
      {activeTab === "receipts" && (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <Lock className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">
                {t("ekasa.page.dailyClosure.title", "Denná uzávierka")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(
                  "ekasa.page.dailyClosure.desc",
                  "Zatvorte pokladňu a vygenerujte Z-report pre dnešný deň",
                )}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setActiveTab("closures")}
            className="shrink-0"
          >
            {t("ekasa.page.dailyClosure.cta", "Prejsť na uzávierky")}
          </Button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: DOKLADY                                                            */}
      {/* ========================================================================= */}
      {activeTab === "receipts" && (
        <div className="space-y-4">
          <PageSectionHeader
            title={t("ekasa.page.receipts.title", "Pokladničné doklady")}
            subtitle={t(
              "ekasa.page.receipts.subtitle",
              "Prehľad fiškálnych dokladov a stavu ich overenia voči Finančnej správe SR.",
            )}
          />

          {/* Verifikácia dokladov */}
          <PageToolbar className="sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={!statusFilter ? "default" : "outline"}
                size="sm"
                className="h-7 gap-1.5 rounded-full px-3 text-xs"
                onClick={() => {
                  setStatusFilter(undefined);
                  setOffset(0);
                }}
              >
                {t("ekasa.page.receipts.filterAll", "Všetky")}
              </Button>
              {statuses.map((s) => {
                const cfg = STATUS_CONFIG[s];
                const Icon = cfg.icon;
                return (
                  <Button
                    key={s}
                    variant={statusFilter === s ? "default" : "outline"}
                    size="sm"
                    className="h-7 gap-1.5 rounded-full px-3 text-xs"
                    onClick={() => {
                      setStatusFilter(s);
                      setOffset(0);
                    }}
                  >
                    <Icon className="h-3 w-3" />
                    {t(`ekasa.page.status.${s}`, s)}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchReceipts()}
              className="h-8 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t("ekasa.page.receipts.refresh", "Obnoviť")}
            </Button>
          </PageToolbar>

          {/* Table */}
          <DataTableFrame>
            {isLoadingReceipts ? (
              <div className="p-4">
                <EkasaReceiptsSkeleton />
              </div>
            ) : !receipts || receipts.length === 0 ? (
              <EmptyState
                className="border-0 bg-transparent"
                icon={ReceiptEuro}
                title={
                  statusFilter
                    ? t("ekasa.page.receipts.emptyFilteredTitle", "Žiadne doklady v tomto stave")
                    : t("ekasa.page.receipts.emptyTitle", "Žiadne pokladničné doklady")
                }
                description={
                  statusFilter
                    ? t(
                        "ekasa.page.receipts.emptyFilteredDesc",
                        "Pre zvolený stav overenia neexistujú žiadne doklady. Zvoľte iný filter.",
                      )
                    : t(
                        "ekasa.page.receipts.emptyDesc",
                        "Doklady sa vytvárajú automaticky pri zaznamenaní platby v pokladni.",
                      )
                }
                action={{
                  label: t("ekasa.page.receipts.emptyCta", "Prejsť na fakturáciu"),
                  onClick: () => router.push("/billing"),
                  icon: Coins,
                }}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("ekasa.page.col.receiptNumber", "Číslo dokladu")}</TableHead>
                    <TableHead>{t("ekasa.page.col.date", "Dátum")}</TableHead>
                    <TableHead className="text-right">{t("ekasa.page.col.amount", "Suma")}</TableHead>
                    <TableHead className="text-right">{t("ekasa.page.col.vat", "DPH")}</TableHead>
                    <TableHead>{t("ekasa.page.col.payment", "Platba")}</TableHead>
                    <TableHead>{t("ekasa.page.col.verification", "Overenie")}</TableHead>
                    <TableHead>{t("ekasa.page.col.uid", "UID")}</TableHead>
                    <TableHead className="text-right">{t("ekasa.page.col.actions", "Akcie")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {receipts.map((r) => {
                      const verification = verificationStateOf(
                        r as { status: ReceiptStatus; receiptType?: string | null },
                      );
                      const isPrintingThis = printingId === r.id;

                      return (
                        <TableRow
                          key={r.id}
                          onClick={() => setSelectedReceipt(r)}
                          className="group cursor-pointer"
                        >
                          <TableCell className="px-3 py-2.5 font-mono text-xs font-medium">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="group-hover:text-primary transition-colors underline-offset-4 group-hover:underline">
                                {r.receiptNumber}
                              </span>
                              {r.receiptType === "RETURN" && (
                                <Badge variant="outline" className="h-4 border-warning/40 bg-warning-muted px-1.5 py-0 text-[10px] font-semibold text-warning-muted-foreground">
                                  {t("ekasa.page.badgeReturn", "VRÁTENIE")}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-2.5 whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                            {r.issuedAt
                              ? formatDateTime(r.issuedAt, { language: locale })
                              : "—"}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-right font-mono text-sm font-semibold tabular-nums text-foreground">
                            {formatAmount(r.amountTotal)}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                            {VAT_LABEL[r.vatRate] ?? r.vatRate}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-xs text-muted-foreground">
                            {paymentMethodLabel(t, r.paymentMethod)}
                          </TableCell>
                          <TableCell className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              {verification === "storno" ? (
                                <Badge variant="destructive" className="gap-1 font-semibold">
                                  <Ban className="h-3 w-3" />
                                  {t("ekasa.page.verification.storno", "Storno")}
                                </Badge>
                              ) : (
                                <StatusPulseBadge
                                  variant={VERIFICATION_VARIANT[verification]}
                                  label={t(
                                    `ekasa.page.verification.${verification}`,
                                    verification,
                                  )}
                                />
                              )}
                              {r.status === "OFFLINE_STORED" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    retryMutation.mutate({ receiptId: r.id });
                                  }}
                                  disabled={retryMutation.isPending}
                                  title={t(
                                    "ekasa.page.receipts.syncHint",
                                    "Synchronizovať offline doklad s Finančnou správou",
                                  )}
                                  className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning-muted-foreground hover:bg-warning/25 transition-all shadow-2xs"
                                >
                                  <RefreshCw
                                    className={`h-2.5 w-2.5 ${
                                      retryMutation.isPending ? "animate-spin" : ""
                                    }`}
                                  />
                                  <span>{t("ekasa.page.receipts.syncFs", "Sync FS")}</span>
                                </button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-2.5 max-w-[140px] truncate font-mono text-xs tabular-nums text-muted-foreground">
                            {r.uid ?? "—"}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1.5 px-2 text-xs"
                                onClick={() => setSelectedReceipt(r)}
                                title={t("ekasa.page.receipts.previewHint", "Náhľad termálneho dokladu")}
                              >
                                <ReceiptEuro className="h-3.5 w-3.5 text-muted-foreground" />
                                {t("ekasa.page.receipts.preview", "Náhľad")}
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1.5 px-2 text-xs"
                                onClick={() => handlePrint(r.id)}
                                disabled={isPrintingThis}
                                title={t("ekasa.page.receipts.printHint", "Tlačiť doklad")}
                              >
                                {isPrintingThis ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                {t("ekasa.page.receipts.print", "Tlačiť")}
                              </Button>

                              {r.receiptType !== "STORNO" &&
                                (r.status === "CONFIRMED" || r.status === "OFFLINE_STORED") && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1.5 border-destructive/30 bg-destructive/5 px-2 text-xs text-destructive hover:bg-destructive/15"
                                    onClick={() => {
                                      setStornoTarget(r);
                                      setStornoReason("");
                                    }}
                                    title={t("ekasa.page.receipts.stornoHint", "Stornovať doklad")}
                                  >
                                    <Ban className="h-3 w-3" />
                                    {t("ekasa.page.verification.storno", "Storno")}
                                  </Button>
                                )}

                              {r.status === "FAILED" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1.5 border-warning-muted/50 bg-warning-muted/30 px-2 text-xs text-warning-muted-foreground hover:bg-warning-muted/50"
                                  onClick={() => retryMutation.mutate({ receiptId: r.id })}
                                  disabled={retryMutation.isPending}
                                  title={t("ekasa.page.receipts.retryHint", "Opakovať odoslanie")}
                                >
                                  <RefreshCw
                                    className={`h-3 w-3 ${
                                      retryMutation.isPending ? "animate-spin" : ""
                                    }`}
                                  />
                                  {t("ekasa.page.receipts.retry", "Odoslať")}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            {receipts && receipts.length > 0 && (
              <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">
                  {t("ekasa.page.pagination.showingFrom", "Zobrazené záznamy od {offset}", {
                    offset: offset + 1,
                  })}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
                    disabled={offset === 0}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    {t("ekasa.page.pagination.previous", "Predchádzajúce")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                    disabled={receipts.length < PAGE_SIZE}
                  >
                    {t("ekasa.page.pagination.next", "Ďalšie")}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </DataTableFrame>
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
                  <h2 className="font-heading text-lg font-semibold text-foreground">
                    {t("ekasa.page.closures.today", "Dnešný deň ({date})", {
                      date: dailySummaryData?.date ?? t("ekasa.page.closures.todayFallback", "Dnes"),
                    })}
                  </h2>
                  {dailySummaryData?.isClosed ? (
                    <Badge variant="success">
                      {t("ekasa.page.closures.closedBadge", "Uzavreté: {number}", {
                        number: dailySummaryData.closureNumber ?? "",
                      })}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-warning/40 bg-warning-muted text-warning-muted-foreground">
                      {t("ekasa.page.closures.openBadge", "Otvorený deň (priebežný stav)")}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dailySummaryData?.isClosed
                    ? t("ekasa.page.closures.closedAt", "Uzávierka bola vykonaná: {when}", {
                        when: formatDateTime(dailySummaryData.closedAt, {
                          language: locale,
                        }),
                      })
                    : t(
                        "ekasa.page.closures.autoHint",
                        "Uzávierka sa automaticky vygeneruje o 23:59 alebo ju môžete spustiť manuálne.",
                      )}
                </p>
              </div>

              {!dailySummaryData?.isClosed && (
                <Button
                  onClick={() => closureMutation.mutate({})}
                  disabled={closureMutation.isPending}
                  className="gap-2"
                >
                  {closureMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  {t("ekasa.page.closures.run", "Vykonať dennú uzávierku (Z-report)")}
                </Button>
              )}
            </div>

            {/* Daily stats grid */}
            {isLoadingSummary ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : dailySummaryData?.summary ? (
              <KpiGrid className="mt-4">
                <KpiCard
                  label={t("ekasa.page.closures.totalToday", "Celková tržba dňa")}
                  icon={<Coins className="h-3.5 w-3.5" />}
                  value={
                    <span className="font-mono">
                      {formatAmount(dailySummaryData.summary.totalAmount)}
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {t("ekasa.page.closures.receiptCount", "{count} dokladov", {
                          count: dailySummaryData.summary.receiptsCount,
                        })}
                      </span>
                    </span>
                  }
                />
                <KpiCard
                  label={t("ekasa.page.closures.cash", "V hotovosti")}
                  icon={<Banknote className="h-3.5 w-3.5" />}
                  value={
                    <span className="font-mono">
                      {formatAmount(dailySummaryData.summary.cashAmount)}
                    </span>
                  }
                />
                <KpiCard
                  label={t("ekasa.page.closures.card", "Platobnou kartou")}
                  icon={<CreditCard className="h-3.5 w-3.5" />}
                  value={
                    <span className="font-mono">
                      {formatAmount(dailySummaryData.summary.cardAmount)}
                    </span>
                  }
                />
                <KpiCard
                  label={t("ekasa.page.closures.vat23", "DPH 23 % (základ / daň)")}
                  icon={<Percent className="h-3.5 w-3.5" />}
                  value={
                    <span className="font-mono text-sm">
                      {formatAmount(dailySummaryData.summary.vatBreakdown.vat23.base)} /{" "}
                      <span className="text-muted-foreground">
                        {formatAmount(dailySummaryData.summary.vatBreakdown.vat23.vat)}
                      </span>
                    </span>
                  }
                />
              </KpiGrid>
            ) : null}
          </div>

          {/* Past Closures: section header → DataTableFrame */}
          <PageSectionHeader
            title={t("ekasa.page.closures.history", "História denných uzávierok")}
          />
          <DataTableFrame>

            {isLoadingClosures ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !closures || closures.length === 0 ? (
              <EmptyState
                className="border-0 bg-transparent"
                icon={Lock}
                title={t("ekasa.page.closures.emptyTitle", "Žiadne denné uzávierky")}
                description={t(
                  "ekasa.page.closures.emptyDesc",
                  "Po prvej uzávierke sa tu zobrazí história Z-reportov s tržbami po dňoch.",
                )}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("ekasa.page.col.date", "Dátum")}</TableHead>
                    <TableHead>{t("ekasa.page.closures.colZReport", "Číslo Z-reportu")}</TableHead>
                    <TableHead className="text-right">{t("ekasa.page.closures.colReceipts", "Dokladov")}</TableHead>
                    <TableHead className="text-right">{t("ekasa.page.closures.colCash", "Hotovosť")}</TableHead>
                    <TableHead className="text-right">{t("ekasa.page.closures.colCard", "Karta")}</TableHead>
                    <TableHead className="text-right">{t("ekasa.page.closures.colTotal", "Spolu")}</TableHead>
                    <TableHead>{t("ekasa.page.closures.colStatus", "Stav")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closures.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="px-3 py-2.5 font-mono text-xs font-medium">
                        {formatDate(c.date, "SK", locale)}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 font-mono text-xs">
                        {c.closureNumber}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                        {c.receiptsCount}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-foreground">
                        {formatAmount(c.cashAmount)}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-foreground">
                        {formatAmount(c.cardAmount)}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                        {formatAmount(c.totalAmount)}
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <StatusPulseBadge
                          variant="confirmed"
                          label={t("ekasa.page.closures.statusClosed", "Uzavreté")}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataTableFrame>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: EXPORT PRE ÚČTOVNÍCTVO                                              */}
      {/* ========================================================================= */}
      {activeTab === "accountant" && (
        <div className="space-y-6">
          {/* Controls: Month picker & Download buttons */}
          <PageToolbar className="sm:justify-between">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <div className="flex items-center gap-2">
                <select
                  value={exportMonth}
                  onChange={(e) => setExportMonth(Number(e.target.value))}
                  className={filterControlClass}
                  aria-label={t("ekasa.page.accountant.month", "Mesiac")}
                >
                  {MONTH_KEYS.map((key, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {t(key, MONTH_FALLBACKS[idx])}
                    </option>
                  ))}
                </select>

                <select
                  value={exportYear}
                  onChange={(e) => setExportYear(Number(e.target.value))}
                  className={filterControlClass}
                  aria-label={t("ekasa.page.accountant.year", "Rok")}
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
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {t("ekasa.page.accountant.download", "Stiahnuť CSV pre účtovníčku")}
            </Button>
          </PageToolbar>

          {/* Monthly Totals Cards */}
          {isLoadingAccountant ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !accountantData || accountantData.closuresCount === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title={t(
                "ekasa.page.accountant.emptyTitle",
                "Pre zvolený mesiac nie sú evidované žiadne uzávierky",
              )}
              description={t(
                "ekasa.page.accountant.emptyDesc",
                "Denné uzávierky sa automaticky zapisujú o 23:59 každého pracovného dňa.",
              )}
              action={{
                label: t("ekasa.page.accountant.emptyCta", "Prejsť na uzávierky"),
                onClick: () => setActiveTab("closures"),
                icon: Lock,
              }}
            />
          ) : (
            <>
              <KpiGrid>
                <KpiCard
                  label={t("ekasa.page.accountant.totalMonth", "Celkové tržby za mesiac")}
                  icon={<Coins className="h-3.5 w-3.5" />}
                  value={
                    <span className="font-mono">
                      {formatAmount(accountantData.totals.totalAmount)}
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {t("ekasa.page.accountant.closureMix", "{closures} uzávierok / {receipts} bločkov", {
                          closures: accountantData.closuresCount,
                          receipts: accountantData.receiptsCount,
                        })}
                      </span>
                    </span>
                  }
                />
                <KpiCard
                  label={t("ekasa.page.accountant.totalCash", "Tržby v hotovosti")}
                  icon={<Banknote className="h-3.5 w-3.5" />}
                  value={
                    <span className="font-mono">
                      {formatAmount(accountantData.totals.cashAmount)}
                    </span>
                  }
                />
                <KpiCard
                  label={t("ekasa.page.accountant.totalCard", "Tržby platobnou kartou")}
                  icon={<CreditCard className="h-3.5 w-3.5" />}
                  value={
                    <span className="font-mono">
                      {formatAmount(accountantData.totals.cardAmount)}
                    </span>
                  }
                />
                <KpiCard
                  label={t("ekasa.page.accountant.totalTransfer", "Bankové prevody")}
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  value={
                    <span className="font-mono">
                      {formatAmount(accountantData.totals.transferAmount)}
                    </span>
                  }
                />
              </KpiGrid>

              {/* VAT Breakdown Card */}
              <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-xs">
                <PageSectionHeader
                  title={t(
                    "ekasa.page.accountant.vatTitle",
                    "Rozpad sadzieb DPH pre daňové priznanie (SR)",
                  )}
                />
                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <span className="font-medium text-foreground">
                      {t("ekasa.page.accountant.vat23", "Základná sadzba 23 %")}
                    </span>
                    <p className="mt-1 font-mono tabular-nums">
                      {t("ekasa.page.accountant.vatBase", "Základ:")}{" "}
                      <strong>{formatAmount(accountantData.totals.vat23.base)}</strong>
                    </p>
                    <p className="font-mono tabular-nums">
                      {t("ekasa.page.accountant.vatTax", "DPH:")}{" "}
                      <strong className="text-foreground">
                        {formatAmount(accountantData.totals.vat23.vat)}
                      </strong>
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <span className="font-medium text-foreground">
                      {t("ekasa.page.accountant.vat19", "Znížená sadzba 19 %")}
                    </span>
                    <p className="mt-1 font-mono tabular-nums">
                      {t("ekasa.page.accountant.vatBase", "Základ:")}{" "}
                      <strong>{formatAmount(accountantData.totals.vat19.base)}</strong>
                    </p>
                    <p className="font-mono tabular-nums">
                      {t("ekasa.page.accountant.vatTax", "DPH:")}{" "}
                      <strong className="text-foreground">
                        {formatAmount(accountantData.totals.vat19.vat)}
                      </strong>
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <span className="font-medium text-foreground">
                      {t("ekasa.page.accountant.vat5", "Znížená sadzba 5 %")}
                    </span>
                    <p className="mt-1 font-mono tabular-nums">
                      {t("ekasa.page.accountant.vatBase", "Základ:")}{" "}
                      <strong>{formatAmount(accountantData.totals.vat5.base)}</strong>
                    </p>
                    <p className="font-mono tabular-nums">
                      {t("ekasa.page.accountant.vatTax", "DPH:")}{" "}
                      <strong className="text-foreground">
                        {formatAmount(accountantData.totals.vat5.vat)}
                      </strong>
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <span className="font-medium text-foreground">
                      {t("ekasa.page.accountant.vat0", "Oslobodené od DPH 0 %")}
                    </span>
                    <p className="mt-1 font-mono tabular-nums">
                      {t("ekasa.page.accountant.vatBase", "Základ:")}{" "}
                      <strong>{formatAmount(accountantData.totals.vat0.base)}</strong>
                    </p>
                    <p className="font-mono tabular-nums">
                      {t("ekasa.page.accountant.vatTax", "DPH:")} <strong>{formatAmount(0)}</strong>
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Thermal Receipt Inspection Drawer */}
      <ThermalReceiptDrawer
        receipt={selectedReceipt}
        open={Boolean(selectedReceipt)}
        onClose={() => setSelectedReceipt(null)}
        onPrint={handlePrint}
        onRetry={async (id) => {
          await retryMutation.mutateAsync({ receiptId: id });
        }}
        onStorno={(rc) => {
          setStornoTarget(rc);
          setStornoReason("");
        }}
        isPrinting={printingId === selectedReceipt?.id}
        isRetrying={retryMutation.isPending}
        dic={ekasaConfig?.dic}
        icDph={ekasaConfig?.icDph}
        pokladnicaId={ekasaConfig?.pokladnicaId}
      />

      {/* Storno Confirmation Modal */}
      {stornoTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0"
            onClick={() => {
              if (!stornoMutation.isPending) setStornoTarget(null);
            }}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <Ban className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-semibold text-foreground">
                  {t("ekasa.page.storno.title", "Storno pokladničného dokladu")}
                </h3>
                <p className="font-mono text-xs text-muted-foreground">
                  {stornoTarget.receiptNumber} ({formatAmount(stornoTarget.amountTotal)})
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-muted-foreground">
              {t(
                "ekasa.page.storno.legalNotice",
                "V súlade so Zákonom č. 289/2008 Z. z. bude vystavený záporný opravný doklad naviazaný na pôvodný doklad ({reference}) a odoslaný do evidencie FS SR.",
                { reference: stornoTarget.uid ?? stornoTarget.receiptNumber },
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                {t("ekasa.page.storno.reasonLabel", "Dôvod storna")}{" "}
                <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={stornoReason}
                onChange={(e) => setStornoReason(e.target.value)}
                placeholder={t(
                  "ekasa.page.storno.reasonPlaceholder",
                  "Napr. Chybná platobná metóda, vrátenie tovaru...",
                )}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={stornoMutation.isPending}
                onClick={() => setStornoTarget(null)}
              >
                {t("ekasa.page.storno.cancel", "Zrušiť")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={stornoReason.trim().length < 3 || stornoMutation.isPending}
                onClick={() =>
                  stornoMutation.mutate({
                    receiptId: stornoTarget.id,
                    reason: stornoReason.trim(),
                    correctionType: "STORNO",
                  })
                }
                className="gap-1.5"
              >
                {stornoMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Ban className="h-3.5 w-3.5" />
                )}
                {t("ekasa.page.storno.confirm", "Potvrdiť storno")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EkasaReceiptsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <EkasaReceiptsSkeleton />
        </div>
      }
    >
      <EkasaReceiptsContent />
    </Suspense>
  );
}
