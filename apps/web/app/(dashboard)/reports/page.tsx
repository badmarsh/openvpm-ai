"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Euro,
  CalendarCheck,
  UserX,
  XCircle,
  TrendingUp,
  Package,
  AlertTriangle,
  CheckCircle,
  Activity,
  BarChart3,
  Download,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  MAX_REPORT_RANGE_DAYS,
  isCompleteReportDateRangeInputValid,
  reportPresetDateRange,
  reportDateRangeInputError,
  type ReportDatePreset,
} from "@/lib/reports/date-range";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import { formatDateYmdToDisplay } from "@/lib/date-display";
import { EmptyState } from "@/components/common/empty-state";
import {
  DataTableFrame,
  KpiCard,
  KpiGrid,
  PageHeader,
  PageToolbar,
  pageShellClass,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
  underlineTabsListClass,
  underlineTabsTriggerClass,
} from "@/components/layout/page-kit";
import { useCurrencyFormatter } from "@/lib/locale/useCurrency";
import { localeTagForLanguage } from "@/lib/locale/format";
import { useI18n } from "@/lib/i18n";

function ReportChartChunkLoading() {
  return (
    <div className="h-[300px] w-full animate-pulse rounded-md bg-muted" />
  );
}

const RevenueLineChart = dynamic(
  () =>
    import("@/components/reports/report-charts").then(
      (mod) => mod.RevenueLineChart
    ),
  {
    ssr: false,
    loading: ReportChartChunkLoading,
  }
);

const ServicesCountChart = dynamic(
  () =>
    import("@/components/reports/report-charts").then(
      (mod) => mod.ServicesCountChart
    ),
  {
    ssr: false,
    loading: ReportChartChunkLoading,
  }
);

type Tab = "revenue" | "appointments" | "services" | "inventory";
type DateRange = { startDate: string; endDate: string };
type ReportPdfCell = string | number | null | undefined;
type Translate = ReturnType<typeof useI18n>["t"];

// The reports router labels appointments without a doctor "Unassigned". CSV/PDF
// exports keep that raw value; only the on-screen label is localized.
const UNASSIGNED_DOCTOR_NAME = "Unassigned";

function canViewReportsRole(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian";
}

// ── Presentation-only guards ────────────────────────────────────────────────
// These never feed the CSV/PDF exports or the server aggregations; they only
// keep NaN / Infinity out of what is rendered on 0-invoice or 0-appointment
// periods.

/** Rounded share of `part` in `whole`; 0 when `whole` is 0 or not finite. */
function percentOf(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) {
    return 0;
  }
  return Math.round((part / whole) * 100);
}

/** Clamp a percentage into 0–100 so progress bars never get invalid widths. */
function clampPercent(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
}

