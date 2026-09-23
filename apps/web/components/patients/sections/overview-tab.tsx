"use client";

import type { ReactNode } from "react";
import { Activity, HeartPulse, ShieldCheck, TriangleAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PATIENT_SPECIES_EMOJI } from "@/lib/patients/species";
import { formatClinicalDate } from "@/lib/records/clinical-dates";
import { cn } from "@/lib/utils";

const speciesEmoji: Record<string, string> = PATIENT_SPECIES_EMOJI;

function formatSex(
  sex: string | null,
  t?: (key: string, fallback: string) => string,
): string {
  if (!sex) return t ? t("patients.profile.notRecorded", "Unknown") : "Unknown";
  const labels: Record<string, { key: string; label: string }> = {
    male: { key: "sexMale", label: "Male (Intact)" },
    female: { key: "sexFemale", label: "Female (Intact)" },
    male_neutered: { key: "sexMaleNeutered", label: "Male (Neutered)" },
    female_spayed: { key: "sexFemaleSpayed", label: "Female (Spayed)" },
  };
  const match = labels[sex];
  if (!match) return sex;
  return t ? t("patients.form." + match.key, match.label) : match.label;
}

function calculateAge(
  dob: string | null,
  t?: (
    key: string,
    fallback: string,
    params?: Record<string, string | number>,
  ) => string,
): string {
  if (!dob) return t ? t("patients.profile.notRecorded", "Not recorded") : "—";
  const born = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  let months = now.getMonth() - born.getMonth();
  if (now.getDate() < born.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years > 0) {
    const yStr = t
      ? t("patients.profile.yearsOld", "{count}y", { count: years })
      : years + "y";
    if (months > 0) {
      const mStr = t
        ? t("patients.profile.monthsOld", "{count}m", { count: months })
        : months + "m";
      return yStr + " " + mStr;
    }
    return yStr;
  }
  return t
    ? t("patients.profile.monthsOld", "{count}m", { count: Math.max(months, 0) })
    : Math.max(months, 0) + "m";
}

interface PatientOverview {
  name: string;
  species: string | null;
  breed: string | null;
  sex: string | null;
  dob: string | null;
  color: string | null;
  microchipNumber: string | null;
  status: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
}

export interface PatientInsuranceSummary {
  providerName: string | null;
  policyNumber: string | null;
  expirationDate: string | null;
  coveragePercent: number | null;
}

interface OverviewTabProps {
  patient: PatientOverview;
  recordsTimeZone: string | null;
  clientPhone?: string | null;
  latestVitalsSummary?: string | null;
  latestVitalsAt?: string | null;
  activeProblems?: { description: string; onsetDate?: string | null }[];
  allergies?: { allergen: string; severity: string | null }[];
  activeMedicationsCount?: number;
  insurance?: PatientInsuranceSummary | null;
  insuranceLoading?: boolean;
  insuranceExpired?: boolean;
}

