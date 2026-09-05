/** Format a YYYY-MM-DD date string for display as dd.mm.yyyy. */
export function formatDateYmdToDisplay(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}
