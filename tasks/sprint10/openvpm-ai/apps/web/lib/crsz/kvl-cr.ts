/**
 * KVL ČR (Komora veterinárních lékařů České republiky) passport helpers.
 * Pure validation/normalization kept separate from the router for testability.
 */

export interface KvlCrPassportValidation {
  valid: boolean;
  normalized?: string;
  error?: string;
}

// České čísla pasov majú prefix "CZ" a číselnú časť (napr. "CZ 0123456").
const KVL_CR_PASSPORT_RE = /^CZ[\s-]?(\d{6,12})$/i;

export function validateKvlCrPassportNumber(
  raw: string
): KvlCrPassportValidation {
  const trimmed = raw.trim();
  const match = KVL_CR_PASSPORT_RE.exec(trimmed);
  if (!match) {
    return {
      valid: false,
      error:
        "Invalid KVL ČR passport number. Expected format 'CZ 0123456'.",
    };
  }
  return { valid: true, normalized: `CZ ${match[1]}` };
}
