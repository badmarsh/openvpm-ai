import type { Dispatch, SetStateAction } from "react";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import {
  isRabiesVaccineName,
  VACCINATION_LICENSED_DURATION_MAX_MONTHS,
  VACCINATION_LICENSED_DURATION_MIN_MONTHS,
  VACCINATION_LOT_NUMBER_MAX_LENGTH,
  VACCINATION_MANUFACTURER_MAX_LENGTH,
  VACCINATION_NAME_MAX_LENGTH,
  VACCINATION_PRODUCT_NAME_MAX_LENGTH,
  VACCINATION_RABIES_TAG_MAX_LENGTH,
  isVaccinationOptionalDateInputValid,
  isVaccinationOptionalTextInputValid,
  isVaccinationRequiredTextInputValid,
} from "@/lib/records/vaccination-policy";

export type VaccinationFormState = {
  vaccineName: string;
  productName: string;
  lotNumber: string;
  manufacturer: string;
  productExpirationDate: string;
  doseType: "" | "initial" | "booster";
  licensedDurationMonths: string;
  rabiesTagNumber: string;
  supervisingVeterinarianId: string;
  nextDueDate: string;
};

export type VaccinationProviderOption = {
  id: string;
  name: string;
  licenseNumber: string | null;
};

export function initialVaccinationForm(): VaccinationFormState {
  return {
    vaccineName: "",
    productName: "",
    lotNumber: "",
    manufacturer: "",
    productExpirationDate: "",
    doseType: "",
    licensedDurationMonths: "",
    rabiesTagNumber: "",
    supervisingVeterinarianId: "",
    nextDueDate: "",
  };
}

export function isVaccinationFormValid(form: VaccinationFormState): boolean {
  const duration = Number(form.licensedDurationMonths);
  const baseValid =
    isVaccinationRequiredTextInputValid(
      form.vaccineName,
      VACCINATION_NAME_MAX_LENGTH,
    ) &&
    isVaccinationOptionalTextInputValid(
      form.productName,
      VACCINATION_PRODUCT_NAME_MAX_LENGTH,
    ) &&
    isVaccinationOptionalTextInputValid(
      form.lotNumber,
      VACCINATION_LOT_NUMBER_MAX_LENGTH,
    ) &&
    isVaccinationOptionalTextInputValid(
      form.manufacturer,
      VACCINATION_MANUFACTURER_MAX_LENGTH,
    ) &&
    isVaccinationOptionalTextInputValid(
      form.rabiesTagNumber,
      VACCINATION_RABIES_TAG_MAX_LENGTH,
    ) &&
    isVaccinationOptionalDateInputValid(form.productExpirationDate) &&
    isVaccinationOptionalDateInputValid(form.nextDueDate);
  if (!baseValid || !isRabiesVaccineName(form.vaccineName)) return baseValid;

  return (
    isVaccinationRequiredTextInputValid(
      form.productName,
      VACCINATION_PRODUCT_NAME_MAX_LENGTH,
    ) &&
    isVaccinationRequiredTextInputValid(
      form.manufacturer,
      VACCINATION_MANUFACTURER_MAX_LENGTH,
    ) &&
    isVaccinationRequiredTextInputValid(
      form.lotNumber,
      VACCINATION_LOT_NUMBER_MAX_LENGTH,
    ) &&
    Boolean(form.productExpirationDate) &&
    Boolean(form.nextDueDate) &&
    Boolean(form.doseType) &&
    Number.isInteger(duration) &&
    duration >= VACCINATION_LICENSED_DURATION_MIN_MONTHS &&
    duration <= VACCINATION_LICENSED_DURATION_MAX_MONTHS &&
    Boolean(form.supervisingVeterinarianId)
  );
}

