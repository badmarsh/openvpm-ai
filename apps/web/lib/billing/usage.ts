import { and, eq, sql } from "drizzle-orm";
import { db } from "@openpims/db/client";
import { usageRecords } from "@openpims/db";
import { withSystem } from "@/lib/tenant-db";
import { alertOps } from "@/lib/alerts";
import { billingEnforced } from "./plans";

export type UsageKind = "sms" | "ai_run";

/**
 * Soft abuse thresholds for the generous-unmetered launch model. We do NOT cap
 * usage — SMS/AI keep working past the included allowance — but we alert ops
 * once when a practice crosses a high monthly threshold so abuse is visible.
 */
export const ABUSE_ALERT_THRESHOLDS: Record<UsageKind, number> = {
  sms: 2000,
  ai_run: 1000,
};

/** Pure: did `kind` cross its abuse threshold moving from `before` to `after`? */
export function crossesAbuseThreshold(
  kind: UsageKind,
  before: number,
  after: number
): boolean {
  const threshold = ABUSE_ALERT_THRESHOLDS[kind];
  if (!threshold) return false;
  return before < threshold && after >= threshold;
}

/** Current billing period as YYYY-MM (UTC). */
export function currentPeriodMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/**
 * Record a metered usage event. No-op on self-host (billing not enforced).
 * Fire-and-forget safe: never throws into the caller.
 */
export async function recordUsage(opts: {
  practiceId: string;
  kind: UsageKind;
  quantity?: number;
  now?: Date;
}): Promise<void> {
  if (!billingEnforced()) return; // self-host never meters
  const quantity = opts.quantity ?? 1;
  const periodMonth = currentPeriodMonth(opts.now);
  try {
    await withSystem(db, (tx) =>
      tx.insert(usageRecords).values({
        practiceId: opts.practiceId,
        kind: opts.kind,
        quantity,
        periodMonth,
      })
    );
    await maybeAlertOnSpike(opts.practiceId, opts.kind, periodMonth, quantity);
  } catch (e) {
    console.error("[usage] failed to record", opts.kind, e);
  }
}

/**
 * Fire a single ops alert when a practice's monthly usage crosses an abuse
 * threshold. Naturally fire-once: only the insert that pushes the running total
 * across the boundary satisfies `before < threshold <= after`. Never throws.
 */
async function maybeAlertOnSpike(
  practiceId: string,
  kind: UsageKind,
  periodMonth: string,
  quantity: number
): Promise<void> {
  if (!ABUSE_ALERT_THRESHOLDS[kind]) return;
  try {
    const after = await usageForPractice(practiceId, kind, periodMonth);
    const before = after - quantity;
    if (crossesAbuseThreshold(kind, before, after)) {
      await alertOps(
        `usage spike: ${kind}`,
        `Practice ${practiceId} crossed ${ABUSE_ALERT_THRESHOLDS[kind]} ${kind} events in ${periodMonth} (now ${after}). Launch is generous-unmetered — review for abuse.`
      );
    }
  } catch (e) {
    console.error("[usage] spike check failed", kind, e);
  }
}

/** Sum a practice's usage of one kind in a period (defaults to current month). */
export async function usageForPractice(
  practiceId: string,
  kind: UsageKind,
  periodMonth: string = currentPeriodMonth()
): Promise<number> {
  const [row] = await withSystem(db, (tx) =>
    tx
      .select({ total: sql<number>`coalesce(sum(${usageRecords.quantity}), 0)::int` })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.practiceId, practiceId),
          eq(usageRecords.kind, kind),
          eq(usageRecords.periodMonth, periodMonth)
        )
      )
  );
  return Number(row?.total ?? 0);
}
