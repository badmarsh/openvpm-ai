import { and, eq, sql } from "drizzle-orm";
import { db } from "@openpims/db/client";
import { usageRecords } from "@openpims/db";
import { withSystem } from "@/lib/tenant-db";
import { billingEnforced } from "./plans";

export type UsageKind = "sms" | "ai_run";

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
  try {
    await withSystem(db, (tx) =>
      tx.insert(usageRecords).values({
        practiceId: opts.practiceId,
        kind: opts.kind,
        quantity: opts.quantity ?? 1,
        periodMonth: currentPeriodMonth(opts.now),
      })
    );
  } catch (e) {
    console.error("[usage] failed to record", opts.kind, e);
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
