export const VACCINATION_NAME_MAX_LENGTH = 255;
export const VACCINATION_PRODUCT_NAME_MAX_LENGTH = 255;
export const VACCINATION_LOT_NUMBER_MAX_LENGTH = 64;
export const VACCINATION_MANUFACTURER_MAX_LENGTH = 128;
export const VACCINATION_RABIES_TAG_MAX_LENGTH = 64;
export const VACCINATION_LICENSED_DURATION_MIN_MONTHS = 1;
export const VACCINATION_LICENSED_DURATION_MAX_MONTHS = 120;

export function isRabiesVaccineName(value: string): boolean {
  return /(^|\s|[-_/])rabies($|\s|[-_/])/i.test(value.trim());
}

const DATE_INPUT_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isVaccinationRequiredTextInputValid(
  value: string,
  maxLength: number,
): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength;
}

export function isVaccinationOptionalTextInputValid(
  value: string,
  maxLength: number,
): boolean {
  return value.trim().length <= maxLength;
}

export function isVaccinationDateInputValid(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    DATE_INPUT_RE.test(value) &&
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function isVaccinationOptionalDateInputValid(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || isVaccinationDateInputValid(trimmed);
}
