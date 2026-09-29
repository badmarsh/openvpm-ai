/**
 * Pure progress summary for a treatment plan's items. Skipped items are
 * excluded from the completion denominator (you don't get penalized for
 * interventions the clinician deliberately dropped).
 */

export type PlanItemStatus = "pending" | "in_progress" | "done" | "skipped";

export interface PlanProgress {
  total: number;
  done: number;
  skipped: number;
  /** Items still pending or in progress. */
  active: number;
  /** done / (total - skipped), 0-100, rounded. 0 when nothing is actionable. */
  percentComplete: number;
}

export function summarizePlanProgress(
  items: { status: PlanItemStatus }[]
): PlanProgress {
  const total = items.length;
  const done = items.filter((i) => i.status === "done").length;
  const skipped = items.filter((i) => i.status === "skipped").length;
  const active = total - done - skipped;
  const denom = total - skipped;
  const percentComplete = denom > 0 ? Math.round((done / denom) * 100) : 0;
  return { total, done, skipped, active, percentComplete };
}
