"use client";

import { formatDateToDisplay } from "@/lib/date-display";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Syringe,
  BellRing,
  BookOpen,
  Search,
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquare,
  Send,
  ExternalLink,
  Plus,
  PawPrint,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader, PageSectionHeader } from "@/components/layout/page-header";
import {
  DataTableFrame,
  PageToolbar,
  SearchField,
  pageShellClass,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
  underlineTabsListClass,
  underlineTabsTriggerClass,
} from "@/components/layout/page-kit";

const MAX_BATCH_SIZE = 100;

/** Tab panel rhythm: section header → toolbar → table card. */
const TAB_PANEL = "mt-0 space-y-4";

/** Microchips, batch (lot) numbers and dates: monospaced tabular numerals. */
const NUMERIC = "font-mono text-[11px] tabular-nums";

function canOperateRecalls(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian" || role === "front_desk";
}



export default function VaccinationsPage() {
  const { t } = useI18n();
  const { data: session, status: sessionStatus } = useSession();
  const canOperate = canOperateRecalls(session?.user?.role);
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<"recalls" | "rabies" | "search">("recalls");

  // --- Recalls state ---
  const preview = trpc.notifications.getVaccinationRecallPreview.useQuery(
    undefined,
    { enabled: sessionStatus === "authenticated" && canOperate },
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const eligibleRecipients = useMemo(
    () =>
      preview.data?.recipients.filter(
        (recipient) => recipient.status === "eligible",
      ) ?? [],
    [preview.data],
  );

  const selectedEligibleIds = eligibleRecipients
    .map((recipient) => recipient.patientId)
    .filter((patientId) => selected.has(patientId))
    .slice(0, MAX_BATCH_SIZE);

  const allEligibleSelected =
    eligibleRecipients.length > 0 &&
    eligibleRecipients
      .slice(0, MAX_BATCH_SIZE)
      .every((recipient) => selected.has(recipient.patientId));

  const sendReminders = trpc.notifications.sendVaccinationReminders.useMutation({
    onSuccess: async (result) => {
      setSelected(new Set());
      await utils.notifications.getVaccinationRecallPreview.invalidate();
      const summary = [
        t("recalls.sentSummary", "{count} odoslaných", { count: result.sent }),
        result.deduped
          ? t("recalls.dedupedSummary", "{count} už spracovaných", {
              count: result.deduped,
            })
          : null,
        result.blocked
          ? t("recalls.blockedSummary", "{count} zablokovaných", {
              count: result.blocked,
            })
          : null,
        result.failed
          ? t("recalls.failedSummary", "{count} zlyhaných", {
              count: result.failed,
            })
          : null,
      ]
        .filter(Boolean)
        .join(" · ");
      if (result.failed > 0) toast.error(summary);
      else toast.success(summary);
    },
    onError: (err) => {
      toast.error(err.message || t("common.errorOccurred", "Vyskytla sa chyba"));
    },
  });

  // --- Rabies register state ---
  const [rabiesSearch, setRabiesSearch] = useState("");
  const rabiesQuery = trpc.reports.rabiesRegister.useQuery(
    {
      search: rabiesSearch || undefined,
      limit: 100,
    },
    { enabled: activeTab === "rabies" },
  );

  // --- Patient search state ---
  const [patientQueryText, setPatientQueryText] = useState("");
  const patientSearch = trpc.patients.search.useQuery(
    { query: patientQueryText },
    { enabled: patientQueryText.trim().length >= 2 && activeTab === "search" },
  );

  const handleToggleAll = () => {
    if (allEligibleSelected) {
      setSelected(new Set());
    } else {
      setSelected(
        new Set(
          eligibleRecipients
            .slice(0, MAX_BATCH_SIZE)
            .map((r) => r.patientId),
        ),
      );
    }
  };

  const handleToggleOne = (patientId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  };

  return (
    <div className={pageShellClass}>
      <PageHeader
        icon={Syringe}
        title={t("nav.vaccinations", "Očkovania & Imunizácia")}
        subtitle={t(
          "vaccinations.subtitle",
          "Kompletný register očkovaní, automatický výpočet revakcinácií, zákaznícke SMS pripomienky a zákonná evidencia besnoty (Zákon č. 39/2007 Z. z.).",
        )}
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/statutory?tab=rabies">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span>{t("vaccinations.statutoryRabies", "Kniha besnoty (ŠVPS)")}</span>
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-2">
              <Link href="/records?tab=vaccinations&new=1">
                <Plus className="h-4 w-4" />
                <span>{t("vaccinations.recordNew", "Nové očkovanie")}</span>
              </Link>
            </Button>
          </>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "recalls" | "rabies" | "search")}
        className="space-y-4"
      >
        <TabsList className={underlineTabsListClass}>
          <TabsTrigger value="recalls" className={underlineTabsTriggerClass}>
            <BellRing className="h-3.5 w-3.5" />
            <span>{t("vaccinations.tabs.recalls", "Revakcinácie")}</span>
            {eligibleRecipients.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 py-0 text-[10px] tabular-nums"
              >
                {eligibleRecipients.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rabies" className={underlineTabsTriggerClass}>
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{t("vaccinations.tabs.rabies", "Register besnoty")}</span>
          </TabsTrigger>
          <TabsTrigger value="search" className={underlineTabsTriggerClass}>
            <Search className="h-3.5 w-3.5" />
            <span>{t("vaccinations.tabs.search", "Preukaz pacienta")}</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Recalls / Revakcinácie */}
        <TabsContent value="recalls" className={TAB_PANEL}>
          <PageSectionHeader
            title={t("vaccinations.recallsTitle", "Pripomienky termínov revakcinácie")}
            subtitle={t(
              "vaccinations.recallsDesc",
              "Pacienti s exspirovaným alebo blížiacim sa termínom revakcinácie pripravení na odoslanie SMS alebo e-mailu.",
            )}
          />

          <PageToolbar>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
              <Checkbox
                checked={allEligibleSelected}
                disabled={eligibleRecipients.length === 0}
                onChange={handleToggleAll}
              />
              <span>
                {t("vaccinations.selectAllEligible", "Vybrať všetkých oprávnených ({count})", {
                  count: eligibleRecipients.length,
                })}
              </span>
            </label>
            <p className="text-xs tabular-nums text-muted-foreground sm:ml-auto sm:shrink-0">
              {t("vaccinations.totalRecipients", "Celkovo {total} záznamov", {
                total: preview.data?.recipients.length ?? 0,
              })}
            </p>
            <Button
              size="sm"
              onClick={() =>
                sendReminders.mutate({ patientIds: selectedEligibleIds })
              }
              disabled={selectedEligibleIds.length === 0 || sendReminders.isPending}
              className="gap-2 text-xs sm:shrink-0"
            >
              {sendReminders.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>
                {t(
                  "recalls.sendSelected",
                  "Odoslať pripomienky ({count})",
                  { count: selectedEligibleIds.length },
                )}
              </span>
            </Button>
          </PageToolbar>

          {preview.isLoading ? (
            <LoadingFrame />
          ) : !preview.data?.recipients.length ? (
            <EmptyState
              icon={CheckCircle2}
              title={t("vaccinations.recallsEmptyTitle", "Všetky očkovania sú aktuálne")}
              description={t(
                "vaccinations.recallsEmptyDesc",
                "Žiadny pacient nemá exspirované očkovanie vyžadujúce zaslanie pripomienky.",
              )}
            />
          ) : (
            <DataTableFrame>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className={cn(tableHeadClass, "w-10")} />
                    <th className={tableHeadClass}>{t("vaccinations.colPatient", "Pacient")}</th>
                    <th className={tableHeadClass}>{t("vaccinations.colOwner", "Majiteľ")}</th>
                    <th className={tableHeadClass}>{t("vaccinations.colVaccineDate", "Vakcína & Dátum")}</th>
                    <th className={tableHeadClass}>{t("vaccinations.colChannel", "Kanál")}</th>
                    <th className={tableHeadClass}>{t("vaccinations.colStatus", "Stav")}</th>
                    <th className={cn(tableHeadClass, "text-right")}>{t("vaccinations.colAction", "Akcia")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.data.recipients.map((r) => {
                    const isEligible = r.status === "eligible";
                    const isChecked = selected.has(r.patientId);
                    const firstVaccine = r.vaccines[0];

                    return (
                      <tr key={r.patientId} className={tableRowClass}>
                        <td className={cn(tableCellClass, "w-10")}>
                          <Checkbox
                            aria-label={t("recalls.selectPatientAria", "Vybrať {name}", {
                              name: r.patientName,
                            })}
                            checked={isChecked}
                            disabled={!isEligible}
                            onChange={() => handleToggleOne(r.patientId)}
                          />
                        </td>
                        <td className={cn(tableCellClass, "font-medium text-foreground")}>
                          <Link
                            href={`/patients/${r.patientId}`}
                            className="flex items-center gap-1.5 hover:underline"
                          >
                            <PawPrint className="h-3 w-3 text-primary/70" />
                            <span>{r.patientName}</span>
                          </Link>
                        </td>
                        <td className={cn(tableCellClass, "max-w-[180px] text-muted-foreground")}>
                          <span className="block truncate" title={r.clientName}>{r.clientName}</span>
                        </td>
                        <td className={tableCellClass}>
                          <span className="font-medium text-foreground">
                            {firstVaccine?.vaccineName ??
                              t("vaccinations.vaccineFallback", "Vakcína")}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            {t("vaccinations.expiryPrefix", "Expirácia:")}{" "}
                            <span className={NUMERIC}>
                              {formatDateToDisplay(firstVaccine?.nextDueDate)}
                            </span>
                          </span>
                        </td>
                        <td className={tableCellClass}>
                          {r.channel ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              {r.channel === "sms" ? (
                                <MessageSquare className="h-3 w-3 text-success" />
                              ) : (
                                <Mail className="h-3 w-3 text-info" />
                              )}
                              <span className="text-[10px] font-semibold uppercase">
                                {r.channel === "sms"
                                  ? t("recalls.channelSms", "SMS")
                                  : t("recalls.channelEmail", "E-mail")}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className={tableCellClass}>
                          <Badge
                            variant={
                              r.status === "eligible"
                                ? "success"
                                : r.status === "already_sent"
                                  ? "outline"
                                  : "warning"
                            }
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {r.status === "eligible"
                              ? t("recalls.badgeReady", "Pripravené")
                              : r.status === "already_sent"
                                ? t("recalls.badgeAlreadyReminded", "Už odoslané")
                                : t("recalls.badgeBlocked", "Blokované")}
                          </Badge>
                        </td>
                        <td className={cn(tableCellClass, "text-right")}>
                          <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
                            <Link href={`/records?patientId=${r.patientId}&tab=vaccinations`}>
                              <span>{t("vaccinations.colRecord", "Záznam")}</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTableFrame>
          )}
        </TabsContent>

        {/* Tab 2: Rabies register */}
        <TabsContent value="rabies" className={TAB_PANEL}>
          <PageSectionHeader
            title={t("vaccinations.rabiesTitle", "Zákonná evidencia očkovania proti besnote")}
            subtitle={t(
              "vaccinations.rabiesDesc",
              "Povinný register vakcinácie mäsožravcov proti besnote podľa Zákona č. 39/2007 Z. z. s 3-dňovou lehotou hlásenia na RVPS.",
            )}
          />

          <PageToolbar>
            <SearchField
              value={rabiesSearch}
              onChange={setRabiesSearch}
              placeholder={t("common.search", "Hľadať pacienta, čip...")}
            />
            {rabiesQuery.data && (
              <p className="text-xs tabular-nums text-muted-foreground sm:ml-auto sm:shrink-0">
                {t("vaccinations.totalRecipients", "Celkovo {total} záznamov", {
                  total: rabiesQuery.data.totalCount,
                })}
              </p>
            )}
          </PageToolbar>

          {rabiesQuery.isLoading ? (
            <LoadingFrame />
          ) : !rabiesQuery.data?.items?.length ? (
            <EmptyState
              icon={ShieldCheck}
              title={t("vaccinations.rabiesEmptyTitle", "Žiadne záznamy o besnote")}
              description={t(
                "vaccinations.rabiesEmptyDesc",
                "Neboli nájdené žiadne záznamy o aplikovanom očkovaní proti besnote.",
              )}
            />
          ) : (
            <DataTableFrame>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className={tableHeadClass}>{t("vaccinations.colDate", "Dátum")}</th>
                    <th className={tableHeadClass}>{t("vaccinations.colPatient", "Pacient")}</th>
                    <th className={tableHeadClass}>{t("vaccinations.colMicrochipNumber", "Číslo mikročipu")}</th>
                    <th className={tableHeadClass}>{t("vaccinations.colVaccineLot", "Vakcína & Šarža")}</th>
                    <th className={tableHeadClass}>{t("vaccinations.colRevaccination", "Revakcinácia")}</th>
                    <th className={tableHeadClass}>{t("vaccinations.colOwner", "Majiteľ")}</th>
                    <th className={cn(tableHeadClass, "text-right")}>{t("vaccinations.colRecord", "Záznam")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rabiesQuery.data.items.map((r) => (
                    <tr key={r.id} className={tableRowClass}>
                      <td className={cn(tableCellClass, NUMERIC, "whitespace-nowrap text-muted-foreground")}>
                        {formatDateToDisplay(r.administeredAt)}
                      </td>
                      <td className={cn(tableCellClass, "font-medium text-foreground")}>
                        <Link href={`/patients/${r.patientId}`} className="hover:underline">
                          {r.patientName}
                        </Link>
                        <span className="block text-[10px] capitalize text-muted-foreground">
                          {r.species} {r.breed ? `· ${r.breed}` : ""}
                        </span>
                      </td>
                      <td className={cn(tableCellClass, NUMERIC, "text-foreground")}>
                        {r.microchipNumber || (
                          <span className="font-sans text-muted-foreground">
                            {t("vaccinations.notMicrochipped", "Nečipovaný")}
                          </span>
                        )}
                      </td>
                      <td className={tableCellClass}>
                        <span className="font-medium text-foreground">{r.vaccineName}</span>
                        {r.lotNumber && (
                          <span className="block text-[10px] text-muted-foreground">
                            {t("vaccinations.lotPrefix", "Šarža:")}{" "}
                            <span className={NUMERIC}>{r.lotNumber}</span>
                          </span>
                        )}
                      </td>
                      <td className={cn(tableCellClass, NUMERIC, "whitespace-nowrap font-medium text-foreground")}>
                        {formatDateToDisplay(r.nextDueDate)}
                      </td>
                      <td className={cn(tableCellClass, "text-muted-foreground")}>
                        {`${r.clientFirstName || ""} ${r.clientLastName}`.trim()}
                      </td>
                      <td className={cn(tableCellClass, "text-right")}>
                        <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Link
                            href={`/records?patientId=${r.patientId}&tab=vaccinations`}
                            aria-label={t("vaccinations.openRecordAria", "Otvoriť záznam očkovania")}
                            title={t("vaccinations.openRecordAria", "Otvoriť záznam očkovania")}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableFrame>
          )}
        </TabsContent>

        {/* Tab 3: Patient search for vaccination card */}
        <TabsContent value="search" className={TAB_PANEL}>
          <PageSectionHeader
            title={t("vaccinations.searchTitle", "Vyhľadať digitálny očkovací preukaz")}
            subtitle={t(
              "vaccinations.searchDesc",
              "Zadajte meno pacienta, číslo mikročipu alebo majiteľa pre zobrazenie celej histórie vakcinácií a vytlačenie digitálneho preukazu.",
            )}
          />

          <PageToolbar>
            <SearchField
              value={patientQueryText}
              onChange={setPatientQueryText}
              placeholder={t("patients.searchPlaceholder", "Meno pacienta, mikročip, majiteľ...")}
            />
            {patientSearch.data && patientQueryText.trim().length >= 2 && (
              <p className="text-xs tabular-nums text-muted-foreground sm:ml-auto sm:shrink-0">
                {t("vaccinations.totalRecipients", "Celkovo {total} záznamov", {
                  total: patientSearch.data.length,
                })}
              </p>
            )}
          </PageToolbar>

          {patientSearch.isLoading ? (
            <LoadingFrame />
          ) : patientQueryText.trim().length >= 2 && !patientSearch.data?.length ? (
            <EmptyState
              icon={Search}
              title={t("patients.noResults", "Pacient nebol nájdený")}
              description={t("patients.noResultsDesc", "Skontrolujte správnosť zadaného mena alebo mikročipu.")}
            />
          ) : patientSearch.data && patientSearch.data.length > 0 ? (
            <DataTableFrame>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className={tableHeadClass}>{t("vaccinations.colPatient", "Pacient")}</th>
                    <th className={tableHeadClass}>{t("vaccinations.colSpeciesBreed", "Druh & Plemeno")}</th>
                    <th className={tableHeadClass}>{t("vaccinations.colMicrochip", "Mikročip")}</th>
                    <th className={tableHeadClass}>{t("vaccinations.colOwner", "Majiteľ")}</th>
                    <th className={cn(tableHeadClass, "text-right")}>{t("vaccinations.colAction", "Akcia")}</th>
                  </tr>
                </thead>
                <tbody>
                  {patientSearch.data.map((p) => (
                    <tr key={p.id} className={tableRowClass}>
                      <td className={cn(tableCellClass, "font-semibold text-foreground")}>
                        <Link href={`/patients/${p.id}`} className="hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className={cn(tableCellClass, "capitalize text-muted-foreground")}>
                        {p.species} {p.breed ? `· ${p.breed}` : ""}
                      </td>
                      <td className={cn(tableCellClass, NUMERIC, "text-muted-foreground")}>
                        {p.microchipNumber || "—"}
                      </td>
                      <td className={cn(tableCellClass, "text-muted-foreground")}>
                        {[p.clientFirstName, p.clientLastName].filter(Boolean).join(" ")}
                      </td>
                      <td className={cn(tableCellClass, "text-right")}>
                        <Button asChild size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
                          <Link href={`/records?patientId=${p.id}&tab=vaccinations`}>
                            <Syringe className="h-3 w-3 text-primary" />
                            <span>{t("vaccinations.openVaccinations", "Otvoriť očkovania")}</span>
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableFrame>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Loading placeholder sized like a table card so the layout does not jump. */
function LoadingFrame() {
  return (
    <div className="flex items-center justify-center rounded-lg border border-border bg-card py-12 shadow-xs">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