function DataCell({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 truncate text-sm font-medium",
          mono && "font-mono tabular-nums slashed-zero",
          className,
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: "danger" | "warning" | "success" | "info" | "neutral";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    danger: "border-red-300/70 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
    warning:
      "border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    success:
      "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    info: "border-sky-300/70 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300",
    neutral: "border-border bg-muted/40 text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

function severityTone(severity: string | null) {
  if (severity === "severe") return "danger" as const;
  if (severity === "moderate") return "warning" as const;
  return "neutral" as const;
}

export function OverviewTab({
  patient,
  recordsTimeZone,
  clientPhone,
  latestVitalsSummary,
  latestVitalsAt,
  activeProblems = [],
  allergies = [],
  activeMedicationsCount = 0,
  insurance,
  insuranceLoading = false,
  insuranceExpired = false,
}: OverviewTabProps) {
  const { t } = useI18n();
  const ownerName = patient.clientFirstName
    ? [patient.clientFirstName, patient.clientLastName].filter(Boolean).join(" ")
    : t("patients.profile.noOwner", "No owner assigned");
  const speciesLabel = patient.species
    ? patient.species in speciesEmoji
      ? t(
          "patients.species_" + patient.species,
          patient.species.charAt(0).toUpperCase() + patient.species.slice(1),
        )
      : patient.species.charAt(0).toUpperCase() + patient.species.slice(1)
    : "—";

  return (
    <div className="space-y-4">
      <section
        aria-labelledby="patient-overview-facts"
        className="rounded-lg border border-border bg-card p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            id="patient-overview-facts"
            className="font-heading text-sm font-semibold"
          >
            {t("patients.profile.basicInfo", "Basic Information")}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={patient.status === "deceased" ? "neutral" : "info"}>
              {patient.status
                ? t("patients.status_" + patient.status, patient.status)
                : t("patients.status_active", "Active")}
            </StatusChip>
            <StatusChip tone={allergies.length > 0 ? "danger" : "neutral"}>
              <TriangleAlert className="h-3 w-3" />
              {t("patients.profile.allergies", "Allergies")} {allergies.length}
            </StatusChip>
            <StatusChip tone="neutral">
              {t("patients.profile.activeMedications", "Active medications")}{" "}
              <span className="tabular-nums">{activeMedicationsCount}</span>
            </StatusChip>
          </div>
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <DataCell
            label={t("patients.form.species", "Species")}
            value={speciesLabel}
          />
          <DataCell
            label={t("patients.form.breed", "Breed")}
            value={patient.breed || t("patients.profile.unknownBreed", "Unknown breed")}
          />
          <DataCell label={t("patients.form.sex", "Sex")} value={formatSex(patient.sex, t)} />
          <DataCell
            label={t("patients.profile.dob", "Date of Birth")}
            value={formatClinicalDate(patient.dob, recordsTimeZone, "—")}
          />
          <DataCell
            label={t("patients.profile.age", "Age")}
            value={calculateAge(patient.dob, t)}
          />
          <DataCell
            label={t("patients.form.microchipNumber", "Microchip Number")}
            value={patient.microchipNumber || "—"}
            mono
          />
          <DataCell
            label={t("patients.form.color", "Color")}
            value={patient.color || "—"}
          />
          <DataCell
            label={t("patients.profile.owner", "Owner")}
            value={ownerName}
          />
          <DataCell
            label={t("patients.profile.phone", "Phone")}
            value={clientPhone || t("patients.overview.noPhone", "No phone on file")}
            mono
          />
          <DataCell
            label={t("patients.tabs.insurance", "Insurance")}
            value={
              insuranceLoading
                ? t("common.loading", "Loading...")
                : insurance?.providerName
                  ? insurance.providerName
                  : t("patients.overview.insuranceNone", "No policy on file")
            }
            className={
              insurance?.providerName && !insuranceExpired
                ? "text-emerald-700 dark:text-emerald-400"
                : undefined
            }
          />
        </dl>
      </section>

      <section
        aria-labelledby="patient-overview-summary"
        className="rounded-lg border border-border bg-card p-4"
      >
        <h3
          id="patient-overview-summary"
          className="font-heading text-sm font-semibold"
        >
          {t("patients.tabs.healthSummary", "Health summary")}
        </h3>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              {t("patients.profile.latestVitals", "Latest vitals")}
            </p>
            <p className="mt-1 text-sm font-medium tabular-nums">
              {latestVitalsSummary || t("patients.overview.vitalsNone", "No vitals on record")}
            </p>
            {latestVitalsAt ? (
              <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                {latestVitalsAt}
              </p>
            ) : null}
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <HeartPulse className="h-3.5 w-3.5" />
              {t("patients.profile.activeProblems", "Active problems")}
            </p>
            {activeProblems.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {activeProblems.map((problem) => (
                  <StatusChip key={problem.description} tone="warning">
                    {problem.description}
                    {problem.onsetDate ? (
                      <span className="font-mono tabular-nums opacity-70">
                        {formatClinicalDate(problem.onsetDate, recordsTimeZone, "—")}
                      </span>
                    ) : null}
                  </StatusChip>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("patients.overview.noActiveProblems", "No active diagnoses")}
              </p>
            )}
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <TriangleAlert className="h-3.5 w-3.5" />
              {t("patients.profile.allergies", "Allergies")}
            </p>
            {allergies.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {allergies.map((allergy) => (
                  <StatusChip key={allergy.allergen} tone={severityTone(allergy.severity)}>
                    {allergy.allergen}
                    {allergy.severity ? (
                      <span className="uppercase opacity-80">{allergy.severity}</span>
                    ) : null}
                  </StatusChip>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("patients.overview.noAllergies", "No known allergies")}
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="patient-overview-insurance"
        className="rounded-lg border border-border bg-card p-4"
      >
        <h3
          id="patient-overview-insurance"
          className="flex items-center gap-1.5 font-heading text-sm font-semibold"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {t("patients.tabs.insurance", "Insurance")}
        </h3>
        {insuranceLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("common.loading", "Loading...")}
          </p>
        ) : insurance?.providerName ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <DataCell
              label={t("patients.overview.insuranceProvider", "Provider")}
              value={insurance.providerName}
            />
            <DataCell
              label={t("patients.overview.insurancePolicyLabel", "Policy")}
              value={insurance.policyNumber || "—"}
              mono
            />
            <DataCell
              label={t("patients.overview.insuranceValidUntil", "Valid until")}
              value={formatClinicalDate(insurance.expirationDate, recordsTimeZone, "—")}
            />
            <DataCell
              label={t("patients.overview.insuranceCoverage", "Coverage")}
              value={
                insurance.coveragePercent !== null
                  ? `${insurance.coveragePercent} %`
                  : "—"
              }
            />
            <StatusChip tone={insuranceExpired ? "danger" : "success"}>
              {insuranceExpired
                ? t("patients.overview.insuranceExpired", "Expired")
                : t("patients.overview.insuranceActive", "Active")}
            </StatusChip>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("patients.overview.insuranceNone", "No policy on file")}
          </p>
        )}
      </section>
    </div>
  );
}
