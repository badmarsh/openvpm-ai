"use client";

import { Pill } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/common/empty-state";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatClinicalDate } from "@/lib/records/clinical-dates";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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

export function PrescriptionsTab({
  patientId,
  timeZone,
}: {
  patientId: string;
  timeZone?: string | null;
}) {
  const { t } = useI18n();
  const {
    data: prescriptions,
    isLoading,
    error,
  } = trpc.records.listPrescriptions.useQuery({ patientId });

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
          "Prescriptions written in Records will show up here.",
        )}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t(
            "patients.prescriptionsTab.readonlyNotice",
            "Viewing prescription history. Open Records to create or manage prescriptions.",
          )}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/records?patientId=${encodeURIComponent(patientId)}&tab=prescriptions`}>
            {t("patients.prescriptionsTab.openInRecords", "Open in Records")}
          </Link>
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.prescriptionsTab.colMedication", "Medication")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.prescriptionsTab.colDosage", "Dosage")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.prescriptionsTab.colFrequency", "Frequency")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.prescriptionsTab.colStatus", "Status")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.prescriptionsTab.colRefills", "Refills")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.prescriptionsTab.colDate", "Date")}
              </th>
            </tr>
          </thead>
          <tbody>
            {prescriptions.map((rx) => (
              <tr
                key={rx.id}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3 font-medium">{rx.medicationName}</td>
                <td className="px-4 py-3">{rx.dosage ?? "\u2014"}</td>
                <td className="px-4 py-3">{rx.frequency ?? "\u2014"}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                      getPrescriptionStatusBadge(rx.effectiveStatus),
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
                <td className="px-4 py-3">{rx.refillsRemaining ?? 0}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {rx.startDate
                    ? formatClinicalDate(rx.startDate, timeZone, "\u2014")
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
