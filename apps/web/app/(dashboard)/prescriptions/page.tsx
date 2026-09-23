"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CircleSlash,
  Filter,
  Pill,
  Search,
  ShieldAlert,
  ShieldCheck,
  Syringe,
  TriangleAlert,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatClinicalDate } from "@/lib/records/clinical-dates";
import { formatSpecies } from "@/lib/patients/species";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TableSkeleton } from "@/components/common/loading";
import { EmptyState } from "@/components/common/empty-state";
import {
  CountPill,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeadCell,
  DataTableHeaderRow,
  DataTableRow,
  DataTableScroll,
  DataTableSearchInput,
  DataTableShell,
  DataTableTab,
  DataTableTabs,
  DataTableToolbar,
  IdentityCell,
  SpeciesIcon,
} from "@/components/common/data-table";

type ScopeKey =
  | "active"
  | "ending"
  | "overdue"
  | "controlled"
  | "alerts"
  | "all";

const scopeIcons: Record<ScopeKey, React.ElementType> = {
  active: Pill,
  ending: CalendarClock,
  overdue: CircleSlash,
  controlled: ShieldAlert,
  alerts: TriangleAlert,
  all: Filter,
};

/**
 * Medication oversight — the register the clinic was missing.
 *
 * Clinical Guardian already evaluates every prescription, but its alerts only
 * surfaced on the dashboard. Here the prescriptions themselves are the list —
 * with the guardian alerts, OPL flags and cross-prescription interactions
 * attached to the row that causes them.
 */