/** Whole-number percentage in the UI language ("50 %" / "50%"), or "—". */
function formatPercentValue(value: number, language: string): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(localeTagForLanguage(language), {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

/** Integer count in the UI language ("12 345" / "12,345"), or "—". */
function formatCountValue(value: number, language: string): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(localeTagForLanguage(language), {
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Date-range validation (`@/lib/reports/date-range`) and the reports router
 * speak English. Map the known user-facing messages onto dictionary keys so
 * Slovak users never see raw English; unknown messages pass through unchanged.
 */
function localizeReportMessage(message: string, t: Translate): string {
  switch (message) {
    case "Start date is required":
      return t("reports.dateRange.errors.startRequired", "Zadajte dátum začiatku obdobia.");
    case "End date is required":
      return t("reports.dateRange.errors.endRequired", "Zadajte dátum konca obdobia.");
    case "Start date must be a valid YYYY-MM-DD date":
      return t("reports.dateRange.errors.startInvalid", "Dátum začiatku obdobia nie je platný.");
    case "End date must be a valid YYYY-MM-DD date":
      return t("reports.dateRange.errors.endInvalid", "Dátum konca obdobia nie je platný.");
    case "Start date must be on or before end date":
      return t(
        "reports.dateRange.errors.startAfterEnd",
        "Dátum začiatku musí byť rovnaký alebo skorší ako dátum konca."
      );
    case `Report date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days`:
      return t(
        "reports.dateRange.errors.tooLong",
        "Obdobie prehľadu môže mať najviac {days} dní.",
        { days: MAX_REPORT_RANGE_DAYS }
      );
    case "Invalid report date range":
      return t("reports.dateRange.errors.invalid", "Neplatné obdobie prehľadu.");
    default:
      return message;
  }
}

/** Secondary line composed into a page-kit `KpiCard` value. */
function KpiNote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "mt-0.5 block text-xs font-normal text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
    />
  );
}

function LoadingSkeleton() {
  const { t } = useI18n();
  return (
    <div
      className={pageShellClass}
      role="status"
      aria-busy="true"
      aria-label={t("reports.loading", "Načítavam prehľad…")}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

function defaultClientReportDateRange(
  now = new Date(),
  timeZone?: string | null
): DateRange {
  return reportPresetDateRange("last30", now, timeZone);
}

function reportFilename(
  tab: Tab,
  range?: { startDate: string; endDate: string },
  extension = "csv"
) {
  const suffix = range ? `${range.startDate}_to_${range.endDate}` : "current";
  return `${tab}-report-${suffix}.${extension}`;
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function downloadReportPdf({
  filename,
  title,
  subtitle,
  columns,
  rows,
  emptyMessage,
}: {
  filename: string;
  title: string;
  subtitle?: string;
  columns: string[];
  rows: ReportPdfCell[][];
  emptyMessage?: string;
}) {
  const { generateReportPdf } = await import("@/lib/pdf");
  generateReportPdf({
    title,
    subtitle,
    columns,
    rows,
    emptyMessage,
  }).save(filename);
}

function ReportExportButtons({
  onCsv,
  onPdf,
}: {
  onCsv: () => void;
  onPdf: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" size="sm" onClick={onCsv} className="gap-2">
        <Download className="h-4 w-4" />
        {t("reports.exportCsv", "Export CSV")} {/* Export CSV */}
      </Button>
      <Button variant="outline" size="sm" onClick={onPdf} className="gap-2">
        <Download className="h-4 w-4" />
        {t("reports.exportPdf", "Export PDF")} {/* Export PDF */}
      </Button>
    </div>
  );
}

function ReportError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center"
    >
      <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
      <p className="mt-3 font-medium">{t("reports.error.title", "Could not load report")}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {localizeReportMessage(message, t)}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
        {t("reports.error.retry", "Retry")}
      </Button>
    </div>
  );
}

function ReportMissingData({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <EmptyState
      icon={AlertTriangle}
      title={t("reports.missingData.title", "Could not load report data")} /* title="Could not load report data" */
      description={t("reports.missingData.desc", "The report request finished without returning data. Try loading it again.")}
      action={{ label: t("reports.error.retry", "Retry"), onClick: onRetry }}
      className="border-destructive/30 bg-destructive/5"
    />
  );
}

function DateRangeControls({
  value,
  onChange,
  timeZone,
  validationMessage,
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
  timeZone?: string | null;
  validationMessage?: string | null;
}) {
  const { t } = useI18n();
  const setPreset = (preset: ReportDatePreset) => {
    onChange(reportPresetDateRange(preset, new Date(), timeZone));
  };
  const errorId = validationMessage ? "reports-date-range-error" : undefined;
  const presets: { key: ReportDatePreset; label: string }[] = [
    { key: "last30", label: t("reports.dateRange.last30", "Last 30 Days") },
    { key: "month", label: t("reports.dateRange.monthToDate", "Month to Date") },
    { key: "lastMonth", label: t("reports.dateRange.lastMonth", "Last Month") },
    { key: "year", label: t("reports.dateRange.yearToDate", "Year to Date") },
  ];
  // Highlight the preset the current range matches (in the practice timezone)
  // so users can tell which period every tab is reporting on.
  const now = new Date();
  const isPresetActive = (preset: ReportDatePreset) => {
    const range = reportPresetDateRange(preset, now, timeZone);
    return (
      range.startDate === value.startDate && range.endDate === value.endDate
    );
  };

  return (
    <PageToolbar>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor="reports-date-range-start"
            className="text-xs font-medium text-muted-foreground"
          >
            {t("reports.dateRange.start", "Start")}
          </label>
          <DatePicker
            id="reports-date-range-start"
            value={value.startDate}
            aria-invalid={Boolean(validationMessage) || undefined}
            aria-describedby={errorId}
            onChange={(next) =>
              onChange({ ...value, startDate: next })
            }
            className="h-9 w-36 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="reports-date-range-end"
            className="text-xs font-medium text-muted-foreground"
          >
            {t("reports.dateRange.end", "End")}
          </label>
          <DatePicker
            id="reports-date-range-end"
            value={value.endDate}
            aria-invalid={Boolean(validationMessage) || undefined}
            aria-describedby={errorId}
            onChange={(next) =>
              onChange({ ...value, endDate: next })
            }
            className="h-9 w-36 text-xs"
          />
        </div>
      </div>
      <div
        role="group"
        aria-label={t("reports.dateRange.presets", "Rýchly výber obdobia")}
        className="flex flex-wrap gap-2 sm:ml-auto"
      >
        {presets.map((preset) => {
          const active = isPresetActive(preset.key);
          return (
            <Button
              key={preset.key}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={active}
              onClick={() => setPreset(preset.key)}
              className={cn(
                "text-xs",
                active &&
                  "border-primary bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
              )}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
      {validationMessage ? (
        <p
          id="reports-date-range-error"
          className="basis-full text-xs text-destructive"
        >
          {validationMessage}
        </p>
      ) : null}
    </PageToolbar>
  );
}

function ReportDateRangeInvalid({ message }: { message: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
      <p className="mt-3 font-medium">{t("reports.invalidDateRange.title", "Choose a valid report date range")} {/* Choose a valid report date range */}</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/** Inventory alert group: semantic-token heading + dense page-kit table. */
function InventoryAlertSection({
  id,
  icon: Icon,
  iconClassName,
  title,
  lastColumn,
  children,
}: {
  id: string;
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  lastColumn: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="space-y-3">
      <h3
        id={id}
        className="flex items-center gap-2 text-sm font-medium text-foreground"
      >
        <Icon
          className={cn("h-4 w-4 shrink-0", iconClassName)}
          aria-hidden="true"
        />
        {title}
      </h3>
      <DataTableFrame>
        <table aria-labelledby={id} className="w-full text-xs tabular-nums">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className={tableHeadClass}>{t("reports.inventory.colProduct", "Product")}</th>
              <th className={tableHeadClass}>{t("reports.inventory.colSku", "SKU")}</th>
              <th className={cn(tableHeadClass, "text-right")}>{t("reports.inventory.colStock", "Stock")}</th>
              <th className={cn(tableHeadClass, "text-right")}>{lastColumn}</th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </DataTableFrame>
    </section>
  );
}

function RevenueTab({ dateRange }: { dateRange: DateRange }) {
  const { t } = useI18n();
  const formatAmount = useCurrencyFormatter();
  const { data, isLoading, isError, error, refetch } =
    trpc.reports.revenue.useQuery(dateRange);

  if (isError) {
    return <ReportError message={error.message} onRetry={() => refetch()} />;
  }
  if (isLoading) return <LoadingSkeleton />;
  if (!data) return <ReportMissingData onRetry={() => refetch()} />;

  // A percent against a $0 previous period is meaningless; call it new
  // revenue instead of "+100%".
  const rawDiff =
    data.previousTotal > 0
      ? Math.round(
          ((data.total - data.previousTotal) / data.previousTotal) * 100
        )
      : null;
  // Never render "NaN% vs previous period" if a total ever arrives non-finite.
  const diff = rawDiff !== null && Number.isFinite(rawDiff) ? rawDiff : null;
  const rangeSubtitle =
    diff !== null && diff !== 0
      ? t("reports.revenue.vsPrevious", "{diff}% vs previous period", { diff: `${diff > 0 ? "+" : ""}${diff}` })
      : diff === null && data.total > 0
        ? t("reports.revenue.newThisPeriod", "New revenue this period")
        : undefined;
  const rangeSubtitleClass =
    diff !== null && diff > 0
      ? "text-success"
      : diff !== null && diff < 0
        ? "text-destructive"
        : undefined;
  // The router zero-fills `daily` across the whole range, so its length is
  // never 0 for a valid range. An all-zero series is a 0-invoice period and
  // must show the empty state instead of a flat line at zero.
  const hasRevenueActivity = data.daily.some(
    (point) => Number.isFinite(point.amount) && point.amount !== 0
  );
  const revenueRows = [
    [
      "selected_period_total",
      `${data.range.startDate} to ${data.range.endDate}`,
      data.total,
    ],
    [
      "previous_period_total",
      `${data.range.previousStartDate} to ${data.range.previousEndDate}`,
      data.previousTotal,
    ],
    ...data.daily.map((row) => ["daily_revenue", row.date, row.amount]),
  ];
  const exportRevenue = () =>
    downloadCsv(reportFilename("revenue", data.range), [
      ["metric", "period", "amount"],
      ...revenueRows,
    ]);
  const exportRevenuePdf = () =>
    void downloadReportPdf({
      filename: reportFilename("revenue", data.range, "pdf"),
      title: "Revenue Report",
      subtitle: `${data.range.startDate} to ${data.range.endDate}`,
      columns: ["Metric", "Period", "Amount"],
      rows: revenueRows.map(([metric, period, amount]) => [
        metric,
        period,
        formatAmount(Number(amount)),
      ]),
      emptyMessage: "No revenue data for this period.",
    });

  return (
    <div className={pageShellClass}>
      <KpiGrid className="sm:grid-cols-2">
        <KpiCard
          label={t("reports.revenue.selectedRange", "Selected Range")}
          icon={Euro}
          value={
            <>
              {formatAmount(data.total)}
              {rangeSubtitle ? (
                <KpiNote className={rangeSubtitleClass}>{rangeSubtitle}</KpiNote>
              ) : null}
            </>
          }
        />
        <KpiCard
          label={t("reports.revenue.previousPeriod", "Previous Period")}
          icon={TrendingUp}
          value={
            <>
              {formatAmount(data.previousTotal)}
              <KpiNote>
                {formatDateYmdToDisplay(data.range.previousStartDate)} –{" "}
                {formatDateYmdToDisplay(data.range.previousEndDate)}
              </KpiNote>
            </>
          }
        />
      </KpiGrid>

      <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t("reports.revenue.dailyRevenue", "Daily Revenue")}
          </h3>
          <ReportExportButtons
            onCsv={exportRevenue}
            onPdf={exportRevenuePdf}
          />
        </div>
        {hasRevenueActivity ? (
          <RevenueLineChart
            daily={data.daily}
            formatCurrency={formatAmount}
          />
        ) : (
          <EmptyState
            className="border-0 bg-transparent py-12"
            icon={Euro}
            title={t("reports.revenue.emptyTitle", "No revenue data for this period")} /* title="No revenue data for this period" */
            description={t("reports.revenue.emptyDesc", "Paid invoices will appear here once they fall inside the selected date range.")}
          />
        )}
      </div>
    </div>
  );
}

function AppointmentsTab({ dateRange }: { dateRange: DateRange }) {
  const { t, locale } = useI18n();
  const { data, isLoading, isError, error, refetch } =
    trpc.reports.appointments.useQuery(dateRange);

  if (isError) {
    return <ReportError message={error.message} onRetry={() => refetch()} />;
  }
  if (isLoading) return <LoadingSkeleton />;
  if (!data) return <ReportMissingData onRetry={() => refetch()} />;

  const appointmentRows = [
    [
      "summary",
      "",
      data.total,
      data.completed,
      data.noShows,
      data.cancelled,
      data.fillRate,
    ],
    ...data.byDoctor.map((doc) => [
      "doctor",
      doc.doctorName,
      doc.total,
      doc.completed,
      "",
      "",
      doc.total > 0 ? Math.round((doc.completed / doc.total) * 100) : 0,
    ]),
  ];
  const exportAppointments = () =>
    downloadCsv(reportFilename("appointments", data.range), [
      ["section", "doctor", "total", "completed", "no_shows", "cancelled", "fill_rate"],
      ...appointmentRows,
    ]);
  const exportAppointmentsPdf = () =>
    void downloadReportPdf({
      filename: reportFilename("appointments", data.range, "pdf"),
      title: "Appointments Report",
      subtitle: `${data.range.startDate} to ${data.range.endDate}`,
      columns: [
        "Section",
        "Doctor",
        "Total",
        "Completed",
        "No-shows",
        "Cancelled",
        "Fill Rate",
      ],
      rows: appointmentRows.map((row) => [
        row[0],
        row[1],
        row[2],
        row[3],
        row[4],
        row[5],
        `${row[6]}%`,
      ]),
      emptyMessage: "No appointment data for this period.",
    });

  // Display-only copy of the server's fill rate: clamped so a 0-appointment
  // period (or any non-finite value) renders 0 % instead of "NaN%".
  const fillRate = clampPercent(data.fillRate);

  return (
    <div className={pageShellClass}>
      <ReportExportButtons
        onCsv={exportAppointments}
        onPdf={exportAppointmentsPdf}
      />
      <KpiGrid>
        <KpiCard
          label={t("reports.appointments.total", "Total")}
          value={formatCountValue(data.total, locale)}
          icon={CalendarCheck}
        />
        <KpiCard
          label={t("reports.appointments.completed", "Completed")}
          value={formatCountValue(data.completed, locale)}
          icon={CheckCircle}
        />
        <KpiCard
          label={t("reports.appointments.noShows", "No-Shows")}
          value={formatCountValue(data.noShows, locale)}
          icon={UserX}
        />
        <KpiCard
          label={t("reports.appointments.cancellations", "Cancellations")}
          value={formatCountValue(data.cancelled, locale)}
          icon={XCircle}
        />
      </KpiGrid>

      {/* Fill rate */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3
            id="reports-fill-rate-heading"
            className="text-sm font-medium text-muted-foreground"
          >
            {t("reports.appointments.fillRate", "Fill Rate")}
          </h3>
          <span className="text-lg font-semibold tabular-nums">
            {formatPercentValue(fillRate, locale)}
          </span>
        </div>
        <div
          role="progressbar"
          aria-labelledby="reports-fill-rate-heading"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={fillRate}
          className="h-3 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${fillRate}%` }}
          />
        </div>
      </div>

      {/* Doctor breakdown */}
      {data.byDoctor.length > 0 ? (
        <section className="space-y-3">
          <h3
            id="reports-doctor-breakdown-heading"
            className="text-sm font-medium text-muted-foreground"
          >
            {t("reports.appointments.doctorBreakdown", "Doctor Breakdown")}
          </h3>
          <DataTableFrame>
            <table
              aria-labelledby="reports-doctor-breakdown-heading"
              className="w-full text-xs tabular-nums"
            >
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className={tableHeadClass}>{t("reports.appointments.doctor", "Doctor")}</th>
                  <th className={cn(tableHeadClass, "text-right")}>{t("reports.appointments.colTotal", "Total")}</th>
                  <th className={cn(tableHeadClass, "text-right")}>{t("reports.appointments.colCompleted", "Completed")}</th>
                  <th className={cn(tableHeadClass, "text-right")}>{t("reports.appointments.completionRate", "Completion Rate")}</th>
                </tr>
              </thead>
              <tbody>
                {data.byDoctor.map((doc) => (
                  <tr key={doc.doctorName} className={tableRowClass}>
                    <td className={cn(tableCellClass, "font-medium")}>
                      {doc.doctorName === UNASSIGNED_DOCTOR_NAME
                        ? t("reports.appointments.unassigned", "Nepriradený veterinár")
                        : doc.doctorName}
                    </td>
                    <td className={cn(tableCellClass, "text-right")}>
                      {formatCountValue(doc.total, locale)}
                    </td>
                    <td className={cn(tableCellClass, "text-right")}>
                      {formatCountValue(doc.completed, locale)}
                    </td>
                    <td className={cn(tableCellClass, "text-right")}>
                      {formatPercentValue(percentOf(doc.completed, doc.total), locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableFrame>
        </section>
      ) : (
        <EmptyState
          icon={CalendarCheck}
          title={t("reports.appointments.emptyTitle", "No doctor breakdown available")} /* title="No doctor breakdown available" */
          description={t("reports.appointments.emptyDesc", "Appointments will be grouped by assigned doctor for the selected date range.")}
        />
      )}
    </div>
  );
}

function ServicesTab({ dateRange }: { dateRange: DateRange }) {
  const { t, locale } = useI18n();
  const formatAmount = useCurrencyFormatter();
  const { data, isLoading, isError, error, refetch } =
    trpc.reports.topServices.useQuery(dateRange);

  if (isError) {
    return <ReportError message={error.message} onRetry={() => refetch()} />;
  }
  if (isLoading) return <LoadingSkeleton />;
  if (!data) return <ReportMissingData onRetry={() => refetch()} />;

  const serviceRows = data.items.map((svc) => [
    svc.name,
    svc.count,
    svc.revenue,
  ]);
  const exportServices = () =>
    downloadCsv(reportFilename("services", data.range), [
      ["service", "count", "revenue"],
      ...serviceRows,
    ]);
  const exportServicesPdf = () =>
    void downloadReportPdf({
      filename: reportFilename("services", data.range, "pdf"),
      title: "Services Report",
      subtitle: `${data.range.startDate} to ${data.range.endDate}`,
      columns: ["Service", "Count", "Revenue"],
      rows: serviceRows.map(([name, count, revenue]) => [
        name,
        count,
        formatAmount(Number(revenue)),
      ]),
      emptyMessage: "No billed service items were found for the selected range.",
    });

  if (data.items.length === 0) {
    return (
      <div className={pageShellClass}>
        <ReportExportButtons
          onCsv={exportServices}
          onPdf={exportServicesPdf}
        />
        <EmptyState
          icon={BarChart3}
          title={t("reports.services.emptyTitle", "No service data available")} /* No service data available */
          description={t("reports.services.emptyDesc", "No billed service items were found for the selected range.")}
        />
      </div>
    );
  }

  return (
    <div className={pageShellClass}>
      <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t("reports.services.top10", "Top 10 Services by Count")}
          </h3>
          <ReportExportButtons
            onCsv={exportServices}
            onPdf={exportServicesPdf}
          />
        </div>
        <ServicesCountChart items={data.items} />
      </div>

      <section className="space-y-3">
        <h3
          id="reports-service-details-heading"
          className="text-sm font-medium text-muted-foreground"
        >
          {t("reports.services.details", "Service Details")}
        </h3>
        <DataTableFrame>
          <table
            aria-labelledby="reports-service-details-heading"
            className="w-full text-xs tabular-nums"
          >
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className={tableHeadClass}>{t("reports.services.colService", "Service")}</th>
                <th className={cn(tableHeadClass, "text-right")}>{t("reports.services.colCount", "Count")}</th>
                <th className={cn(tableHeadClass, "text-right")}>{t("reports.services.colTotalRevenue", "Total Revenue")}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((svc) => (
                <tr key={svc.name} className={tableRowClass}>
                  <td className={cn(tableCellClass, "font-medium")}>{svc.name}</td>
                  <td className={cn(tableCellClass, "text-right")}>
                    {formatCountValue(svc.count, locale)}
                  </td>
                  <td className={cn(tableCellClass, "text-right")}>
                    {formatAmount(svc.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableFrame>
      </section>
    </div>
  );
}

function InventoryTab() {
  const { t } = useI18n();
  const { data, isLoading, isError, error, refetch } =
    trpc.reports.inventoryAlerts.useQuery();

  if (isError) {
    return <ReportError message={error.message} onRetry={() => refetch()} />;
  }
  if (isLoading) return <LoadingSkeleton />;
  if (!data) return <ReportMissingData onRetry={() => refetch()} />;

  const hasAlerts =
    data.lowStock.length > 0 ||
    data.expired.length > 0 ||
    data.expiringSoon.length > 0;
  const inventoryRows = [
    ...data.lowStock.map((item) => [
      "low_stock",
      item.name,
      item.sku ?? "",
      item.stockQuantity,
      item.reorderPoint ?? 10,
      "",
    ]),
    ...data.expired.map((item) => [
      "expired",
      item.name,
      item.sku ?? "",
      item.stockQuantity,
      "",
      item.expirationDate,
    ]),
    ...data.expiringSoon.map((item) => [
      "expiring_soon",
      item.name,
      item.sku ?? "",
      item.stockQuantity,
      "",
      item.expirationDate,
    ]),
  ];
  const exportInventory = () =>
    downloadCsv(reportFilename("inventory"), [
      ["section", "product", "sku", "stock", "reorder_point", "expiration_date"],
      ...inventoryRows,
    ]);
  const exportInventoryPdf = () =>
    void downloadReportPdf({
      filename: reportFilename("inventory", undefined, "pdf"),
      title: "Inventory Alerts Report",
      columns: [
        "Section",
        "Product",
        "SKU",
        "Stock",
        "Reorder Point",
        "Expiration",
      ],
      rows: inventoryRows,
      emptyMessage: "No low stock, expired, or expiring products detected.",
    });

  if (!hasAlerts) {
    return (
      <div className={pageShellClass}>
        <ReportExportButtons
          onCsv={exportInventory}
          onPdf={exportInventoryPdf}
        />
        <EmptyState
          icon={CheckCircle}
          title={t("reports.inventory.emptyTitle", "All stock levels OK")} /* title="All stock levels OK" */
          description={t("reports.inventory.emptyDesc", "No low stock, expired, or expiring products detected.")}
        />
      </div>
    );
  }

  return (
    <div className={pageShellClass}>
      <ReportExportButtons
        onCsv={exportInventory}
        onPdf={exportInventoryPdf}
      />
      {/* Low Stock Alerts */}
      {data.lowStock.length > 0 && (
        <InventoryAlertSection
          id="reports-low-stock-heading"
          icon={AlertTriangle}
          iconClassName="text-warning"
          title={t("reports.inventory.lowStockAlerts", "Low Stock Alerts ({count})", { count: data.lowStock.length })}
          lastColumn={t("reports.inventory.colReorderPoint", "Reorder Point")}
        >
          {data.lowStock.map((item, index) => (
            <tr key={`${item.sku ?? item.name}-${index}`} className={tableRowClass}>
              <td className={cn(tableCellClass, "font-medium")}>{item.name}</td>
              <td className={cn(tableCellClass, "text-muted-foreground")}>{item.sku ?? "—"}</td>
              <td className={cn(tableCellClass, "text-right font-semibold")}>{item.stockQuantity}</td>
              <td className={cn(tableCellClass, "text-right")}>{item.reorderPoint ?? 10}</td>
            </tr>
          ))}
        </InventoryAlertSection>
      )}

      {/* Expired Products */}
      {data.expired.length > 0 && (
        <InventoryAlertSection
          id="reports-expired-heading"
          icon={XCircle}
          iconClassName="text-destructive"
          title={t("reports.inventory.expiredProducts", "Expired Products ({count})", { count: data.expired.length })}
          lastColumn={t("reports.inventory.colExpirationDate", "Expiration Date")}
        >
          {data.expired.map((item, index) => (
            <tr key={`${item.sku ?? item.name}-${index}`} className={tableRowClass}>
              <td className={cn(tableCellClass, "font-medium")}>{item.name}</td>
              <td className={cn(tableCellClass, "text-muted-foreground")}>{item.sku ?? "—"}</td>
              <td className={cn(tableCellClass, "text-right")}>{item.stockQuantity}</td>
              <td className={cn(tableCellClass, "text-right font-medium text-destructive")}>
                {formatDateYmdToDisplay(item.expirationDate)}
              </td>
            </tr>
          ))}
        </InventoryAlertSection>
      )}

      {/* Expiring Soon */}
      {data.expiringSoon.length > 0 && (
        <InventoryAlertSection
          id="reports-expiring-soon-heading"
          icon={Activity}
          iconClassName="text-warning"
          title={t("reports.inventory.expiringSoon", "Expiring Soon ({count})", { count: data.expiringSoon.length })}
          lastColumn={t("reports.inventory.colExpirationDate", "Expiration Date")}
        >
          {data.expiringSoon.map((item, index) => (
            <tr key={`${item.sku ?? item.name}-${index}`} className={tableRowClass}>
              <td className={cn(tableCellClass, "font-medium")}>{item.name}</td>
              <td className={cn(tableCellClass, "text-muted-foreground")}>{item.sku ?? "—"}</td>
              <td className={cn(tableCellClass, "text-right")}>{item.stockQuantity}</td>
              <td className={cn(tableCellClass, "text-right font-medium")}>
                {formatDateYmdToDisplay(item.expirationDate)}
              </td>
            </tr>
          ))}
        </InventoryAlertSection>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t } = useI18n();

  if (status === "loading") {
    return (
      <div
        role="status"
        className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
      >
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t("reports.access.checking", "Checking report access...")}
        </div>
      </div>
    );
  }

  if (!canViewReportsRole(session?.user?.role)) {
    return (
      <EmptyState
        icon={BarChart3}
        title={t("reports.access.restrictedTitle", "Reports are restricted")} /* Reports are restricted */
        description={t("reports.access.restrictedDesc", "Only administrators and veterinarians can view practice reports.")}
        action={{
          label: t("reports.access.backToDashboard", "Back to dashboard"),
          onClick: () => router.push("/"),
        }}
      />
    );
  }

  return <ReportsDashboard />;
}

function ReportsDashboard() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>("revenue");
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const settingsQuery = trpc.reports.settings.useQuery();
  const reportSettings = settingsQuery.data;

  useEffect(() => {
    if (dateRange === null && reportSettings !== undefined) {
      setDateRange(
        defaultClientReportDateRange(new Date(), reportSettings.timezone)
      );
    }
  }, [dateRange, reportSettings]);

  const tabs: { key: Tab; label: string; icon: LucideIcon }[] = [
    { key: "revenue", label: t("reports.tabs.revenue", "Tržby"), icon: Euro },
    { key: "appointments", label: t("reports.tabs.appointments", "Objednávky"), icon: CalendarCheck },
    { key: "services", label: t("reports.tabs.services", "Výkony"), icon: BarChart3 },
    { key: "inventory", label: t("reports.tabs.inventory", "Sklad"), icon: Package },
  ];

  const needsDateRange = activeTab !== "inventory";
  const dateRangeError = needsDateRange ? settingsQuery.error : null;
  const settingsMissingData =
    needsDateRange &&
    !settingsQuery.isLoading &&
    !settingsQuery.error &&
    reportSettings === undefined;
  const reportSettingsReady =
    !needsDateRange || Boolean(reportSettings && !settingsQuery.error);
  const dateRangeInputError =
    needsDateRange && dateRange ? reportDateRangeInputError(dateRange) : null;
  const dateRangeValidationMessage = dateRangeInputError
    ? localizeReportMessage(dateRangeInputError, t)
    : null;
  const hasValidDateRange =
    reportSettingsReady &&
    (!needsDateRange ||
      Boolean(dateRange && isCompleteReportDateRangeInputValid(dateRange)));
  const canRenderDateRangeControls =
    needsDateRange && dateRange && reportSettings && !settingsQuery.error;

  return (
    <div className={pageShellClass}>
      <PageHeader
        icon={BarChart3}
        title={t("reports.header.title", "Reports")}
        subtitle={t("reports.header.subtitle", "Practice analytics and insights")}
      />

      {/* Tabs sit above the date toolbar so hiding it (inventory) never moves the tab bar. */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as Tab)}
      >
        <TabsList
          aria-label={t("reports.tabs.label", "Sekcie prehľadov")}
          className={cn(underlineTabsListClass, "overflow-x-auto")}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className={underlineTabsTriggerClass}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {canRenderDateRangeControls ? (
        <DateRangeControls
          value={dateRange}
          onChange={setDateRange}
          timeZone={reportSettings.timezone}
          validationMessage={dateRangeValidationMessage}
        />
      ) : null}

      {/* Tab content */}
      <div className="min-w-0">
        {dateRangeError ? (
          <ReportError
            message={dateRangeError.message}
            onRetry={() => settingsQuery.refetch()}
          />
        ) : settingsMissingData ? (
          <ReportMissingData onRetry={() => settingsQuery.refetch()} />
        ) : needsDateRange && !dateRange ? (
          <LoadingSkeleton />
        ) : dateRangeValidationMessage ? (
          <ReportDateRangeInvalid message={dateRangeValidationMessage} />
        ) : null}
        {activeTab === "revenue" && hasValidDateRange && dateRange && (
          <RevenueTab dateRange={dateRange} />
        )}
        {activeTab === "appointments" && (
          hasValidDateRange && dateRange ? (
            <AppointmentsTab dateRange={dateRange} />
          ) : null
        )}
        {activeTab === "services" && hasValidDateRange && dateRange && (
          <ServicesTab dateRange={dateRange} />
        )}
        {activeTab === "inventory" && <InventoryTab />}
      </div>
    </div>
  );
}
