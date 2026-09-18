/**
 * Region/locale helpers. Pure — gates currency + date formatting and supplies
 * sensible regional defaults so the app isn't hardcoded to US/USD/8% tax.
 * `country` is ISO 3166-1 alpha-2 (e.g. "US", "GB"); `currency` ISO 4217.
 */

const COUNTRY_LOCALE: Record<string, string> = {
  SK: "sk-SK",
  US: "en-US",
  GB: "en-GB",
  IE: "en-IE",
  CA: "en-CA",
  AU: "en-AU",
};

export function localeForCountry(country?: string | null): string {
  return COUNTRY_LOCALE[(country ?? "US").toUpperCase()] ?? "en-US";
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = "eur",
  country?: string | null
): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
  return new Intl.NumberFormat(
    localeForCountry(country ?? (currency.toLowerCase() === "eur" ? "SK" : "US")),
    {
      style: "currency",
      currency: currency.toUpperCase(),
    }
  ).format(Number.isFinite(n) ? (n as number) : 0);
}

export function formatDate(date: Date | string, country?: string | null): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(localeForCountry(country), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    // Date-only values must not shift by the runtime's timezone.
    timeZone: "UTC",
  }).format(d);
}

/** Which controlled-drug / prescribing framework applies (used later, P1). */
export function regulatoryFramework(country?: string | null): "uk_vmd" | "us_dea" {
  return (country ?? "US").toUpperCase() === "GB" ? "uk_vmd" : "us_dea";
}

export interface RegionDefaults {
  currency: string;
  /** Standard sales-tax / VAT rate as a percent string (e.g. "20.00"). */
  taxRatePercent: string;
  timezone: string;
}

/** Defaults applied when a practice picks a country (onboarding / settings). */
export function regionDefaults(country?: string | null): RegionDefaults {
  switch ((country ?? "US").toUpperCase()) {
    case "SK":
      return { currency: "eur", taxRatePercent: "20.00", timezone: "Europe/Bratislava" };
    case "GB":
      return { currency: "gbp", taxRatePercent: "20.00", timezone: "Europe/London" };
    case "IE":
      return { currency: "eur", taxRatePercent: "23.00", timezone: "Europe/Dublin" };
    case "CA":
      return { currency: "cad", taxRatePercent: "5.00", timezone: "America/Toronto" };
    case "AU":
      return { currency: "aud", taxRatePercent: "10.00", timezone: "Australia/Sydney" };
    default:
      return { currency: "usd", taxRatePercent: "8.00", timezone: "America/New_York" };
  }
}

const DOCTOR_TITLE_REGEX = /^((?:mvdr|mudr|dr|doc|prof)\.?\s+)+/i;

/**
 * Strips duplicate or leading academic/professional medical titles like "MVDr.", "Dr.", "MUDr."
 * so that localized prefixes can be applied cleanly without duplication (e.g. "MVDr. MVDr. ...").
 */
export function stripDoctorTitle(name: string | null | undefined): string {
  if (!name) return "";
  return name.trim().replace(DOCTOR_TITLE_REGEX, "").trim();
}

export type I18nTranslateFn = (
  key: string,
  fallback?: string,
  params?: Record<string, string | number>
) => string;

/**
 * Formats a veterinarian/doctor name with the localized title prefix ("MVDr. {name}" in SK,
 * "Dr. {name}" in EN), automatically deduplicating existing title prefixes.
 */
export function formatDoctorName(
  name: string | null | undefined,
  t: I18nTranslateFn,
  prefixKey = "schedule.drPrefix"
): string {
  if (!name) return "";
  const cleaned = stripDoctorTitle(name);
  if (!cleaned) return name.trim();
  return t(prefixKey, "Dr. {name}", { name: cleaned });
}

export const KNOWN_SPECIES = [
  "canine",
  "feline",
  "avian",
  "rabbit",
  "reptile",
  "equine",
  "bovine",
  "ovine",
  "caprine",
  "porcine",
  "poultry",
  "camelid",
  "other",
] as const;

export type KnownSpecies = (typeof KNOWN_SPECIES)[number];

/**
 * Localizes species names (e.g. "feline" -> "Mačka", "canine" -> "Pes") using i18n keys.
 */
export function formatSpecies(
  species: string | null | undefined,
  t: I18nTranslateFn
): string {
  if (!species) return "";
  const trimmed = species.trim();
  const lower = trimmed.toLowerCase();
  if ((KNOWN_SPECIES as readonly string[]).includes(lower)) {
    return t(`species.${lower}`, trimmed);
  }
  return trimmed;
}

