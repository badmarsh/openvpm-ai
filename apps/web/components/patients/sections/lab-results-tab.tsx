"use client";

import { FlaskConical, Plus, TriangleAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/common/empty-state";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatClinicalDate } from "@/lib/records/clinical-dates";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DataTableFrame, tableHeadClass, tableCellClass, tableRowClass } from "@/components/layout/page-kit";
import { TableScroll } from "@/components/common/table-scroll";

export function LabResultsTab({
  patientId,
  timeZone,
}: {
  patientId: string;
  timeZone?: string | null;
}) {
  const { t } = useI18n();
  const {
    data: labResults,
    isLoading,
    error,
  } = trpc.records.listLabResults.useQuery({ patientId });

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        {t("patients.labResultsTab.loadError", "Unable to load lab results.")}
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
  if (!labResults || labResults.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title={t("patients.labResultsTab.empty", "No lab results yet")}
        description={t(
          "patients.labResultsTab.emptyDesc",
          "Lab results entered in the clinical record will show up here.",
        )}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t(
            "patients.labResultsTab.readonlyNotice",
            "Lab results are entered in the clinical record. The button opens a prefilled form for this patient.",
          )}
        </p>
        <Button asChild size="sm">
          <Link
            href={`/records?patientId=${encodeURIComponent(patientId)}&tab=labResults&new=1`}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("patients.labResultsTab.addResult", "Add lab result")}
          </Link>
        </Button>
      </div>
      <DataTableFrame>
        <TableScroll>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className={tableHeadClass}>{t("patients.labResultsTab.colTest", "Test")}</th>
                <th className={tableHeadClass}>{t("patients.labResultsTab.colResult", "Result")}</th>
                <th className={tableHeadClass}>{t("patients.labResultsTab.colFlag", "Flag")}</th>
                <th className={tableHeadClass}>
                  {t("patients.labResultsTab.colRange", "Ref. Range")}{" "}
                  <span className="font-normal normal-case">({t("patients.labResultsTab.referenceInterval", "Reference interval")})</span>
                </th>
                <th className={tableHeadClass}>{t("patients.labResultsTab.colOrderedBy", "Ordered By")}</th>
                <th className={tableHeadClass}>{t("patients.labResultsTab.colDate", "Date")}</th>
              </tr>
            </thead>
            <tbody>
              {labResults.map((lab) => {
                const numericValue = lab.resultValue != null ? Number(String(lab.resultValue).replace(",", ".")) : null;
                const low = lab.referenceRangeLow != null ? Number(lab.referenceRangeLow) : null;
                const high = lab.referenceRangeHigh != null ? Number(lab.referenceRangeHigh) : null;
                const isHigh = numericValue != null && high != null && numericValue > high;
                const isLow = numericValue != null && low != null && numericValue < low;
                return (
                  <tr
                    key={lab.id}
                    className={cn(
                      tableRowClass,
                      lab.correctionId && "opacity-60",
                      (isHigh || isLow || lab.resultFlag === "critical") && "bg-amber-50/40 dark:bg-amber-950/10",
                      isHigh && "bg-red-50/30 dark:bg-red-950/10"
                    )}
                  >
                    <td className={cn(tableCellClass, "font-medium")}>
                      {lab.testName}
                      {lab.correctionId && (
                        <span className="ml-2 text-xs text-destructive">
                          {t("patients.labResultsTab.voided", "(voided)")}
                        </span>
                      )}
                    </td>
                    <td className={cn(tableCellClass, (isHigh || isLow) && "font-semibold")}>
                      {lab.resultValue
                        ? `${lab.resultValue}${lab.unit ? ` ${lab.unit}` : ""}`
                        : t("patients.labResultsTab.pending", "Pending")}
                      {isHigh ? (
                        <span className="ml-1 inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                          {t("patients.labResultsTab.flagHigh", "High")} <TriangleAlert className="ml-1 h-3 w-3" />
                        </span>
                      ) : isLow ? (
                        <span className="ml-1 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          {t("patients.labResultsTab.flagLow", "Low")}
                        </span>
                      ) : null}
                    </td>
                    <td className={tableCellClass}>
                      {lab.resultFlag && lab.resultFlag !== "unknown" ? (
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                            lab.resultFlag === "critical"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                              : lab.resultFlag === "abnormal"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          )}
                        >
                          {lab.resultFlag === "critical"
                            ? t("patients.labResultsTab.flagCritical", "Critical")
                            : lab.resultFlag === "abnormal"
                              ? t("patients.labResultsTab.flagAbnormal", "Abnormal")
                              : t("patients.labResultsTab.flagNormal", "Normal")}
                        </span>
                      ) : (
                        "\u2014"
                      )}
                    </td>
                    <td className={cn(tableCellClass, "font-mono text-xs tabular-nums")}>
                      {lab.referenceRangeLow != null || lab.referenceRangeHigh != null
                        ? `${lab.referenceRangeLow ?? ""}–${lab.referenceRangeHigh ?? ""} ${lab.unit ?? ""}`.trim()
                        : "\u2014"}
                    </td>
                    <td className={cn(tableCellClass, "text-muted-foreground")}>{lab.orderedByName ?? "\u2014"}</td>
                    <td className={cn(tableCellClass, "text-muted-foreground tabular-nums")}>
                      {lab.createdAt ? formatClinicalDate(lab.createdAt, timeZone, "\u2014") : "\u2014"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      </DataTableFrame>
    </div>
  );
}
