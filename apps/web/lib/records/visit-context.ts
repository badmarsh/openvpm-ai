/**
 * GT-005: visit context handed to the AI SOAP draft.
 *
 * `ai.draftSoapNote` accepts free-text `visitContext` (bounded by
 * `AI_SOURCE_MAX_LENGTH`). Everything the model may rely on has to come from
 * an explicit, auditable source, so this module is the single place that turns
 * the linked appointment plus today's measurements into (a) the request text
 * and (b) the list of items the clinician sees before drafting.
 *
 * Pure functions only: no React, no tRPC, no DB. The UI decides how each item
 * is labelled and localized.
 */

/** Matches the server-side bound in `ai.draftSoapNote` (optionalClinicalTextInput). */
export const VISIT_CONTEXT_MAX_LENGTH = 2000;

export type VisitContextAppointment = {
  typeName?: string | null;
  startTime?: Date | string | null;
  doctorName?: string | null;
  locationName?: string | null;
  /** Chief complaint / reason for the visit, captured by the front desk. */
  notes?: string | null;
} | null;

export type VisitContextVitalEntry = {
  recordedAt?: Date | string | null;
  temperatureC?: number | string | null;
  heartRateBpm?: number | string | null;
  respiratoryRateBpm?: number | string | null;
  weightKg?: number | string | null;
  /** Set when the entry was marked entered in error; such rows never feed AI. */
  correctionId?: string | null;
};

export type VisitContextVitalEntries =
  | readonly VisitContextVitalEntry[]
  | null
  | undefined;

export type VisitContextItemId =
  | "visitType"
  | "reason"
  | "doctor"
  | "location"
  | "temperatureC"
  | "heartRateBpm"
  | "respiratoryRateBpm"
  | "weightKg";

export type VisitContextItem = {
  id: VisitContextItemId;
  /** Already formatted value (unit included where relevant). */
  value: string;
};

export type VisitContext = {
  /** Ordered, de-duplicated context items for the pre-draft banner. */
  items: VisitContextItem[];
  /** Text sent to the model, or null when nothing usable is available. */
  text: string | null;
  hasContext: boolean;
};

export const EMPTY_VISIT_CONTEXT: VisitContext = {
  items: [],
  text: null,
  hasContext: false,
};

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Trailing-zero-free fixed-decimal formatting (no locale surprises in context). */
function formatMeasurement(
  value: number | string | null | undefined,
  fractionDigits: number,
): string | null {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  return String(Number(parsed.toFixed(fractionDigits)));
}

/**
 * The most recent entry that still counts as clinical truth. Entries marked
 * entered in error are dropped: a retracted measurement must never be handed
 * to a language model as fact.
 */
export function latestUsableVitals(
  entries: VisitContextVitalEntries,
): VisitContextVitalEntry | null {
  if (!entries || entries.length === 0) return null;
  const usable = entries.filter((entry) => !entry.correctionId);
  return usable.length > 0 ? usable[0]! : null;
}

function formatVisitTimestamp(startTime: Date | string | null | undefined): string | null {
  if (!startTime) return null;
  const parsed = startTime instanceof Date ? startTime : new Date(startTime);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("sk-SK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Builds the visit context from the linked appointment and today's vitals.
 *
 * Vitals contribute only when they exist; an appointment without notes still
 * contributes its type/time/doctor. When neither source yields anything, the
 * result is `hasContext: false` so the UI can warn the clinician instead of
 * silently drafting from chart history alone.
 */
export function buildVisitContext({
  appointment,
  vitals,
}: {
  appointment: VisitContextAppointment;
  vitals: VisitContextVitalEntries;
}): VisitContext {
  const items: VisitContextItem[] = [];
  const textLines: string[] = [];

  const visitType = normalizeText(appointment?.typeName);
  if (visitType) {
    items.push({ id: "visitType", value: visitType });
  }

  const visitTimestamp = formatVisitTimestamp(appointment?.startTime);
  if (visitTimestamp) {
    textLines.push(`Termín: ${visitTimestamp}`);
  }

  const reason = normalizeText(appointment?.notes);
  if (reason) {
    items.push({ id: "reason", value: reason });
  }

  const doctor = normalizeText(appointment?.doctorName);
  if (doctor) {
    items.push({ id: "doctor", value: doctor });
  }

  const location = normalizeText(appointment?.locationName);
  if (location) {
    items.push({ id: "location", value: location });
  }

  const latestVitals = latestUsableVitals(vitals);
  const temperature = formatMeasurement(latestVitals?.temperatureC, 1);
  if (temperature !== null) {
    items.push({ id: "temperatureC", value: `${temperature} \u00b0C` });
  }
  const heartRate = formatMeasurement(latestVitals?.heartRateBpm, 0);
  if (heartRate !== null) {
    items.push({ id: "heartRateBpm", value: `${heartRate}/min` });
  }
  const respiratoryRate = formatMeasurement(latestVitals?.respiratoryRateBpm, 0);
  if (respiratoryRate !== null) {
    items.push({ id: "respiratoryRateBpm", value: `${respiratoryRate}/min` });
  }
  const weight = formatMeasurement(latestVitals?.weightKg, 3);
  if (weight !== null) {
    items.push({ id: "weightKg", value: `${weight} kg` });
  }

  if (visitType) textLines.unshift(`Typ termínu: ${visitType}`);
  if (doctor) textLines.push(`Lekár: ${doctor}`);
  if (location) textLines.push(`Lokácia: ${location}`);
  if (reason) textLines.push(`Poznámky / dôvod návštevy: ${reason}`);

  // Measurements are labelled in the request text: an unlabelled "38.6 °C"
  // forces the model to guess which parameter it belongs to.
  const measuredLabels: Record<string, string> = {
    temperatureC: "Teplota",
    heartRateBpm: "Tep",
    respiratoryRateBpm: "Dych",
    weightKg: "Hmotnosť",
  };
  const measured = items.filter((item) => item.id in measuredLabels);
  if (measured.length > 0) {
    textLines.push(
      `Dnešné merania: ${measured
        .map((item) => `${measuredLabels[item.id]} ${item.value}`)
        .join(", ")}`,
    );
  }

  if (textLines.length === 0) {
    return EMPTY_VISIT_CONTEXT;
  }

  return {
    items,
    // Stay under the server bound so long front-desk notes never reject the
    // whole draft request.
    text: textLines.join("\n").slice(0, VISIT_CONTEXT_MAX_LENGTH),
    hasContext: true,
  };
}