export default function MedicationOversightPage() {
  const { t } = useI18n();
  const [scope, setScope] = useState<ScopeKey>("active");
  const [search, setSearch] = useState("");

  const summaryQuery = trpc.extensions.medicationOversight.summary.useQuery(
    undefined,
    { refetchInterval: 60_000 },
  );

  const listQuery = trpc.extensions.medicationOversight.list.useQuery({
    scope,
    search: search.trim() || undefined,
    limit: 200,
    offset: 0,
  });

  const summary = summaryQuery.data;
  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);
  const total = listQuery.data?.total ?? 0;
  const endingSoonDays = listQuery.data?.endingSoonDays ?? 7;

  const scopeCounts: Record<ScopeKey, number> = {
    active: summary?.active ?? 0,
    ending: summary?.endingSoon ?? 0,
    overdue: summary?.overdue ?? 0,
    controlled: summary?.controlledActive ?? 0,
    alerts:
      (summary?.openMedicationAlerts ?? 0) + (summary?.criticalAlerts ?? 0),
    all: 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Pill}
        title={t(
          "medications.title",
          "Dohľad nad predpísanými liečivami",
        )}
        subtitle={t(
          "medications.subtitle",
          "Všetky predpisy na jednom mieste — stav liečby, OPL, končiace a prepadnuté dávky, interakcie a upozornenia klinického strážcu.",
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link href="/controlled-substances">
                <ShieldAlert className="h-4 w-4 text-primary" />
                {t("medications.toControlled", "Kniha OPL")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link href="/records">
                <Pill className="h-4 w-4 text-primary" />
                {t("medications.toRecords", "Klinické karty")}
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-border bg-card/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {t("medications.kpiActive", "Aktívne predpisy")}
              </span>
              <Pill className="h-4 w-4 text-sky-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {summary?.active ?? "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("medications.kpiActivePatients", "{count} pacientov", {
                count: summary?.patientsWithActive ?? 0,
              })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {t("medications.kpiEnding", "Končia do {days} dní", {
                  days: endingSoonDays,
                })}
              </span>
              <CalendarClock className="h-4 w-4 text-amber-500" />
            </div>
            <p
              className={cn(
                "mt-2 text-2xl font-bold tracking-tight",
                (summary?.endingSoon ?? 0) > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground/60",
              )}
            >
              {summary?.endingSoon ?? "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("medications.kpiEndingHint", "naplánujte kontrolu")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {t("medications.kpiOverdue", "Po termíne")}
              </span>
              <CircleSlash className="h-4 w-4 text-destructive" />
            </div>
            <p
              className={cn(
                "mt-2 text-2xl font-bold tracking-tight",
                (summary?.overdue ?? 0) > 0
                  ? "text-destructive"
                  : "text-muted-foreground/60",
              )}
            >
              {summary?.overdue ?? "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("medications.kpiOverdueHint", "ukončite alebo predĺžte liečbu")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {t("medications.kpiGuardian", "Strážca liekov")}
              </span>
              {(summary?.criticalAlerts ?? 0) > 0 ? (
                <ShieldAlert className="h-4 w-4 text-destructive" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              )}
            </div>
            <p
              className={cn(
                "mt-2 text-2xl font-bold tracking-tight",
                (summary?.criticalAlerts ?? 0) > 0
                  ? "text-destructive"
                  : "text-foreground",
              )}
            >
              {(summary?.openMedicationAlerts ?? 0) +
                (summary?.criticalAlerts ?? 0)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("medications.kpiGuardianHint", "{count} kritických", {
                count: summary?.criticalAlerts ?? 0,
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <DataTableToolbar>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DataTableTabs>
            {(Object.keys(scopeIcons) as ScopeKey[]).map((key) => {
              const Icon = scopeIcons[key];
              const label: Record<ScopeKey, string> = {
                active: t("medications.scopeActive", "Aktívne"),
                ending: t("medications.scopeEnding", "Končiace"),
                overdue: t("medications.scopeOverdue", "Po termíne"),
                controlled: t("medications.scopeControlled", "OPL"),
                alerts: t("medications.scopeAlerts", "Upozornenia"),
                all: t("medications.scopeAll", "Všetky"),
              };
              return (
                <DataTableTab
                  key={key}
                  active={scope === key}
                  onClick={() => setScope(key)}
                  icon={<Icon className="h-3.5 w-3.5" />}
                >
                  {label[key]}
                  {scopeCounts[key] > 0 ? (
                    <CountPill
                      tone={
                        key === "overdue" || key === "alerts"
                          ? "danger"
                          : key === "ending"
                            ? "warning"
                            : "accent"
                      }
                    >
                      {scopeCounts[key]}
                    </CountPill>
                  ) : null}
                </DataTableTab>
              );
            })}
          </DataTableTabs>
          <span className="text-xs text-muted-foreground">
            {t("medications.rowCount", "{count} predpisov", { count: total })}
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <DataTableSearchInput
              placeholder={t(
                "medications.searchPlaceholder",
                "Filtrovať podľa lieku, pacienta alebo majiteľa...",
              )}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ShieldAlert className="h-3 w-3 text-destructive" />
              {t("medications.legendOpl", "omamná látka (Zákon 139/1998)")}
            </span>
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              {t("medications.legendInteraction", "interakcia v liečbe")}
            </span>
            <span className="inline-flex items-center gap-1">
              <Activity className="h-3 w-3 text-sky-500" />
              {t("medications.legendGuardian", "upozornenie strážcu")}
            </span>
          </div>
        </div>
      </DataTableToolbar>

      {/* Register */}
      <DataTableShell>
        {listQuery.isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={6} cols={7} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Pill}
              title={t("medications.emptyTitle", "Žiadne predpisy v tomto filtri")}
              description={t(
                "medications.emptyDescription",
                "Predpisy sa vystavujú v klinickej karte pacienta (záložka Predpisy) alebo počas vyšetrenia.",
              )}
            />
          </div>
        ) : (
          <DataTableScroll>
            <DataTable>
              <DataTableHead>
                <DataTableHeaderRow>
                  <DataTableHeadCell>
                    {t("medications.colPatient", "Pacient")}
                  </DataTableHeadCell>
                  <DataTableHeadCell>
                    {t("medications.colMedication", "Liečivo")}
                  </DataTableHeadCell>
                  <DataTableHeadCell>
                    {t("medications.colPrescriber", "Predpísal")}
                  </DataTableHeadCell>
                  <DataTableHeadCell>
                    {t("medications.colPeriod", "Obdobie liečby")}
                  </DataTableHeadCell>
                  <DataTableHeadCell align="right">
                    {t("medications.colQuantity", "Množstvo")}
                  </DataTableHeadCell>
                  <DataTableHeadCell>
                    {t("medications.colOversight", "Dohľad")}
                  </DataTableHeadCell>
                  <DataTableHeadCell align="right">
                    {t("medications.colActions", "Akcie")}
                  </DataTableHeadCell>
                </DataTableHeaderRow>
              </DataTableHead>
              <DataTableBody>
                {items.map((row) => {
                  const ownerName =
                    [row.clientFirstName, row.clientLastName]
                      .filter(Boolean)
                      .join(" ")
                      .trim() ||
                    t("medications.noOwner", "Majiteľ neuvedený");
                  const overdue =
                    row.status === "active" &&
                    row.endDate != null &&
                    new Date(row.endDate).getTime() <
                      new Date().setHours(0, 0, 0, 0);
                  const interactionTone =
                    row.maxInteractionSeverity === "major"
                      ? "danger"
                      : row.maxInteractionSeverity
                        ? "warning"
                        : "neutral";

                  return (
                    <DataTableRow
                      key={row.id}
                      tone={
                        row.criticalAlertCount > 0
                          ? "danger"
                          : overdue
                            ? "waiting"
                            : "none"
                      }
                    >
                      <DataTableCell>
                        <IdentityCell
                          icon={
                            <SpeciesIcon
                              species={row.patientSpecies}
                              label={formatSpecies(row.patientSpecies, t)}
                            />
                          }
                          primary={
                            <Link
                              href={`/records?patientId=${encodeURIComponent(row.patientId)}&tab=prescriptions`}
                              className="transition-colors hover:text-primary"
                            >
                              {row.patientName}
                            </Link>
                          }
                          secondary={ownerName}
                        />
                      </DataTableCell>

                      <DataTableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">
                            {row.medicationName}
                          </span>
                          {row.isControlled ? (
                            <Badge
                              variant="destructive"
                              className="h-4 gap-1 px-1.5 text-[10px]"
                            >
                              <ShieldAlert className="h-2.5 w-2.5" />
                              OPL
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {[row.dosage, row.frequency]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </div>
                      </DataTableCell>

                      <DataTableCell>
                        <div className="text-xs text-foreground">
                          {row.prescribedByName ??
                            t("medications.unknownPrescriber", "—")}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatClinicalDate(row.startDate)}
                        </div>
                      </DataTableCell>

                      <DataTableCell>
                        <div className="font-mono text-xs tabular-nums text-foreground">
                          {formatClinicalDate(row.startDate)} →{" "}
                          {row.endDate
                            ? formatClinicalDate(row.endDate)
                            : t("medications.openEnded", "neurčito")}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {overdue
                            ? t("medications.overdueHint", "Liečba mala skončiť")
                            : row.status === "active"
                              ? t("medications.statusActive", "Prebieha")
                              : row.status}
                        </div>
                      </DataTableCell>

                      <DataTableCell align="right" numeric>
                        <div className="text-xs">
                          {row.quantity != null ? row.quantity : "—"}
                        </div>
                        {row.refillsRemaining > 0 ? (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {t("medications.refills", "+{count} opakovaní", {
                              count: row.refillsRemaining,
                            })}
                          </div>
                        ) : null}
                      </DataTableCell>

                      <DataTableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          {row.openAlertCount > 0 ? (
                            <Badge
                              variant={
                                row.criticalAlertCount > 0
                                  ? "destructive"
                                  : "warning"
                              }
                              className="h-5 gap-1 px-1.5 text-[10px]"
                            >
                              <Activity className="h-2.5 w-2.5" />
                              {t("medications.guardianBadge", "{count}× strážca", {
                                count: row.openAlertCount,
                              })}
                            </Badge>
                          ) : null}
                          {row.interactionCount > 0 ? (
                            <Badge
                              variant={
                                interactionTone === "danger"
                                  ? "destructive"
                                  : "warning"
                              }
                              className="h-5 gap-1 px-1.5 text-[10px]"
                              title={row.interactionDetail ?? undefined}
                            >
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {t(
                                "medications.interactionBadge",
                                "{count}× interakcia",
                                { count: row.interactionCount },
                              )}
                            </Badge>
                          ) : null}
                          {row.status !== "active" ? (
                            <Badge
                              variant="outline"
                              className="h-5 px-1.5 text-[10px] text-muted-foreground"
                            >
                              {row.status}
                            </Badge>
                          ) : null}
                        </div>
                      </DataTableCell>

                      <DataTableCell align="right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            asChild
                          >
                            <Link
                              href={`/records?patientId=${encodeURIComponent(row.patientId)}&tab=prescriptions`}
                            >
                              {t("medications.openCard", "Karta")}
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          {row.appointmentId ? (
                            <Button size="sm" className="gap-1.5" asChild>
                              <Link href={`/encounters/${row.appointmentId}`}>
                                <Syringe className="h-3.5 w-3.5" />
                                {t("medications.openVisit", "Vyšetrenie")}
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </DataTableScroll>
        )}
      </DataTableShell>
    </div>
  );
}
