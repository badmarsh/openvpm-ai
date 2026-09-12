/**
 * Dental chart helpers. Pure tooth-code validation/normalization kept separate
 * from the router and UI for testability.
 *
 * FDI notácia: dospelé zuby 11–48 (kvadrant 1–4 + zub 1–8), mliečne 51–85.
 * Niektoré systémy používajú trojmiestny zápis (napr. "104") alebo písmenový
 * sufix (napr. "104M"). Akceptujeme 1–4 číslice s voliteľným písmenom.
 */

export function normalizeToothCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidToothCode(raw: string): boolean {
  const normalized = normalizeToothCode(raw);
  if (!normalized) return false;
  return /^[A-Z]?\d{1,4}[A-Z]?$/.test(normalized);
}
