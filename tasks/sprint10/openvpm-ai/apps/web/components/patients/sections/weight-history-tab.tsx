"use client";

import { type FormEvent } from "react";
import dynamic from "next/dynamic";
import { Activity, Loader2, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { type WeightTrendPoint } from "@/lib/records/clinical-trends";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { EmptyState } from "@/components/common/empty-state";
import { WeightCorrectionDialog } from "@/components/records/weight-correction-dialog";
import { formatClinicalDate } from "@/lib/records/clinical-dates";
import {
  kilogramsToPounds,
  roundClinicalMeasurement,
  type MeasurementSystem,
} from "@/lib/ambulatory-workspace";
import {
  PATIENT_WEIGHT_MAX_KG,
  PATIENT_WEIGHT_MIN_KG,
  PATIENT_WEIGHT_STEP,
} from "@/lib/records/patient-weight-policy";

function PatientChartChunkLoading() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="h-64 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

const WeightTrendChart = dynamic(
  () =>
    import("@/components/patients/patient-trend-charts").then(
      (mod) => mod.WeightTrendChart,
    ),
  {
    ssr: false,
    loading: PatientChartChunkLoading,
  },
);

function formatClinicalWeight(
  value: number | string | null | undefined,
  measurementSystem: MeasurementSystem,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return measurementSystem === "us_customary"
    ? roundClinicalMeasurement(kilogramsToPounds(parsed)) + " lb"
    : roundClinicalMeasurement(parsed, 3) + " kg";
}

export interface WeightEntry {
  id: string;
  weightKg: number | string;
  recordedAt: Date | string | null;
  recordedByName: string | null;
  source?: string | null;
}

interface WeightHistoryTabProps {
  weights: Array<{ id: string; weightKg: number | string; recordedAt: Date | string | null; recordedByName?: string | null; source?: string | null; }> | null | undefined;
  patientId: string;
  canManagePatientDetail: boolean;
  canCorrectClinicalRecords: boolean;
  weightKg: string;
  setWeightKg: (value: string) => void;
  weightMeasuredAt: string;
  setWeightMeasuredAt: (value: string) => void;
  onSubmitWeight: (e: FormEvent) => void;
  isAddingWeight: boolean;
  canSubmitWeight: boolean;
  weightTrend: WeightTrendPoint[];
  measurementSystem: MeasurementSystem;
  recordsTimeZone: string | null;
  recordsSettingsTimeZone: string | null | undefined;
  canonicalPatientWeight: number;
  maxMeasuredAt: string;
  onRefresh: () => void;
  onSwitchToVitals: () => void;
}

export function WeightHistoryTab({
  weights,
  patientId,
  canManagePatientDetail,
  canCorrectClinicalRecords,
  weightKg,
  setWeightKg,
  weightMeasuredAt,
  setWeightMeasuredAt,
  onSubmitWeight,
  isAddingWeight,
  canSubmitWeight,
  weightTrend,
  measurementSystem,
  recordsTimeZone,
  recordsSettingsTimeZone,
  canonicalPatientWeight,
  maxMeasuredAt,
  onRefresh,
  onSwitchToVitals,
}: WeightHistoryTabProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t(
          "patients.weight.includesVitalsHelp",
          "Includes weights recorded here and in vitals. Review a vitals entry in the Vitals tab to correct its original clinical record.",
        )}
      </p>
      {canManagePatientDetail && (
        <form
          onSubmit={onSubmitWeight}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full sm:max-w-xs">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t(
                  "patients.weight.weightUnit",
                  "Weight (" + (measurementSystem === "us_customary" ? "lb" : "kg") + ")",
                  {
                    unit:
                      measurementSystem === "us_customary"
                        ? "lb"
                        : "kg",
                  },
                )}
              </label>
              <input
                type="number"
                min={
                  measurementSystem === "us_customary"
                    ? roundClinicalMeasurement(
                        kilogramsToPounds(PATIENT_WEIGHT_MIN_KG),
                        3,
                      )
                    : PATIENT_WEIGHT_MIN_KG
                }
                max={
                  measurementSystem === "us_customary"
                    ? roundClinicalMeasurement(
                        kilogramsToPounds(PATIENT_WEIGHT_MAX_KG),
                        3,
                      )
                    : PATIENT_WEIGHT_MAX_KG
                }
                step={PATIENT_WEIGHT_STEP}
                value={weightKg}
                required
                aria-invalid={
                  weightKg.trim().length > 0 &&
                  canonicalPatientWeight <= 0
                }
                onChange={(event) => setWeightKg(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="w-full sm:max-w-xs">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t(
                  "patients.weight.measuredAtLabel",
                  "Measured at (" + (recordsSettingsTimeZone ?? "clinic timezone") + ")",
                  {
                    timeZone:
                      recordsSettingsTimeZone ??
                      t(
                        "patients.weight.loadingTimezone",
                        "loading clinic timezone…",
                      ),
                  },
                )}
              </label>
              <DateTimePicker
                value={weightMeasuredAt}
                disabled={!recordsSettingsTimeZone}
                max={maxMeasuredAt}
                onChange={(val) => setWeightMeasuredAt(val)}
              />
              <span className="mt-1 block text-[11px] text-muted-foreground font-normal">
                {t(
                  "patients.weight.leaveBlankHelp",
                  "Leave blank to record now; set a date for historical records.",
                )}
              </span>
            </div>
            <Button type="submit" disabled={!canSubmitWeight}>
              {isAddingWeight ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {isAddingWeight
                ? t("patients.actions.saving", "Saving...")
                : t("patients.weight.recordWeight", "Record weight")}
            </Button>
          </div>
        </form>
      )}

      {weights && weights.length > 0 ? (
        <>
          {measurementSystem === "metric" ? (
            <WeightTrendChart data={weightTrend} />
          ) : null}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                    {t("patients.weight.date", "Date")}
                  </th>
                  <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                    {t(
                      "patients.weight.weightCol",
                      "Weight (" + (measurementSystem === "us_customary" ? "lb" : "kg") + ")",
                      {
                        unit:
                          measurementSystem === "us_customary"
                            ? "lb"
                            : "kg",
                      },
                    )}
                  </th>
                  <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                    {t("patients.weight.recordedBy", "Recorded By")}
                  </th>
                  {canCorrectClinicalRecords ? (
                    <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                      {t("patients.weight.correction", "Correction")}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {weights.map((weight) => (
                  <tr
                    key={weight.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3">
                      {formatClinicalDate(
                        weight.recordedAt,
                        recordsTimeZone,
                        "—",
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatClinicalWeight(
                        weight.weightKg,
                        measurementSystem,
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {weight.recordedByName ?? "—"}
                    </td>
                    {canCorrectClinicalRecords ? (
                      <td className="px-4 py-3">
                        {weight.source === "vitals" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSwitchToVitals()}
                          >
                            {t("patients.weight.reviewVitals", "Review vitals")}
                          </Button>
                        ) : (
                          <WeightCorrectionDialog
                            patientId={patientId}
                            weight={{ id: weight.id, weightKg: String(weight.weightKg), recordedAt: weight.recordedAt ?? new Date().toISOString() }}
                            measurementSystem={measurementSystem}
                            timeZone={recordsSettingsTimeZone}
                            onSaved={() => {
                              onRefresh();
                            }}
                          />
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyState
          icon={Activity}
          title={t("patients.weight.empty", "No weight records yet")}
        />
      )}
    </div>
  );
}