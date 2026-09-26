"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarClock, Syringe, Stethoscope, Bell } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/common/empty-state";
import { useI18n } from "@/lib/i18n";
import { formatClinicalDate } from "@/lib/records/clinical-dates";
import { Button } from "@/components/ui/button";
import { DataTableFrame, tableHeadClass, tableCellClass, tableRowClass } from "@/components/layout/page-kit";
import { TableScroll } from "@/components/common/table-scroll";
import { cn } from "@/lib/utils";

export function RemindersTab({
  patientId,
  timeZone,
}: {
  patientId: string;
  timeZone?: string | null;
}) {
  const { t } = useI18n();
  const careSchedule = trpc.extensions.patientClinicalCard.getCareSchedule.useQuery({ patientId });
  const vaccinationsQuery = trpc.records.listVaccinations.useQuery({ patientId });

  const vaccinationsData = useMemo(() => vaccinationsQuery.data ?? [], [vaccinationsQuery.data]);
  // upcoming = nextDueDate in future, sorted — keep this unconditional (rules-of-hooks)
  const upcomingVaccinations = useMemo(
    () =>
      (vaccinationsData as Array<{ id: string; vaccineName: string; administeredAt?: Date | string | null; nextDueDate?: string | Date | null; lotNumber?: string | null; batchNumber?: string | null; correctionId?: string | null }>)
        .filter((v) => !v.correctionId && v.nextDueDate && new Date(v.nextDueDate as string) >= new Date())
        .sort((a, b) => new Date(a.nextDueDate as string).getTime() - new Date(b.nextDueDate as string).getTime())
        .slice(0, 5),
    [vaccinationsData]
  );

  if (careSchedule.error && vaccinationsQuery.error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        {t("patients.remindersTab.loadError", "Nepodarilo sa načítať pripomienky a plán starostlivosti.")}
      </div>
    );
  }
  if (careSchedule.isLoading || vaccinationsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-32 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const reminders = (careSchedule.data?.reminders ?? []) as Array<{
    id: string;
    title: string;
    notes?: string | null;
    dueDate: string | null;
    status: string;
  }>;
  const vaccinations = vaccinationsData;

  const openReminders = reminders.filter((r) => r.status === "open");

  const hasAny = reminders.length > 0 || vaccinations.length > 0 || upcomingVaccinations.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t(
            "patients.remindersTab.help",
            "Očkovania, odčervenia, kontroly a plánované zákroky – očkovací preukaz a ochranné lehoty na jednom mieste."
          )}
        </p>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/records?patientId=${encodeURIComponent(patientId)}&tab=vaccinations&new=1`}>
              <Syringe className="mr-2 h-4 w-4" />
              {t("patients.remindersTab.addVaccination", "Pridať očkovanie")}
            </Link>
          </Button>
        </div>
      </div>

      {!hasAny ? (
        <EmptyState
          icon={CalendarClock}
          title={t("patients.remindersTab.empty", "Žiadne pripomienky")}
          description={t(
            "patients.remindersTab.emptyDesc",
            "Naplánované očkovania, odčervenia a kontroly sa zobrazia tu. Stav očkovacieho preukazu je aktuálny."
          )}
        />
      ) : (
        <>
          {upcomingVaccinations.length > 0 ? (
            <section aria-labelledby="upcoming-vaccinations" className="space-y-3">
              <h3 id="upcoming-vaccinations" className="flex items-center gap-2 text-sm font-semibold">
                <Syringe className="h-4 w-4 text-primary" />
                {t("patients.remindersTab.upcomingVaccinations", "Nadchádzajúce revakcinácie")}
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary tabular-nums">
                  {upcomingVaccinations.length}
                </span>
              </h3>
              <DataTableFrame>
                <TableScroll>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className={tableHeadClass}>{t("patients.remindersTab.colVaccine", "Vakcína")}</th>
                        <th className={tableHeadClass}>{t("patients.remindersTab.colLastDone", "Posledne podaná")}</th>
                        <th className={tableHeadClass}>{t("patients.remindersTab.colNextDue", "Nasledujúca dávka")}</th>
                        <th className={tableHeadClass}>{t("patients.remindersTab.colBatch", "Šarža")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingVaccinations.map((v) => (
                        <tr key={v.id} className={tableRowClass}>
                          <td className={cn(tableCellClass, "font-medium")}>{v.vaccineName}</td>
                          <td className={tableCellClass}>{v.administeredAt ? formatClinicalDate(v.administeredAt, timeZone, "—") : "—"}</td>
                          <td className={cn(tableCellClass, "font-medium text-amber-700 dark:text-amber-300")}>
                            {v.nextDueDate ? formatClinicalDate(v.nextDueDate, timeZone, "—") : "—"}
                          </td>
                          <td className={cn(tableCellClass, "font-mono text-xs")}>{(v as { lotNumber?: string | null; batchNumber?: string | null }).lotNumber ?? (v as { lotNumber?: string | null; batchNumber?: string | null }).batchNumber ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              </DataTableFrame>
            </section>
          ) : null}

          {openReminders.length > 0 ? (
            <section aria-labelledby="open-reminders" className="space-y-3">
              <h3 id="open-reminders" className="flex items-center gap-2 text-sm font-semibold">
                <Bell className="h-4 w-4 text-amber-600" />
                {t("patients.remindersTab.openReminders", "Aktívne pripomienky")}
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 tabular-nums">
                  {openReminders.length}
                </span>
              </h3>
              <DataTableFrame>
                <TableScroll>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className={tableHeadClass}>{t("patients.remindersTab.colTitle", "Názov")}</th>
                        <th className={tableHeadClass}>{t("patients.remindersTab.colNotes", "Poznámky")}</th>
                        <th className={tableHeadClass}>{t("patients.remindersTab.colDue", "Termín")}</th>
                        <th className={tableHeadClass}>{t("patients.remindersTab.colStatus", "Stav")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openReminders.map((r) => (
                        <tr key={r.id} className={tableRowClass}>
                          <td className={cn(tableCellClass, "font-medium")}>{r.title}</td>
                          <td className={tableCellClass}>{r.notes ?? "—"}</td>
                          <td className={tableCellClass}>{r.dueDate ? formatClinicalDate(r.dueDate, timeZone, "—") : "—"}</td>
                          <td className={tableCellClass}>
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                                r.status === "open"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              </DataTableFrame>
            </section>
          ) : null}

          {vaccinations.length > 0 ? (
            <section aria-labelledby="vaccination-history" className="space-y-3">
              <h3 id="vaccination-history" className="flex items-center gap-2 text-sm font-semibold">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                {t("patients.remindersTab.vaccinationHistory", "História očkovaní a odčervení")}
              </h3>
              <DataTableFrame>
                <TableScroll>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className={tableHeadClass}>{t("patients.remindersTab.colVaccine", "Vakcína")}</th>
                        <th className={tableHeadClass}>{t("patients.remindersTab.colDate", "Dátum")}</th>
                        <th className={tableHeadClass}>{t("patients.remindersTab.colNextDue", "Ďalšia dávka")}</th>
                        <th className={tableHeadClass}>{t("patients.remindersTab.colStatus", "Stav")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vaccinations.slice(0, 10).map((v) => (
                        <tr key={v.id} className={tableRowClass}>
                          <td className={cn(tableCellClass, "font-medium")}>{v.vaccineName}</td>
                          <td className={tableCellClass}>{v.administeredAt ? formatClinicalDate(v.administeredAt, timeZone, "—") : "—"}</td>
                          <td className={tableCellClass}>{v.nextDueDate ? formatClinicalDate(v.nextDueDate, timeZone, "—") : "—"}</td>
                          <td className={tableCellClass}>
                            {v.correctionId ? (
                              <span className="text-xs text-destructive">{t("patients.remindersTab.voided", "(zrušené)")}</span>
                            ) : (
                              <span className="text-xs text-emerald-700 dark:text-emerald-300">{t("patients.remindersTab.valid", "platné")}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              </DataTableFrame>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
