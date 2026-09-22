"use client";

import { Scissors } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/common/empty-state";
import { useI18n } from "@/lib/i18n";
import { formatClinicalDate } from "@/lib/records/clinical-dates";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ProceduresTab({
  patientId,
  timeZone,
}: {
  patientId: string;
  timeZone?: string | null;
}) {
  const { t } = useI18n();
  const {
    data: procedures,
    isLoading,
    error,
  } = trpc.records.listProcedures.useQuery({ patientId });

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        {t("patients.proceduresTab.loadError", "Unable to load procedures.")}
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
  if (!procedures || procedures.length === 0) {
    return (
      <EmptyState
        icon={Scissors}
        title={t("patients.proceduresTab.empty", "No procedures recorded")}
        description={t(
          "patients.proceduresTab.emptyDesc",
          "Procedures recorded in Records will show up here.",
        )}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t(
            "patients.proceduresTab.readonlyNotice",
            "Viewing procedure history. Open Records to add or manage procedures.",
          )}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/records?patientId=${encodeURIComponent(patientId)}&tab=procedures`}>
            {t("patients.proceduresTab.openInRecords", "Open in Records")}
          </Link>
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.proceduresTab.colName", "Name")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.proceduresTab.colPerformedBy", "Performed By")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.proceduresTab.colDuration", "Duration")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.proceduresTab.colAnesthesia", "Anesthesia")}
              </th>
              <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {t("patients.proceduresTab.colDate", "Date")}
              </th>
            </tr>
          </thead>
          <tbody>
            {procedures.map((proc) => (
              <tr
                key={proc.id}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{proc.name}</p>
                  {proc.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {proc.description}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {proc.performedByName ?? "\u2014"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {proc.durationMinutes
                    ? t("patients.proceduresTab.minutesValue", "{minutes} min", {
                        minutes: proc.durationMinutes,
                      })
                    : "\u2014"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {proc.anesthesiaUsed ?? "\u2014"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {proc.createdAt
                    ? formatClinicalDate(proc.createdAt, timeZone, "\u2014")
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
