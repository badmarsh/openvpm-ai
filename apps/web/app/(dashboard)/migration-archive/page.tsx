"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  FlaskConical,
  Loader2,
  Pill,
  Receipt,
  Search,
  Users,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCurrencyFormatter } from "@/lib/locale/useCurrency";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/empty-state";
import type { AppRouter } from "@/server/routers/_app";
import { MigrationReviewChecklist } from "@/components/migration/migration-review-checklist";

const PAGE_SIZE = 50;

const sections = [
  { id: "contacts", label: "Co-owners", labelKey: "migrationArchive.sections.contacts", icon: Users },
  { id: "appointments", label: "Appointments", labelKey: "migrationArchive.sections.appointments", icon: CalendarClock },
  { id: "medications", label: "Medications", labelKey: "migrationArchive.sections.medications", icon: Pill },
  { id: "labs", label: "Labs", labelKey: "migrationArchive.sections.labs", icon: FlaskConical },
  { id: "financial", label: "Financial", labelKey: "migrationArchive.sections.financial", icon: Receipt },
  { id: "documents", label: "Documents", labelKey: "migrationArchive.sections.documents", icon: FileText },
] as const;

type ArchiveSection = (typeof sections)[number]["id"];
type ArchiveDetailData =
  inferRouterOutputs<AppRouter>["migrationArchive"]["detail"];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function metric(value: number | undefined): string {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function MigrationArchivePage() {
  const { t } = useI18n();
  const formatCurrency = useCurrencyFormatter();
  const [section, setSection] = useState<ArchiveSection>("contacts");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const summary = trpc.migrationArchive.summary.useQuery();
  const list = trpc.migrationArchive.list.useQuery({
    section,
    query,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  const canExpand = ["medications", "labs", "financial"].includes(section);
  const detail = trpc.migrationArchive.detail.useQuery(
    { section, id: selectedId ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: canExpand && !!selectedId },
  );

  useEffect(() => {
    setPage(0);
    setSelectedId(null);
  }, [section, query]);

  const activeSection = sections.find((item) => item.id === section)!;
  const totalPages = Math.max(
    1,
    Math.ceil((list.data?.total ?? 0) / PAGE_SIZE),
  );
  const summaryCards = useMemo(() => {
    const data = summary.data;
    return [
      {
        label: t("migrationArchive.summary.contacts", "Co-owners"),
        value: data?.contacts.total,
        note: t("migrationArchive.summary.contactsNeedMatching", `${metric(data?.contacts.needsReview)} need matching`, { count: metric(data?.contacts.needsReview) }),
      },
      {
        label: t("migrationArchive.summary.appointments", "Appointments"),
        value: data?.appointments.total,
        note: t("migrationArchive.summary.referenceHistory", "Reference history"),
      },
      {
        label: t("migrationArchive.summary.prescriptions", "Prescriptions"),
        value: data?.medications.total,
        note: t("migrationArchive.summary.fillsPreserved", `${metric(data?.medications.fills)} fills preserved`, { count: metric(data?.medications.fills) }),
      },
      {
        label: t("migrationArchive.summary.labReports", "Lab reports"),
        value: data?.labs.total,
        note: t("migrationArchive.summary.needReview", `${metric(data?.labs.needsReview)} need review`, { count: metric(data?.labs.needsReview) }),
      },
      {
        label: t("migrationArchive.summary.financialDocuments", "Financial documents"),
        value: data?.financial.total,
        note: data
          ? t("migrationArchive.summary.historicalBalance", `${formatCurrency(data.financial.openBalance)} historical balance`, { amount: formatCurrency(data.financial.openBalance) })
          : t("migrationArchive.summary.historicalReference", "Historical reference"),
      },
      {
        label: t("migrationArchive.summary.documents", "Documents"),
        value: data?.documents.total,
        note: t("migrationArchive.summary.needLinking", `${metric(data?.documents.needsReview)} need linking`, { count: metric(data?.documents.needsReview) }),
      },
    ];
  }, [formatCurrency, summary.data, t]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Archive className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-semibold uppercase tracking-wide">
            {t("migrationArchive.header.badge", "Imported history")}
          </span>
        </div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          {t("migrationArchive.header.title", "Clinic archive")}
        </h2>
        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
          {t(
            "migrationArchive.header.description",
            "Source-attributed history from a prior system. These records support clinical and business context, but they do not silently create live appointments, dispense inventory, change accounts receivable, or authorize client communication.",
          )}
        </p>
      </header>

      <MigrationReviewChecklist />

      {summary.data ? (
        <section aria-labelledby="practice-data-heading" className="space-y-3">
          <div>
            <h3 id="practice-data-heading" className="font-heading text-lg font-semibold">
              {t("migrationArchive.snapshot.title", "Practice data snapshot")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("migrationArchive.snapshot.description", "Use these totals as a reasonableness check, then sample the records below.")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              [t("migrationArchive.snapshot.clients", "Clients"), summary.data.practiceData.clients],
              [t("migrationArchive.snapshot.patients", "Patients"), summary.data.practiceData.patients],
              [t("migrationArchive.snapshot.openReminders", "Open reminders"), summary.data.practiceData.openReminders],
              [t("migrationArchive.snapshot.services", "Services"), summary.data.practiceData.services],
              [t("migrationArchive.snapshot.products", "Products"), summary.data.practiceData.products],
            ].map(([label, value]) => (
              <Card key={String(label)}>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {metric(value as number)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {summary.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-lg border border-border bg-muted/40"
            />
          ))}
        </div>
      ) : summary.error ? (
        <EmptyState
          icon={AlertTriangle}
          title={t("migrationArchive.summary.loadError", "Could not load the archive summary")}
          description={summary.error.message}
          action={{ label: "Retry", onClick: () => summary.refetch() }}
        />
      ) : (
        <section
          aria-label="Imported history totals"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {summaryCards.map((card) => (
            <Card key={card.label}>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {metric(card.value)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {card.note}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle>{t("migrationArchive.browser.title", "Browse imported records")}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("migrationArchive.browser.description", "Search by the clinic-facing names and labels already stored in this practice. Source identifiers stay out of the interface.")}
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Imported history sections"
            className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1"
          >
            {sections.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={section === item.id}
                aria-controls="archive-records"
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  section === item.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setSection(item.id)}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {t(item.labelKey, item.label)}
              </button>
            ))}
          </div>
          <div className="relative max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              aria-label={`Search ${activeSection.label.toLowerCase()}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("migrationArchive.browser.searchPlaceholder", `Search ${activeSection.label.toLowerCase()}`, { section: t(activeSection.labelKey, activeSection.label) })}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div
            id="archive-records"
            role="tabpanel"
            className={cn(
              "grid gap-5",
              selectedId && canExpand
                ? "xl:grid-cols-[minmax(0,1fr)_24rem]"
                : "",
            )}
          >
            <div className="min-w-0 space-y-3">
              {list.isLoading ? (
                <div className="flex items-center gap-2 rounded-lg border border-border p-5 text-sm text-muted-foreground">
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  {t("migrationArchive.browser.loading", `Loading ${activeSection.label.toLowerCase()}…`, { section: t(activeSection.labelKey, activeSection.label) })}
                </div>
              ) : list.error ? (
                <EmptyState
                  icon={AlertTriangle}
                  title={t("migrationArchive.browser.loadError", `Could not load ${activeSection.label.toLowerCase()}`, { section: t(activeSection.labelKey, activeSection.label) })}
                  description={list.error.message}
                  action={{ label: "Retry", onClick: () => list.refetch() }}
                />
              ) : list.data?.items.length === 0 ? (
                <EmptyState
                  icon={activeSection.icon}
                  title={query ? t("migrationArchive.browser.noMatching", "No matching records") : t("migrationArchive.browser.nothingImported", "Nothing imported yet")}
                  description={
                    query
                      ? t("migrationArchive.browser.tryBroader", "Try a broader search term.")
                      : t("migrationArchive.browser.noSectionAdded", `No ${activeSection.label.toLowerCase()} have been added to this archive.`, { section: t(activeSection.labelKey, activeSection.label) })
                  }
                />
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {list.data?.items.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        "p-4 transition-colors",
                        selectedId === item.id ? "bg-primary/5" : "bg-card",
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{item.title}</p>
                            <Badge
                              variant={
                                item.needsReview ? "destructive" : "secondary"
                              }
                            >
                              {item.needsReview
                                ? t("migrationArchive.browser.needsReview", "Needs review")
                                : titleCase(item.status)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.subtitle}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{formatDate(item.date)}</span>
                            {item.meta.map((part, index) => (
                              <span
                                key={`${item.id}:meta:${index}`}
                                className="truncate"
                              >
                                {part}
                              </span>
                            ))}
                          </div>
                          {item.patientId || item.clientId ? (
                            <div className="mt-3 flex flex-wrap gap-3 text-sm">
                              {item.patientId ? (
                                <Link
                                  href={`/patients/${item.patientId}`}
                                  className="font-medium text-primary underline-offset-4 hover:underline"
                                >
                                  {t("migrationArchive.browser.openPatient", "Open patient")}
                                </Link>
                              ) : null}
                              {item.clientId ? (
                                <Link
                                  href={`/clients/${item.clientId}`}
                                  className="font-medium text-primary underline-offset-4 hover:underline"
                                >
                                  {t("migrationArchive.browser.openClient", "Open client")}
                                </Link>
                              ) : null}
                            </div>
                          ) : null}
                          {item.fileUrl ? (
                            <div className="mt-3">
                              <Link
                                href={item.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-9 items-center font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              >
                                {t("migrationArchive.browser.openDocument", "Open document")}
                              </Link>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                          {item.amount != null ? (
                            <div className="text-right text-sm tabular-nums">
                              <p className="font-semibold">
                                {formatCurrency(item.amount)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t("migrationArchive.browser.balance", `${formatCurrency(item.balance)} balance`, { amount: formatCurrency(item.balance) })}
                              </p>
                            </div>
                          ) : null}
                          {canExpand ? (
                            <Button
                              size="sm"
                              variant={
                                selectedId === item.id ? "secondary" : "outline"
                              }
                              aria-expanded={selectedId === item.id}
                              onClick={() =>
                                setSelectedId((current) =>
                                  current === item.id ? null : item.id,
                                )
                              }
                            >
                              {selectedId === item.id
                                ? t("migrationArchive.browser.closeDetails", "Close details")
                                : t("migrationArchive.browser.viewDetails", "View details")}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {list.data && list.data.total > 0 ? (
                <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {t("migrationArchive.browser.showing", `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, list.data.total)} of ${metric(list.data.total)}`, {
                      from: page * PAGE_SIZE + 1,
                      to: Math.min((page + 1) * PAGE_SIZE, list.data.total),
                      total: metric(list.data.total),
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page === 0}
                      onClick={() =>
                        setPage((current) => Math.max(0, current - 1))
                      }
                    >
                      <ChevronLeft
                        className="mr-1 h-4 w-4"
                        aria-hidden="true"
                      />
                      {t("migrationArchive.browser.previous", "Previous")}
                    </Button>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {page + 1} / {totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page + 1 >= totalPages}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      {t("migrationArchive.browser.next", "Next")}
                      <ChevronRight
                        className="ml-1 h-4 w-4"
                        aria-hidden="true"
                      />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            {selectedId && canExpand ? (
              <aside aria-label="Imported record details" className="min-w-0">
                <Card className="sticky top-4">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ClipboardList className="h-4 w-4" aria-hidden="true" />
                      {t("migrationArchive.detail.sourceDetail", "Source detail")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ArchiveDetail
                      data={detail.data}
                      isLoading={detail.isLoading}
                      errorMessage={detail.error?.message}
                      formatCurrency={formatCurrency}
                    />
                  </CardContent>
                </Card>
              </aside>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="archive-boundaries-heading">
        <Card>
          <CardHeader>
            <CardTitle id="archive-boundaries-heading">
              {t("migrationArchive.behavior.title", "How imported records behave")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 text-sm md:grid-cols-3">
            <div>
              <p className="font-medium">
                {t("migrationArchive.behavior.readyAsHistory", "Ready as history")}
              </p>
              <p className="mt-1 leading-6 text-muted-foreground">
                {t(
                  "migrationArchive.behavior.readyAsHistoryDetail",
                  "Prior appointments, prescriptions, fills, lab reports, and financial documents are searchable reference records. They do not become upcoming visits, active prescriptions, or current receivables.",
                )}
              </p>
            </div>
            <div>
              <p className="font-medium">
                {t("migrationArchive.behavior.reviewBeforeRelying", "Review before relying on it")}
              </p>
              <p className="mt-1 leading-6 text-muted-foreground">
                {t(
                  "migrationArchive.behavior.reviewBeforeRelyingDetail",
                  "Items marked Needs review lack an exact source relationship. Verify the clinic, client, or patient match before using them for care or business decisions.",
                )}
              </p>
            </div>
            <div>
              <p className="font-medium">
                {t("migrationArchive.behavior.neverRestoredAutomatically", "Never restored automatically")}
              </p>
              <p className="mt-1 leading-6 text-muted-foreground">
                {t(
                  "migrationArchive.behavior.neverRestoredAutomaticallyDetail",
                  "Staff access, passwords, messaging consent, send queues, accounts-receivable balances, and stock counts require a fresh OpenVPM decision or reviewed opening value.",
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ArchiveDetail({
  data,
  isLoading,
  errorMessage,
  formatCurrency,
}: {
  data: ArchiveDetailData | undefined;
  isLoading: boolean;
  errorMessage?: string;
  formatCurrency: (value: string | number | null | undefined) => string;
}) {
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("migrationArchive.detail.loading", "Loading detail…")}
      </div>
    );
  }
  if (errorMessage || !data) {
    return (
      <p className="text-sm text-destructive">
        {errorMessage ?? t("migrationArchive.detail.unavailable", "Detail is unavailable.")}
      </p>
    );
  }
  if (data.kind === "medications") {
    return (
      <div className="space-y-4 text-sm">
        <div>
          <p className="font-medium">{data.record.medicationName}</p>
          <p className="text-muted-foreground">{data.record.patientName}</p>
        </div>
        {data.record.directions ? (
          <p className="rounded-md bg-muted p-3 leading-6">
            {data.record.directions}
          </p>
        ) : null}
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("migrationArchive.detail.quantity", "Quantity")}
            </dt>
            <dd>{data.record.quantity ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("migrationArchive.detail.refillsWritten", "Refills written")}
            </dt>
            <dd>{data.record.refillCount ?? "—"}</dd>
          </div>
        </dl>
        <div>
          <p className="font-medium">
            {t("migrationArchive.detail.fillHistory", "Fill history")}
          </p>
          {data.entries.length ? (
            <ul className="mt-2 divide-y divide-border rounded-md border border-border">
              {data.entries.map((entry) => (
                <li key={entry.id} className="p-3">
                  <p>
                    {entry.occurredAt
                      ? formatDate(entry.occurredAt.toISOString())
                      : t("migrationArchive.detail.dateUnavailable", "Date unavailable")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.quantity
                      ? `${t("migrationArchive.detail.quantity", "Quantity")} ${entry.quantity}`
                      : t("migrationArchive.detail.quantityUnavailable", "Quantity unavailable")}
                    {entry.status ? ` · ${entry.status}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-muted-foreground">
              {t("migrationArchive.detail.noFills", "No fills in the source export.")}
            </p>
          )}
        </div>
      </div>
    );
  }
  if (data.kind === "labs") {
    return (
      <div className="space-y-4 text-sm">
        <div>
          <p className="font-medium">
            {data.record.title ?? t("migrationArchive.detail.importedLabReport", "Imported lab report")}
          </p>
          <p className="text-muted-foreground">
            {data.record.patientName ?? t("migrationArchive.detail.patientMatchNeedsReview", "Patient match needs review")}
          </p>
        </div>
        {data.record.summary ? (
          <p className="leading-6">{data.record.summary}</p>
        ) : null}
        {data.entries.length ? (
          <ul className="divide-y divide-border rounded-md border border-border">
            {data.entries.map((entry) => (
              <li key={entry.id} className="flex justify-between gap-3 p-3">
                <span>{entry.name}</span>
                <span className="text-right font-medium">
                  {[entry.value, entry.unit].filter(Boolean).join(" ") || "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-border p-3 text-muted-foreground">
            {t(
              "migrationArchive.detail.unstructuredLabNotice",
              "The source supplied this as an unstructured report. Its verified document is preserved separately.",
            )}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="font-medium">
          {data.record.documentNumber ?? titleCase(data.record.documentType)}
        </p>
        <p className="text-muted-foreground">{data.record.clientName}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">
            {t("migrationArchive.detail.total", "Total")}
          </dt>
          <dd className="font-medium">{formatCurrency(data.record.total)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            {t("migrationArchive.detail.historicalBalance", "Historical balance")}
          </dt>
          <dd className="font-medium">{formatCurrency(data.record.balance)}</dd>
        </div>
      </dl>
      <div>
        <p className="font-medium">
          {t("migrationArchive.detail.lineItems", "Line items")}
        </p>
        <ul className="mt-2 divide-y divide-border rounded-md border border-border">
          {data.entries.map((entry) => (
            <li key={entry.id} className="flex justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="break-words">{entry.description}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.quantity} × {formatCurrency(entry.unitPrice)}
                </p>
              </div>
              <span className="shrink-0 font-medium">
                {formatCurrency(entry.total)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {data.allocations.length ? (
        <div>
          <p className="font-medium">
            {t("migrationArchive.detail.paymentAllocations", "Payment allocations")}
          </p>
          <ul className="mt-2 space-y-2 text-muted-foreground">
            {data.allocations.map((allocation) => (
              <li key={allocation.id}>
                {formatCurrency(allocation.amount)} ·{" "}
                {formatDate(
                  (
                    allocation.allocatedAt ?? allocation.paymentReceivedAt
                  ).toISOString(),
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
