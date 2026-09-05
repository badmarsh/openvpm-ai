"use client";

import React, { useId, type Dispatch, type SetStateAction } from "react";
import { useI18n } from "@/lib/i18n";
import {
  PREVISIT_INTAKE_FIELD_DEFINITIONS,
  PREVISIT_INTAKE_FIELD_MAX_LENGTH,
  type PrevisitIntake,
  type PrevisitIntakeFieldKey,
} from "@/lib/booking/previsit-intake";
import { cn } from "@/lib/utils";

const FIELD_I18N_MAP: Record<
  PrevisitIntakeFieldKey,
  { labelKey: string; descKey: string }
> = {
  serviceAddress: {
    labelKey: "settings.booking.fieldServiceAddress",
    descKey: "settings.booking.fieldServiceAddressDescription",
  },
  symptoms: {
    labelKey: "settings.booking.fieldCurrentSigns",
    descKey: "settings.booking.fieldCurrentSignsDescription",
  },
  concernOnset: {
    labelKey: "settings.booking.fieldWhenStarted",
    descKey: "settings.booking.fieldWhenStartedDescription",
  },
  currentMedications: {
    labelKey: "settings.booking.fieldCurrentMeds",
    descKey: "settings.booking.fieldCurrentMedsDescription",
  },
  allergies: {
    labelKey: "settings.booking.fieldAllergies",
    descKey: "settings.booking.fieldAllergiesDescription",
  },
  medicalHistory: {
    labelKey: "settings.booking.fieldMedicalHistory",
    descKey: "settings.booking.fieldMedicalHistoryDescription",
  },
  diet: {
    labelKey: "settings.booking.fieldDiet",
    descKey: "settings.booking.fieldDietDescription",
  },
  handlingNotes: {
    labelKey: "settings.booking.fieldHandling",
    descKey: "settings.booking.fieldHandlingDescription",
  },
};

export interface PrevisitIntakeFieldsProps {
  enabledFieldKeys: readonly PrevisitIntakeFieldKey[];
  value: PrevisitIntake;
  onChange: Dispatch<SetStateAction<PrevisitIntake>>;
  disabled?: boolean;
  className?: string;
}

/** Controlled, client-facing pre-visit context fields. */
export function PrevisitIntakeFields({
  enabledFieldKeys,
  value,
  onChange,
  disabled = false,
  className,
}: PrevisitIntakeFieldsProps) {
  const { t } = useI18n();
  const idPrefix = useId();
  const enabledFields = new Set(enabledFieldKeys);
  const fields = PREVISIT_INTAKE_FIELD_DEFINITIONS.filter(({ key }) =>
    enabledFields.has(key),
  );

  if (fields.length === 0) return null;

  const descriptionId = `${idPrefix}-description`;

  return (
    <details
      className={cn(
        "rounded-xl border border-gray-200 bg-gray-50 p-4",
        className,
      )}
    >
      <summary className="cursor-pointer text-sm font-semibold text-gray-900">
        {t("book.intakeSummary", "Visit location and health details")}
        <span className="ml-1 font-normal text-gray-500">
          ({t("book.optional", "optional")})
        </span>
      </summary>
      <p id={descriptionId} className="mt-2 text-xs leading-5 text-gray-500">
        {t(
          "book.intakeDescription",
          "Share where the visit should happen and anything that would help the clinic prepare. These are owner-reported details and remain unverified until the care team reviews and confirms them."
        )}
      </p>
      <div className="mt-4 space-y-4">
        {fields.map((field) => {
          const fieldId = `${idPrefix}-intake-${field.key}`;
          const i18nConfig = FIELD_I18N_MAP[field.key];
          const label = i18nConfig
            ? t(i18nConfig.labelKey, field.label)
            : field.label;
          const placeholder = i18nConfig
            ? t(i18nConfig.descKey, field.placeholder)
            : field.placeholder;

          return (
            <div key={field.key}>
              <label
                htmlFor={fieldId}
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                {label}
              </label>
              <textarea
                id={fieldId}
                aria-describedby={descriptionId}
                value={value[field.key] ?? ""}
                onChange={(event) => {
                  const nextValue = event.currentTarget.value;
                  onChange((current) => ({
                    ...current,
                    [field.key]: nextValue || undefined,
                  }));
                }}
                disabled={disabled}
                rows={2}
                maxLength={PREVISIT_INTAKE_FIELD_MAX_LENGTH}
                placeholder={placeholder}
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          );
        })}
      </div>
    </details>
  );
}
