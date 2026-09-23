"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  FilePlus2,
  Filter,
  Pill,
  Search,
  ShieldAlert,
  Stethoscope,
  Syringe,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatClinicalDate } from "@/lib/records/clinical-dates";
import { PATIENT_SPECIES_OPTIONS, formatSpecies } from "@/lib/patients/species";
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
  DataTableSelect,
  DataTableShell,
  DataTableTab,
  DataTableTabs,
  DataTableToolbar,
  IdentityCell,
  SpeciesIcon,
} from "@/components/common/data-table";

type FocusKey = "all" | "attention" | "recent";
type StatusKey = "active" | "inactive" | "deceased" | "all";

function isOverdue(dateValue: string | null | undefined): boolean {
  if (!dateValue) return false;
  const due = new Date(dateValue);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < new Date().setHours(0, 0, 0, 0);
}

/**
 * Register-first clinical chart.
 *
 * Before: the page opened with an empty search box — no list of the charts the
 * clinic actually keeps, no way to spot the ones that need attention.
 * Now: every clinical card is a row; search only narrows an existing list.
 */
export function ClinicalCardsRegister() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [species, setSpecies] = useState("");
  const [status, setStatus] = useState<StatusKey>("active");
  const [focus, setFocus] = useState<FocusKey>("all");

  const summaryQuery = trpc.extensions.clinicalRegister.summary.useQuery(
    undefined,
    { refetchInterval: 60_000 },
  );

  const cardsQuery = trpc.extensions.clinicalRegister.listCards.useQuery({
    search: search.trim() || undefined,
    species: species || undefined,
    status,
    focus,
    limit: 100,
    offset: 0,
  });

  const cards = useMemo(() => cardsQuery.data?.items ?? [], [cardsQuery.data]);
  const total = cardsQuery.data?.total ?? 0;
  const summary = summaryQuery.data;

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString("sk-SK", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("records.register.title", "Klinické karty")}
        subtitle={t(
          "records.register.subtitle",
          "Zoznam všetkých klinických kariet s aktivitou, liečbou a upozorneniami. Kliknutím otvoríte kartu pacienta.",
        )}
        actions={
          <Button variant="outline" className="gap-1.5" asChild>
            <Link href="/encounters">
              <Stethoscope className="h-4 w-4 text-primary" />
              {t("records.register.toEncounters", "Vyšetrenia dnes")}
            </Link>
          </Button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-border bg-card/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {t("records.register.kpiPatients", "Aktívne karty")}
              </span>
              <ClipboardList className="h-4 w-4 text-primary/70" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {summary?.patientCount ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {t("records.register.kpiPrescriptions", "Na liečbe")}
              </span>
              <Pill className="h-4 w-4 text-sky-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {summary?.withActivePrescriptions ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {t("records.register.kpiProblems", "Otvorené diagnózy")}
              </span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {summary?.withOpenProblems ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {t("records.register.kpiAlerts", "Upozornenia strážcu")}
              </span>
              <ShieldAlert className="h-4 w-4 text-destructive" />
            </div>
            <p
              className={cn(
                "mt-2 text-2xl font-bold tracking-tight",
                (summary?.withOpenAlerts ?? 0) > 0
                  ? "text-destructive"
                  : "text-muted-foreground/70",
              )}
            >
              {summary?.withOpenAlerts ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <DataTableToolbar>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DataTableTabs>
            <DataTableTab
              active={focus === "all"}
              onClick={() => setFocus("all")}
              icon={<ClipboardList className="h-3.5 w-3.5" />}
            >
              {t("records.register.tabAll", "Všetky karty")}
            </DataTableTab>
            <DataTableTab
              active={focus === "attention"}
              onClick={() => setFocus("attention")}
              icon={<ShieldAlert className="h-3.5 w-3.5" />}
            >
              {t("records.register.tabAttention", "Vyžadujú pozornosť")}
            </DataTableTab>
            <DataTableTab
              active={focus === "recent"}
              onClick={() => setFocus("recent")}
              icon={<CalendarClock className="h-3.5 w-3.5" />}
            >
              {t("records.register.tabRecent", "Aktivita 30 dní")}
            </DataTableTab>
          </DataTableTabs>
          <span className="text-xs text-muted-foreground">
            {t("records.register.rowCount", "{count} kariet", { count: total })}
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <DataTableSearchInput
              placeholder={t(
                "records.register.searchPlaceholder",
                "Filtrovať karty podľa pacienta, majiteľa alebo čipu...",
              )}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
            <DataTableSelect
              value={species}
              onChange={(event) => setSpecies(event.target.value)}
              aria-label={t("records.register.filterSpecies", "Druh")}
            >
              <option value="">
                {t("records.register.allSpecies", "Všetky druhy")}
              </option>
              {PATIENT_SPECIES_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {formatSpecies(option.value, t)}
                </option>
              ))}
            </DataTableSelect>
            <DataTableSelect
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusKey)}
              aria-label={t("records.register.filterStatus", "Stav karty")}
            >
              <option value="active">
                {t("records.register.statusActive", "Aktívne")}
              </option>
              <option value="inactive">
                {t("records.register.statusInactive", "Neaktívne")}
              </option>
              <option value="deceased">
                {t("records.register.statusDeceased", "Zosnulé")}
              </option>
              <option value="all">
                {t("records.register.statusAll", "Všetky stavy")}
              </option>
            </DataTableSelect>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Syringe className="h-3 w-3" />
              {t("records.register.legendOverdue", "prepadnutá vakcinácia")}
            </span>
          </div>
        </div>
      </DataTableToolbar>

      {/* Register */}
      <DataTableShell>
        {cardsQuery.isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={6} cols={7} />
          </div>
        ) : cards.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={ClipboardList}
              title={
                search.trim()
                  ? t(
                      "records.register.emptyFilterTitle",
                      "Žiadna karta nezodpovedá filtru",
                    )
                  : t(
                      "records.register.emptyTitle",
                      "Zatiaľ žiadne klinické karty",
                    )
              }
              description={
                search.trim()
                  ? t(
                      "records.register.emptyFilterDescription",
                      "Zrušte vyhľadávanie alebo zmeňte filtre.",
                    )
                  : t(
                      "records.register.emptyDescription",
                      "Karta vznikne s prvým pacientom — vitálne funkcie, SOAP záznam, očkovanie alebo predpis.",
                    )
              }
            />
          </div>
        ) : (
          <DataTableScroll>
            <DataTable>
              <DataTableHead>
                <DataTableHeaderRow>
                  <DataTableHeadCell>
                    {t("records.register.colPatient", "Pacient")}
                  </DataTableHeadCell>
                  <DataTableHeadCell>
                    {t("records.register.colOwner", "Majiteľ")}
                  </DataTableHeadCell>
                  <DataTableHeadCell>
                    {t("records.register.colLastVisit", "Posledná návšteva")}
                  </DataTableHeadCell>
                  <DataTableHeadCell align="center">
                    {t("records.register.colSoap", "SOAP")}
                  </DataTableHeadCell>
                  <DataTableHeadCell>
                    {t("records.register.colProblems", "Diagnózy")}
                  </DataTableHeadCell>
                  <DataTableHeadCell>
                    {t("records.register.colPrescriptions", "Liečba")}
                  </DataTableHeadCell>
                  <DataTableHeadCell>
                    {t("records.register.colVaccination", "Vakcinácia")}
                  </DataTableHeadCell>
                  <DataTableHeadCell align="right">
                    {t("records.register.colActions", "Akcie")}
                  </DataTableHeadCell>
                </DataTableHeaderRow>
              </DataTableHead>
              <DataTableBody>
                {cards.map((card) => {
                  const ownerName =
                    [card.clientFirstName, card.clientLastName]
                      .filter(Boolean)
                      .join(" ")
                      .trim() ||
                    t("records.register.noOwner", "Majiteľ neuvedený");
                  const lastVisit = formatDateTime(card.lastVisitAt);
                  const vaccinationOverdue =
                    Number(card.overdueVaccinationCount ?? 0) > 0;
                  const alerts = Number(card.openAlertCount ?? 0);

                  return (
                    <DataTableRow
                      key={card.patientId}
                      tone={
                        alerts > 0
                          ? "danger"
                          : vaccinationOverdue
                            ? "waiting"
                            : "none"
                      }
                      interactive
                      onClick={() => {
                        window.location.assign(
                          `/records?patientId=${encodeURIComponent(card.patientId)}`,
                        );
                      }}
                    >
                      <DataTableCell>
                        <IdentityCell
                          icon={
                            <SpeciesIcon
                              species={card.species}
                              label={formatSpecies(card.species, t)}
                            />
                          }
                          primary={
                            <span className="flex items-center gap-1.5">
                              {card.name}
                              {alerts > 0 ? (
                                <Badge
                                  variant="destructive"
                                  className="h-4 gap-1 px-1.5 text-[10px]"
                                >
                                  <ShieldAlert className="h-2.5 w-2.5" />
                                  {alerts}
                                </Badge>
                              ) : null}
                              {card.status !== "active" ? (
                                <Badge
                                  variant="outline"
                                  className="h-4 px-1.5 text-[10px] text-muted-foreground"
                                >
                                  {card.status === "deceased"
                                    ? t(
                                        "records.register.statusDeceasedShort",
                                        "zosnulé",
                                      )
                                    : t(
                                        "records.register.statusInactiveShort",
                                        "neaktívne",
                                      )}
                                </Badge>
                              ) : null}
                            </span>
                          }
                          secondary={[
                            card.breed,
                            formatSpecies(card.species, t),
                            card.microchipNumber
                              ? t(
                                  "records.register.chip",
                                  "čip {chip}",
                                  { chip: card.microchipNumber },
                                )
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        />
                      </DataTableCell>

                      <DataTableCell>
                        <div className="text-xs font-medium text-foreground">
                          {ownerName}
                        </div>
                        {card.clientPhone ? (
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {card.clientPhone}
                          </div>
                        ) : null}
                      </DataTableCell>

                      <DataTableCell>
                        {lastVisit ? (
                          <>
                            <div className="text-xs text-foreground">
                              {lastVisit}
                            </div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              {card.lastVisitAuthor ??
                                t("records.register.unknownAuthor", "—")}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t("records.register.noVisit", "Bez záznamu")}
                          </span>
                        )}
                      </DataTableCell>

                      <DataTableCell align="center">
                        <span className="font-mono text-xs tabular-nums text-foreground">
                          {card.soapNoteCount}
                        </span>
                      </DataTableCell>

                      <DataTableCell>
                        {card.activeProblemCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {card.activeProblemCount}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </DataTableCell>

                      <DataTableCell>
                        {card.activePrescriptionCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-sky-700 dark:text-sky-300">
                            <Pill className="h-3.5 w-3.5" />
                            {card.activePrescriptionCount}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </DataTableCell>

                      <DataTableCell>
                        {vaccinationOverdue ? (
                          <Badge
                            variant="warning"
                            className="gap-1 text-[11px]"
                          >
                            <Syringe className="h-3 w-3" />
                            {t("records.register.vaccinationOverdue", "Po termíne")}
                            <CountPill tone="warning">
                              {card.overdueVaccinationCount}
                            </CountPill>
                          </Badge>
                        ) : card.nextVaccinationDue ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Syringe className="h-3.5 w-3.5" />
                            {formatClinicalDate(card.nextVaccinationDue)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </DataTableCell>

                      <DataTableCell align="right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            asChild
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Link
                              href={`/records?patientId=${encodeURIComponent(card.patientId)}`}
                            >
                              {t("records.register.openCard", "Karta")}
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1.5"
                            asChild
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Link href={`/records/new-soap/${card.patientId}`}>
                              <FilePlus2 className="h-3.5 w-3.5" />
                              {t("records.register.newSoap", "Nový SOAP")}
                            </Link>
                          </Button>
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
