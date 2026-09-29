"use client";

import { useI18n } from "@/lib/i18n";
import {
  PREVISIT_INTAKE_FIELD_DEFINITIONS,
  type PrevisitIntakeFieldKey,
} from "@/lib/booking/previsit-intake";

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

export type BookingIntakeSettingsProps = {
  selectedFieldKeys: readonly PrevisitIntakeFieldKey[];
  onChange: (selectedFieldKeys: PrevisitIntakeFieldKey[]) => void;
  disabled?: boolean;
};

/** Controlled field picker for the clinic's public appointment request. */
export function BookingIntakeSettings({
  selectedFieldKeys,
  onChange,
  disabled = false,
}: BookingIntakeSettingsProps) {
  const { t } = useI18n();
  const selectedFieldKeySet = new Set(selectedFieldKeys);

  function updateField(fieldKey: PrevisitIntakeFieldKey, checked: boolean) {
    if (selectedFieldKeySet.has(fieldKey) === checked) return;

    const nextFieldKeys = PREVISIT_INTAKE_FIELD_DEFINITIONS.flatMap(
      ({ key }) =>
        (key === fieldKey ? checked : selectedFieldKeySet.has(key))
          ? [key]
          : [],
    );
    onChange(nextFieldKeys);
  }

  return (
    <section
      className="space-y-4 rounded-xl border border-gray-200 p-4"
      aria-labelledby="booking-intake-settings-heading"
    >
      <div>
        <h3
          id="booking-intake-settings-heading"
          className="text-sm font-semibold text-gray-900"
        >
          {t("settings.booking.intakeFields", "Pre-visit intake fields")}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {t(
            "settings.booking.intakeFieldsDescription",
            "Selected fields appear on the public appointment request. Responses remain owner-reported and do not overwrite saved client or patient information."
          )}
        </p>
      </div>

      <fieldset className="space-y-3" disabled={disabled}>
        <legend className="sr-only">
          {t(
            "settings.booking.intakeLegend",
            "Public appointment request fields"
          )}
        </legend>
        {PREVISIT_INTAKE_FIELD_DEFINITIONS.map((field) => {
          const inputId = `booking-intake-${field.key}`;
          const i18nConfig = FIELD_I18N_MAP[field.key];
          const label = i18nConfig
            ? t(i18nConfig.labelKey, field.label)
            : field.label;
          const placeholder = i18nConfig
            ? t(i18nConfig.descKey, field.placeholder)
            : field.placeholder;

          return (
            <div key={field.key} className="flex items-start gap-3">
              <input
                id={inputId}
                type="checkbox"
                checked={selectedFieldKeySet.has(field.key)}
                disabled={disabled}
                onChange={(event) =>
                  updateField(field.key, event.currentTarget.checked)
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 accent-teal-600"
              />
              <label htmlFor={inputId} className="min-w-0 text-sm">
                <span className="block font-medium text-gray-800">
                  {label}
                </span>
                <span className="block text-gray-500">{placeholder}</span>
              </label>
            </div>
          );
        })}
      </fieldset>

      <p className="text-sm text-gray-500">
        {t(
          "settings.booking.intakeFieldsOptional",
          "All fields are optional. Leave every field unchecked to hide this section from the public request form."
        )}
      </p>
    </section>
  );
}
