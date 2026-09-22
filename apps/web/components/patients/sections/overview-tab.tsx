"use client";

import { useI18n } from "@/lib/i18n";
import { PATIENT_SPECIES_EMOJI } from "@/lib/patients/species";
import { formatClinicalDate } from "@/lib/records/clinical-dates";

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

interface OverviewTabProps {
  patient: PatientOverview;
  recordsTimeZone: string | null;
}

export function OverviewTab({ patient, recordsTimeZone }: OverviewTabProps) {
  const { t } = useI18n();

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="font-heading text-base font-semibold mb-4">
        {t("patients.profile.basicInfo", "Basic Information")}
      </h3>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">
            {t("patients.form.name", "Name")}
          </dt>
          <dd className="mt-0.5 text-sm font-medium">{patient.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            {t("patients.form.species", "Species")}
          </dt>
          <dd className="mt-0.5 text-sm font-medium">
            {patient.species
              ? patient.species in speciesEmoji
                ? t(
                    "patients.species_" + patient.species,
                    patient.species.charAt(0).toUpperCase() +
                      patient.species.slice(1),
                  )
                : patient.species.charAt(0).toUpperCase() +
                  patient.species.slice(1)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            {t("patients.form.breed", "Breed")}
          </dt>
          <dd className="mt-0.5 text-sm font-medium">
            {patient.breed || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            {t("patients.form.sex", "Sex")}
          </dt>
          <dd className="mt-0.5 text-sm font-medium">
            {formatSex(patient.sex, t)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            {t("patients.profile.dob", "Date of Birth")}
          </dt>
          <dd className="mt-0.5 text-sm font-medium">
            {formatClinicalDate(patient.dob, recordsTimeZone, "—")}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            {t("patients.profile.age", "Age")}
          </dt>
          <dd className="mt-0.5 text-sm font-medium">
            {calculateAge(patient.dob, t)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            {t("patients.form.color", "Color")}
          </dt>
          <dd className="mt-0.5 text-sm font-medium">
            {patient.color || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            {t("patients.form.microchipNumber", "Microchip Number")}
          </dt>
          <dd className="mt-0.5 text-sm font-medium">
            {patient.microchipNumber || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            {t("patients.form.status", "Status")}
          </dt>
          <dd className="mt-0.5 text-sm font-medium capitalize">
            {patient.status
              ? t("patients.status_" + patient.status, patient.status)
              : t("patients.status_active", "Active")}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            {t("patients.profile.owner", "Owner")}
          </dt>
          <dd className="mt-0.5 text-sm font-medium">
            {patient.clientFirstName
              ? patient.clientFirstName + " " + patient.clientLastName
              : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}