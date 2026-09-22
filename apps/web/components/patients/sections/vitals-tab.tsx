"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity } from "lucide-react";
import dynamic from "next/dynamic";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { useI18n } from "@/lib/i18n";
import { ClinicalCorrectionControl } from "@/components/records/clinical-correction-control";
import { cn } from "@/lib/utils";
import { buildVitalTrend } from "@/lib/records/clinical-trends";
import { formatClinicalDateTime } from "@/lib/records/clinical-dates";
import { VITALS_BODY_CONDITION_MIN, VITALS_CAPILLARY_REFILL_MAX_SEC, VITALS_CAPILLARY_REFILL_MIN_SEC, VITALS_CAPILLARY_REFILL_STEP, VITALS_HEART_RATE_MAX_BPM, VITALS_HEART_RATE_MIN_BPM, VITALS_MUCOUS_MEMBRANE_MAX_LENGTH, VITALS_NOTES_MAX_LENGTH, VITALS_PAIN_SCORE_MAX, VITALS_PAIN_SCORE_MIN, VITALS_RESPIRATORY_RATE_MAX_BPM, VITALS_RESPIRATORY_RATE_MIN_BPM, VITALS_TEMPERATURE_MAX_C, VITALS_TEMPERATURE_MIN_C, VITALS_TEMPERATURE_STEP, VITALS_WEIGHT_MAX_KG, VITALS_WEIGHT_MIN_KG, VITALS_WEIGHT_STEP, isVitalsOptionalBodyConditionInputValid, isVitalsOptionalCapillaryRefillInputValid, isVitalsOptionalHeartRateInputValid, isVitalsOptionalPainScoreInputValid, isVitalsOptionalRespiratoryRateInputValid, isVitalsOptionalTemperatureInputValid, isVitalsOptionalTextInputValid, isVitalsOptionalWeightInputValid } from "@/lib/records/vitals-policy";
import { celsiusToFahrenheit, fahrenheitToCelsius, kilogramsToPounds, poundsToKilograms, roundClinicalMeasurement, type BodyConditionScale, type MeasurementSystem } from "@/lib/ambulatory-workspace";

function PatientDetailErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
      {message}
    </div>
  );
}

