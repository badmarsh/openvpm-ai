/**
 * Normalise a phone number to E.164 for consistent storage and comparison
 * (suppression matching, inbound STOP sync). Supports Slovak national (09xx, +421),
 * European 00-prefix, US/Canada, and standard international formats (+E.164).
 * Returns null for input we can't confidently normalise, so callers fail safe rather than guess.
 */
export function normalizeE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (hasPlus) {
    return /^[1-9][0-9]{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  // European international prefix 00 (e.g. 00421 905 123 456 -> +421905123456)
  if (digits.startsWith("00")) {
    const without00 = digits.slice(2);
    return /^[1-9][0-9]{7,14}$/.test(without00) ? `+${without00}` : null;
  }
  // Slovak national mobile/landline with leading 0 (e.g. 0905 123 456 -> +421905123456)
  if (digits.length === 10 && digits.startsWith("0")) {
    return `+421${digits.slice(1)}`;
  }
  // Slovak 9-digit mobile without leading 0 (e.g. 905 123 456 -> +421905123456)
  if (digits.length === 9 && digits.startsWith("9")) {
    return `+421${digits}`;
  }
  if (digits.length === 10) return `+1${digits}`; // US/CA national
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // Other lengths without a country code are ambiguous — reject.
  return null;
}
