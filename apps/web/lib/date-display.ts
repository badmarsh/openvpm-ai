/** Format a Date or date string for display as dd.mm.yyyy. */
export function formatDateToDisplay(value: Date | string | null | undefined): string {
  if (!value) return "—";
  if (typeof value === "string") {
    const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (ymdMatch) {
      const [, year, month, day] = ymdMatch;
      return `${day}.${month}.${year}`;
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/** Format a Date or date string for display as dd.mm.yyyy HH:mm. */
export function formatDateTimeToDisplay(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

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

/** Format a Date or date-time string as HH:mm using the app locale ("sk" | "en"). */
export function formatTimeToDisplay(
  value: Date | string | number | null | undefined,
  locale: string = "sk",
): string {
  if (value === null || value === undefined || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const bcp47 = locale.toLowerCase().startsWith("sk") ? "sk-SK" : "en-US";
  return d.toLocaleTimeString(bcp47, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
