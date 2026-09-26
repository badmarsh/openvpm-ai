"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Pill, Plus, ShieldAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/common/empty-state";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatClinicalDate } from "@/lib/records/clinical-dates";
import { Button } from "@/components/ui/button";
import { DataTableFrame, tableHeadClass, tableCellClass, tableRowClass } from "@/components/layout/page-kit";
import { TableScroll } from "@/components/common/table-scroll";
import { isControlledSubstanceName } from "@/lib/controlled-substances/policy";

function getPrescriptionStatusBadge(status: string | null) {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "cancelled":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "expired":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
}

type PrescriptionFilter = "all" | "active" | "finished";

export function PrescriptionsTab({
  patientId,
  timeZone,
  canPrescribe = true,
}: {
  patientId: string;
  timeZone?: string | null;
  canPrescribe?: boolean;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<PrescriptionFilter>("all");
  const {
    data: prescriptions,
    isLoading,
    error,
  } = trpc.records.listPrescriptions.useQuery({ patientId });

  const groups = useMemo(() => {
    const rows = prescriptions ?? [];
    return {
      active: rows.filter((rx) => rx.effectiveStatus === "active"),
      finished: rows.filter((rx) => rx.effectiveStatus !== "active"),
    };
  }, [prescriptions]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        {t("patients.prescriptionsTab.loadError", "Unable to load prescriptions.")}
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-32 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }
  if (!prescriptions || prescriptions.length === 0) {
    return (
      <EmptyState
        icon={Pill}
        title={t("patients.prescriptionsTab.empty", "No prescriptions yet")}
        description={t(
          "patients.prescriptionsTab.emptyDesc",
          "Prescriptions written in the clinical record will show up here.",
        )}
      />
    );
  }

  const visibleRows =
    filter === "active"
      ? groups.active
      : filter === "finished"
        ? groups.finished
        : prescriptions;

  const filters: { id: PrescriptionFilter; label: string; count: number }[] = [
    {
      id: "all",
      label: t("patients.prescriptionsTab.filterAll", "All"),
      count: prescriptions.length,
    },
    {
      id: "active",
      label: t("patients.prescriptionsTab.filterActive", "Active"),
      count: groups.active.length,
    },
    {
      id: "finished",
      label: t("patients.prescriptionsTab.filterFinished", "Finished"),
      count: groups.finished.length,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t(
            "patients.prescriptionsTab.readonlyNotice",
            "Prescriptions are written in the clinical record. The button opens a prefilled prescription for this patient.",
          )}
        </p>
        {canPrescribe ? (
          <Button asChild size="sm">
            <Link
              href={`/records?patientId=${encodeURIComponent(patientId)}&tab=prescriptions&new=1`}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("patients.prescriptionsTab.issuePrescription", "Write prescription")}
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group">
        {filters.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            aria-pressed={filter === option.id}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
              filter === option.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
            <span className="tabular-nums text-muted-foreground">
              {option.count}
            </span>
          </button>
        ))}
      </div>

      <DataTableFrame>
        <TableScroll>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className={tableHeadClass}>{t("patients.prescriptionsTab.colMedication", "Medication")}</th>
                <th className={tableHeadClass}>{t("patients.prescriptionsTab.colDosage", "Dosage")}</th>
                <th className={tableHeadClass}>{t("patients.prescriptionsTab.colFrequency", "Frequency")}</th>
                <th className={tableHeadClass}>{t("patients.prescriptionsTab.colStatus", "Status")}</th>
                <th className={cn(tableHeadClass, "text-right")}>{t("patients.prescriptionsTab.colRefills", "Refills")}</th>
                <th className={tableHeadClass}>{t("patients.prescriptionsTab.colDate", "Date")}</th>
                <th className={tableHeadClass}>{t("patients.prescriptionsTab.colWithdrawal", "Withdrawal")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((rx, index) => {
                const previous = visibleRows[index - 1];
                const previousIsActive = previous?.effectiveStatus === "active";
                const isActive = rx.effectiveStatus === "active";
                const startsActiveGroup = filter === "all" && isActive && !previous;
                const startsFinishedGroup =
                  filter === "all" && !isActive && (previousIsActive || !previous);
                const isControlled = isControlledSubstanceName(rx.medicationName ?? "");
                return (
                  <Fragment key={rx.id}>
                    {startsActiveGroup || startsFinishedGroup ? (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {startsActiveGroup
                            ? t("patients.prescriptionsTab.activeSection", "Active medication")
                            : t("patients.prescriptionsTab.finishedSection", "Finished medication")}
                        </td>
                      </tr>
                    ) : null}
                    <tr className={cn(tableRowClass, isControlled && "bg-amber-50/40 dark:bg-amber-950/10")}>
                      <td className={tableCellClass}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-medium">{rx.medicationName}</span>
                          {isControlled ? (
                            <span
                              title={t("patients.prescriptionsTab.controlledWarning", "Controlled substance — manual entry required (Act 139/1998). No AI prefill.")}
                              className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            >
                              <ShieldAlert className="h-3 w-3" />
                              {t("patients.prescriptionsTab.controlledBadge", "Controlled")}
                            </span>
                          ) : null}
                        </span>
                        {isControlled ? (
                          <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                            {t("patients.prescriptionsTab.controlledWarning", "Controlled substance — manual entry required (Act 139/1998). No AI prefill.")}
                          </p>
                        ) : null}
                      </td>
                      <td className={cn(tableCellClass, "tabular-nums")}>{rx.dosage ?? "\u2014"}</td>
                      <td className={tableCellClass}>{rx.frequency ?? "\u2014"}</td>
                      <td className={tableCellClass}>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                            getPrescriptionStatusBadge(rx.effectiveStatus)
                          )}
                        >
                          {rx.effectiveStatus === "active"
                            ? t("patients.prescriptionsTab.statusActive", "active")
                            : rx.effectiveStatus === "cancelled"
                              ? t("patients.prescriptionsTab.statusCancelled", "cancelled")
                              : rx.effectiveStatus === "expired"
                                ? t("patients.prescriptionsTab.statusExpired", "expired")
                                : (rx.effectiveStatus ?? "unknown")}
                        </span>
                      </td>
                      <td className={cn(tableCellClass, "text-right tabular-nums")}>{rx.refillsRemaining ?? 0}</td>
                      <td className={cn(tableCellClass, "text-muted-foreground tabular-nums")}>
                        {rx.startDate ? formatClinicalDate(rx.startDate, timeZone, "\u2014") : "\u2014"}
                      </td>
                      <td className={cn(tableCellClass, "text-muted-foreground text-xs")}>
                        {/* ochranná lehota – derived from instructions or default */}
                        {(rx as unknown as { instructions?: string })?.instructions?.toLowerCase().includes("ochrann") ? (
                          <span className="font-medium text-amber-700 dark:text-amber-300">
                            {t("patients.prescriptionsTab.withdrawal", "Withdrawal")}: {(rx as unknown as { instructions: string }).instructions!.slice(0, 30)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      </DataTableFrame>
    </div>
  );
}
