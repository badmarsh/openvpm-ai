/**
 * Pure recurring-billing date math for wellness plans. Works on "YYYY-MM-DD"
 * strings to stay timezone-independent. Month/year rollover clamps to the last
 * valid day of the target month (Jan 31 + 1 month -> Feb 28/29).
 */

export type BillingInterval = "monthly" | "annual";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function daysInMonth(year: number, month1to12: number): number {
  // Day 0 of the next month is the last day of this month.
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function computeNextBillingDate(
  currentDate: string,
  interval: BillingInterval
): string {
  if (!DATE_RE.test(currentDate)) {
    throw new Error("currentDate must be YYYY-MM-DD.");
  }
  const [y, m, d] = currentDate.split("-").map(Number) as [number, number, number];

  if (interval === "annual") {
    const ny = y + 1;
    return fmt(ny, m, Math.min(d, daysInMonth(ny, m)));
  }

  // monthly
  let ny = y;
  let nm = m + 1;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  return fmt(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export interface DueEnrollment {
  id: string;
  status: "active" | "cancelled";
  nextBillingDate: string | null;
}

/**
 * IDs of active enrollments due for billing on or before `asOf` (YYYY-MM-DD).
 * ISO date strings compare correctly lexicographically.
 */
export function enrollmentsDueOn(
  enrollments: DueEnrollment[],
  asOf: string
): string[] {
  return enrollments
    .filter(
      (e) =>
        e.status === "active" &&
        e.nextBillingDate !== null &&
        e.nextBillingDate <= asOf
    )
    .map((e) => e.id);
}
