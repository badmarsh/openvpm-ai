/** Format a YYYY-MM-DD date string for display as dd.mm.yyyy. */
export function formatDateYmdToDisplay(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}

/** Format a YYYY-MM-DDTHH:mm (datetime-local) string for display as dd.mm.yyyy HH:mm. */
export function formatDateTimeLocalToDisplay(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day, hours, minutes] = match;
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/** Parse dd.mm.yyyy back to YYYY-MM-DD if valid, else returns null. */
export function parseDisplayToDateYmd(display: string): string | null {
  const trimmed = display.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const match = /^(\d{1,2})[./\s-](\d{1,2})[./\s-](\d{4})$/.exec(trimmed);
  if (!match) return null;
  const [, day, month, year] = match;
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

