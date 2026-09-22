"use client";

import { FlaskConical } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/common/empty-state";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatClinicalDate } from "@/lib/records/clinical-dates";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
          "Lab results entered in Records will show up here.",
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
            "Viewing lab result history. Open Records to enter or correct results.",
          )}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/records?patientId=${encodeURIComponent(patientId)}&tab=labResults`}>
            {t("patients.labResultsTab.openInRecords", "Open in Records")}
          </Link>
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.labResultsTab.colTest", "Test")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.labResultsTab.colResult", "Result")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.labResultsTab.colFlag", "Flag")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.labResultsTab.colRange", "Ref. Range")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.labResultsTab.colOrderedBy", "Ordered By")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.labResultsTab.colDate", "Date")}
              </th>
            </tr>
          </thead>
          <tbody>
            {labResults.map((lab) => (
              <tr
                key={lab.id}
                className={cn(
                  "border-b border-border last:border-0",
                  lab.correctionId && "opacity-60",
                )}
              >
                <td className="px-4 py-3 font-medium">
                  {lab.testName}
                  {lab.correctionId && (
                    <span className="ml-2 text-xs text-destructive">
                      {t("patients.labResultsTab.voided", "(voided)")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {lab.resultValue
                    ? `${lab.resultValue}${lab.unit ? ` ${lab.unit}` : ""}`
                    : t("patients.labResultsTab.pending", "Pending")}
                </td>
                <td className="px-4 py-3">
                  {lab.resultFlag && lab.resultFlag !== "unknown" ? (
                    <span
                      className={cn(
                        "text-xs font-medium capitalize",
                        lab.resultFlag === "critical"
                          ? "text-red-700 dark:text-red-300"
                          : lab.resultFlag === "abnormal"
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-emerald-700 dark:text-emerald-300",
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
                <td className="px-4 py-3 text-muted-foreground">
                  {lab.referenceRangeLow != null || lab.referenceRangeHigh != null
                    ? `${lab.referenceRangeLow ?? ""}\u2013${lab.referenceRangeHigh ?? ""}`
                    : "\u2014"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {lab.orderedByName ?? "\u2014"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {lab.createdAt
                    ? formatClinicalDate(lab.createdAt, timeZone, "\u2014")
                    : "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