export function VaccinationFormFields({
  form,
  setForm,
  providers,
  currentUserId,
}: {
  form: VaccinationFormState;
  setForm: Dispatch<SetStateAction<VaccinationFormState>>;
  providers?: VaccinationProviderOption[];
  currentUserId?: string;
}) {
  const { t } = useI18n();
  const rabies = isRabiesVaccineName(form.vaccineName);
  const update = <Field extends keyof VaccinationFormState>(
    field: Field,
    value: VaccinationFormState[Field],
  ) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t("records.vaccinations.form.vaccine", "Vaccine *")}
        </label>
        <Input
          name="vaccineName"
          required
          value={form.vaccineName}
          maxLength={VACCINATION_NAME_MAX_LENGTH}
          onChange={(event) => {
            const vaccineName = event.target.value;
            const currentProvider = providers?.find(
              (provider) => provider.id === currentUserId,
            );
            setForm((current) => ({
              ...current,
              vaccineName,
              supervisingVeterinarianId:
                current.supervisingVeterinarianId ||
                (isRabiesVaccineName(vaccineName)
                  ? currentProvider?.id ?? ""
                  : ""),
            }));
          }}
          placeholder={t("records.vaccinations.form.vaccinePlaceholder", "e.g. Rabies")}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t("records.vaccinations.form.productName", "Product name")}{rabies ? " *" : ""}
        </label>
        <Input
          name="productName"
          required={rabies}
          value={form.productName}
          maxLength={VACCINATION_PRODUCT_NAME_MAX_LENGTH}
          onChange={(event) => update("productName", event.target.value)}
          placeholder={t("records.vaccinations.form.productNamePlaceholder", "e.g. Defensor 3")}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t("records.vaccinations.form.nextDue", "Next due")}{rabies ? " *" : ""}
        </label>
        <Input
          name="nextDueDate"
          type="date"
          required={rabies}
          value={form.nextDueDate}
          aria-invalid={!isVaccinationOptionalDateInputValid(form.nextDueDate)}
          onChange={(event) => update("nextDueDate", event.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t("records.vaccinations.form.lotNumber", "Lot number")}{rabies ? " *" : ""}
        </label>
        <Input
          name="lotNumber"
          required={rabies}
          value={form.lotNumber}
          maxLength={VACCINATION_LOT_NUMBER_MAX_LENGTH}
          onChange={(event) => update("lotNumber", event.target.value)}
          placeholder={t("records.vaccinations.form.lotNumberPlaceholder", "e.g. RAB-2026-04")}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t("records.vaccinations.form.manufacturer", "Manufacturer")}{rabies ? " *" : ""}
        </label>
        <Input
          name="manufacturer"
          required={rabies}
          value={form.manufacturer}
          maxLength={VACCINATION_MANUFACTURER_MAX_LENGTH}
          onChange={(event) => update("manufacturer", event.target.value)}
          placeholder={t("records.vaccinations.form.manufacturerPlaceholder", "e.g. Zoetis")}
        />
      </div>
      {rabies ? (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("records.vaccinations.form.productExpiration", "Product expiration *")}
            </label>
            <Input
              name="productExpirationDate"
              type="date"
              required
              value={form.productExpirationDate}
              onChange={(event) =>
                update("productExpirationDate", event.target.value)
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("records.vaccinations.form.doseType", "Dose type *")}
            </label>
            <select
              name="doseType"
              required
              value={form.doseType}
              onChange={(event) =>
                update(
                  "doseType",
                  event.target.value as VaccinationFormState["doseType"],
                )
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("records.vaccinations.form.chooseDoseType", "Choose dose type")}</option>
              <option value="initial">{t("records.vaccinations.form.initialDose", "Initial dose")}</option>
              <option value="booster">{t("records.vaccinations.form.boosterDose", "Booster dose")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("records.vaccinations.form.licensedDuration", "Licensed duration *")}
            </label>
            <select
              name="licensedDurationMonths"
              required
              value={form.licensedDurationMonths}
              onChange={(event) =>
                update("licensedDurationMonths", event.target.value)
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("records.vaccinations.form.chooseDuration", "Choose duration")}</option>
              <option value="12">{t("records.vaccinations.form.duration1Year", "1 year")}</option>
              <option value="36">{t("records.vaccinations.form.duration3Years", "3 years")}</option>
              <option value="48">{t("records.vaccinations.form.duration4Years", "4 years")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("records.vaccinations.form.rabiesTagNumber", "Rabies tag number")}
            </label>
            <Input
              name="rabiesTagNumber"
              value={form.rabiesTagNumber}
              maxLength={VACCINATION_RABIES_TAG_MAX_LENGTH}
              onChange={(event) => update("rabiesTagNumber", event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("records.vaccinations.form.supervisingVeterinarian", "Supervising veterinarian *")}
            </label>
            <select
              name="supervisingVeterinarianId"
              required
              value={form.supervisingVeterinarianId}
              onChange={(event) =>
                update("supervisingVeterinarianId", event.target.value)
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("records.vaccinations.form.chooseVeterinarian", "Choose veterinarian")}</option>
              {providers?.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                  {provider.licenseNumber
                    ? ` — ${t("records.vaccinations.form.license", "License")} ${provider.licenseNumber}`
                    : ` — ${t("records.vaccinations.form.licenseMissing", "license missing")}`}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(
                "records.vaccinations.form.licenseNote",
                "Rabies certificates require the veterinarian's license number in Staff settings.",
              )}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