function PatientDetailLoadingPanel({ label }: { label: string }) {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-32 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

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

const VitalsTrendChart = dynamic(
  () =>
    import("@/components/patients/patient-trend-charts").then(
      (mod) => mod.VitalsTrendChart,
    ),
  {
    ssr: false,
    loading: PatientChartChunkLoading,
  },
);

type VitalsFormState = {
  temperatureC: string;
  heartRateBpm: string;
  respiratoryRateBpm: string;
  weightKg: string;
  bodyConditionScore: string;
  painScore: string;
  mucousMembrane: string;
  capillaryRefillSec: string;
  notes: string;
};

function initialVitalsForm(): VitalsFormState {
  return {
    temperatureC: "",
    heartRateBpm: "",
    respiratoryRateBpm: "",
    weightKg: "",
    bodyConditionScore: "",
    painScore: "",
    mucousMembrane: "",
    capillaryRefillSec: "",
    notes: "",
  };
}

function canonicalMeasurementInput(
  value: string,
  converter: ((value: number) => number) | undefined,
  scale: number,
): string {
  const trimmed = value.trim();
  if (!trimmed || !converter) return trimmed;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return trimmed;
  return String(roundClinicalMeasurement(converter(parsed), scale));
}

function formatClinicalTemperature(
  value: number | string | null | undefined,
  measurementSystem: MeasurementSystem,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return measurementSystem === "us_customary"
    ? `${roundClinicalMeasurement(celsiusToFahrenheit(parsed))} F`
    : `${roundClinicalMeasurement(parsed)} C`;
}

function formatClinicalWeight(
  value: number | string | null | undefined,
  measurementSystem: MeasurementSystem,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return measurementSystem === "us_customary"
    ? `${roundClinicalMeasurement(kilogramsToPounds(parsed))} lb`
    : `${roundClinicalMeasurement(parsed, 3)} kg`;
}

export function VitalsTab({
  patientId,
  timeZone,
  measurementSystem,
  bodyConditionScale,
  canRecordVitals,
  canCorrectClinicalRecords,
}: {
  patientId: string;
  timeZone?: string | null;
  measurementSystem: MeasurementSystem;
  bodyConditionScale: BodyConditionScale;
  canRecordVitals: boolean;
  canCorrectClinicalRecords: boolean;
}) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const {
    data: vitals,
    isLoading,
    error,
  } = trpc.vitals.listByPatient.useQuery({ patientId });
  const vitalsMissing = !isLoading && !error && !vitals;
  const vitalTrend = useMemo(
    () =>
      buildVitalTrend(
        (vitals ?? []).filter((vital) => !vital.correctionId),
        timeZone,
      ),
    [vitals, timeZone],
  );
  const record = trpc.vitals.record.useMutation({
    onSuccess: () => {
      toast.success(t("patients.vitals.saveVitals", "Vitals recorded"));
      void utils.patients.getById.invalidate();
      utils.vitals.listByPatient.invalidate({ patientId });
      setForm(initialVitalsForm());
    },
    onError: (err) => toast.error(err.message),
  });
  const correctVital = trpc.vitals.markEnteredInError.useMutation({
    onSuccess: async () => {
      toast.success(
        t(
          "patients.vitals.markedErrorSuccess",
          "Vital signs retained and marked entered in error",
        ),
      );
      await utils.patients.getById.invalidate();
      await utils.vitals.listByPatient.invalidate({ patientId });
    },
    onError: (err) => toast.error(err.message),
  });

  const [form, setForm] = useState<VitalsFormState>(() => initialVitalsForm());
  const set =
    (k: keyof VitalsFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  const num = (v?: string) => {
    if (v === undefined || v.trim() === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const canonicalTemperature = canonicalMeasurementInput(
    form.temperatureC,
    measurementSystem === "us_customary" ? fahrenheitToCelsius : undefined,
    1,
  );
  const canonicalWeight = canonicalMeasurementInput(
    form.weightKg,
    measurementSystem === "us_customary" ? poundsToKilograms : undefined,
    3,
  );
  const hasVitalsFormContent = Object.values(form).some(
    (value) => value.trim().length > 0,
  );
  const canSubmitVitals =
    canRecordVitals &&
    hasVitalsFormContent &&
    isVitalsOptionalTemperatureInputValid(canonicalTemperature) &&
    isVitalsOptionalHeartRateInputValid(form.heartRateBpm) &&
    isVitalsOptionalRespiratoryRateInputValid(form.respiratoryRateBpm) &&
    isVitalsOptionalWeightInputValid(canonicalWeight) &&
    isVitalsOptionalBodyConditionInputValid(
      form.bodyConditionScore,
      bodyConditionScale,
    ) &&
    isVitalsOptionalPainScoreInputValid(form.painScore) &&
    isVitalsOptionalTextInputValid(
      form.mucousMembrane,
      VITALS_MUCOUS_MEMBRANE_MAX_LENGTH,
    ) &&
    isVitalsOptionalCapillaryRefillInputValid(form.capillaryRefillSec) &&
    isVitalsOptionalTextInputValid(form.notes, VITALS_NOTES_MAX_LENGTH) &&
    !record.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitVitals) return;
    record.mutate({
      patientId,
      temperatureC: num(canonicalTemperature),
      heartRateBpm: num(form.heartRateBpm),
      respiratoryRateBpm: num(form.respiratoryRateBpm),
      weightKg: num(canonicalWeight),
      bodyConditionScore: num(form.bodyConditionScore),
      bodyConditionScale,
      painScore: num(form.painScore),
      mucousMembrane: form.mucousMembrane.trim() || undefined,
      capillaryRefillSec: num(form.capillaryRefillSec),
      notes: form.notes?.trim() || undefined,
    });
  }

  return (
    <div className="space-y-6">
      {canRecordVitals && (
        <form
          onSubmit={submit}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t(
                  "patients.vitals.temperature",
                  `Temp (${measurementSystem === "us_customary" ? "F" : "C"})`,
                )}
              </label>
              <input
                type="number"
                min={
                  measurementSystem === "us_customary"
                    ? roundClinicalMeasurement(
                        celsiusToFahrenheit(VITALS_TEMPERATURE_MIN_C),
                      )
                    : VITALS_TEMPERATURE_MIN_C
                }
                max={
                  measurementSystem === "us_customary"
                    ? roundClinicalMeasurement(
                        celsiusToFahrenheit(VITALS_TEMPERATURE_MAX_C),
                      )
                    : VITALS_TEMPERATURE_MAX_C
                }
                step={VITALS_TEMPERATURE_STEP}
                value={form.temperatureC}
                aria-invalid={
                  !isVitalsOptionalTemperatureInputValid(canonicalTemperature)
                }
                onChange={set("temperatureC")}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("patients.vitals.heartRate", "HR (bpm)")}
              </label>
              <input
                type="number"
                min={VITALS_HEART_RATE_MIN_BPM}
                max={VITALS_HEART_RATE_MAX_BPM}
                step={1}
                value={form.heartRateBpm}
                aria-invalid={
                  !isVitalsOptionalHeartRateInputValid(form.heartRateBpm)
                }
                onChange={set("heartRateBpm")}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("patients.vitals.respiratoryRate", "RR (bpm)")}
              </label>
              <input
                type="number"
                min={VITALS_RESPIRATORY_RATE_MIN_BPM}
                max={VITALS_RESPIRATORY_RATE_MAX_BPM}
                step={1}
                value={form.respiratoryRateBpm}
                aria-invalid={
                  !isVitalsOptionalRespiratoryRateInputValid(
                    form.respiratoryRateBpm,
                  )
                }
                onChange={set("respiratoryRateBpm")}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t(
                  "patients.vitals.weight",
                  `Weight (${measurementSystem === "us_customary" ? "lb" : "kg"})`,
                )}
              </label>
              <input
                type="number"
                min={
                  measurementSystem === "us_customary"
                    ? roundClinicalMeasurement(
                        kilogramsToPounds(VITALS_WEIGHT_MIN_KG),
                        3,
                      )
                    : VITALS_WEIGHT_MIN_KG
                }
                max={
                  measurementSystem === "us_customary"
                    ? Math.floor(kilogramsToPounds(VITALS_WEIGHT_MAX_KG))
                    : VITALS_WEIGHT_MAX_KG
                }
                step={VITALS_WEIGHT_STEP}
                value={form.weightKg}
                aria-invalid={
                  !isVitalsOptionalWeightInputValid(canonicalWeight)
                }
                onChange={set("weightKg")}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t(
                  "patients.vitals.bodyCondition",
                  `BCS (1-${bodyConditionScale})`,
                )}
              </label>
              <input
                type="number"
                min={VITALS_BODY_CONDITION_MIN}
                max={bodyConditionScale}
                step={1}
                value={form.bodyConditionScore}
                aria-invalid={
                  !isVitalsOptionalBodyConditionInputValid(
                    form.bodyConditionScore,
                    bodyConditionScale,
                  )
                }
                onChange={set("bodyConditionScore")}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("patients.vitals.painScore", "Pain (0-10)")}
              </label>
              <input
                type="number"
                min={VITALS_PAIN_SCORE_MIN}
                max={VITALS_PAIN_SCORE_MAX}
                step={1}
                value={form.painScore}
                aria-invalid={
                  !isVitalsOptionalPainScoreInputValid(form.painScore)
                }
                onChange={set("painScore")}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("patients.vitals.capillaryRefill", "CRT (sec)")}
              </label>
              <input
                type="number"
                min={VITALS_CAPILLARY_REFILL_MIN_SEC}
                max={VITALS_CAPILLARY_REFILL_MAX_SEC}
                step={VITALS_CAPILLARY_REFILL_STEP}
                value={form.capillaryRefillSec}
                aria-invalid={
                  !isVitalsOptionalCapillaryRefillInputValid(
                    form.capillaryRefillSec,
                  )
                }
                onChange={set("capillaryRefillSec")}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("patients.vitals.mucousMembranes", "Mucous Membrane")}
              </label>
              <input
                type="text"
                value={form.mucousMembrane}
                maxLength={VITALS_MUCOUS_MEMBRANE_MAX_LENGTH}
                onChange={set("mucousMembrane")}
                placeholder={t(
                  "patients.vitals.mucousMembranesPlaceholder",
                  "e.g. Pink and moist",
                )}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <input
            type="text"
            value={form.notes ?? ""}
            maxLength={VITALS_NOTES_MAX_LENGTH}
            onChange={set("notes")}
            placeholder={t(
              "patients.vitals.notesPlaceholder",
              "Notes (optional)",
            )}
            className="mt-3 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="mt-3 flex justify-end">
            <Button type="submit" disabled={!canSubmitVitals}>
              {record.isPending
                ? t("patients.actions.saving", "Saving...")
                : t("patients.vitals.saveVitals", "Record vitals")}
            </Button>
          </div>
        </form>
      )}

      {error ? (
        <PatientDetailErrorPanel
          message={`${t("patients.vitals.loadError", "Unable to load vitals.")} ${error.message}`}
        />
      ) : vitalsMissing ? (
        <PatientDetailErrorPanel
          message={t(
            "patients.vitals.loadErrorRetry",
            "Unable to load vitals. Please retry.",
          )}
        />
      ) : isLoading ? (
        <PatientDetailLoadingPanel
          label={t("patients.vitals.loading", "Loading vitals...")}
        />
      ) : !vitals || vitals.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={t("patients.vitals.empty", "No vitals recorded yet")}
        />
      ) : (
        <>
          {measurementSystem === "metric" && bodyConditionScale === 9 ? (
            <VitalsTrendChart data={vitalTrend} />
          ) : null}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">
                    {t("patients.weight.date", "Date")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("patients.vitals.colTemp", "Temp")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("patients.vitals.colHr", "HR")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("patients.vitals.colRr", "RR")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("patients.vitals.colWeight", "Weight")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("patients.vitals.colBcs", "BCS")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("patients.vitals.colPain", "Pain")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("patients.vitals.colStatus", "Chart status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {vitals.map((v) => (
                  <tr
                    key={v.id}
                    className={cn(
                      "border-b border-border last:border-0",
                      v.correctionId && "bg-destructive/5",
                    )}
                  >
                    <td className="px-3 py-2">
                      {formatClinicalDateTime(v.recordedAt, timeZone, "—")}
                    </td>
                    <td className="px-3 py-2">
                      {formatClinicalTemperature(
                        v.temperatureC,
                        measurementSystem,
                      )}
                    </td>
                    <td className="px-3 py-2">{v.heartRateBpm ?? "—"}</td>
                    <td className="px-3 py-2">{v.respiratoryRateBpm ?? "—"}</td>
                    <td className="px-3 py-2">
                      {formatClinicalWeight(v.weightKg, measurementSystem)}
                    </td>
                    <td className="px-3 py-2">
                      {v.bodyConditionScore !== null ? (
                        <>
                          {v.bodyConditionScore} / {v.bodyConditionScale}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">{v.painScore ?? "—"}</td>
                    <td className="min-w-64 px-3 py-2">
                      <ClinicalCorrectionControl
                        correction={
                          v.correctionId && v.correctionReason && v.correctedAt
                            ? {
                                id: v.correctionId,
                                reason: v.correctionReason,
                                correctedAt: v.correctedAt,
                                correctedByName: v.correctedByName,
                              }
                            : null
                        }
                        canCorrect={canCorrectClinicalRecords}
                        isPending={
                          correctVital.isPending &&
                          correctVital.variables?.recordId === v.id
                        }
                        onCorrect={(reason) =>
                          correctVital.mutateAsync({
                            patientId,
                            recordId: v.id,
                            reason,
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}