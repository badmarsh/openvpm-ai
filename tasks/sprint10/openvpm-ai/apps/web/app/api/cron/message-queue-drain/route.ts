/**
 * Message queue drain cron.
 *
 * Runs every 5 minutes (see vercel.json). Drains due rows from
 * ext_marketing_message_logs (status "queued", scheduled_for <= now) for every
 * active practice via lib/marketing/messaging.processQueue — the same routine
 * the manual "process queued messages" button uses, including quiet hours,
 * the sympathy gate, consent checks, and SMS rate limiting.
 *
 * Without this job, journey "send" steps and rule-driven communications would
 * pile up in "queued" forever.
 */
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@openpims/db/client";
import { practices } from "@openpims/db";
import { alertOps } from "@/lib/alerts";
import { cronAuthError } from "@/lib/cron-auth";
import { reportCronHeartbeat } from "@/lib/cron-heartbeat";
import { withSystem, withTenant } from "@/lib/tenant-db";
import { processQueue } from "@/lib/marketing/messaging";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authError = cronAuthError(request);
  if (authError) return authError;

  let sent = 0;
  let suppressed = 0;
  let failed = 0;

  try {
    const allPractices = await withSystem(db, (tx) =>
      tx
        .select({ id: practices.id })
        .from(practices)
        .where(
          and(
            isNull(practices.deletedAt),
            eq(practices.recoveryHold, false)
          )
        )
    );

    for (const practice of allPractices) {
      try {
        const result = await withTenant(db, practice.id, (tx) =>
          processQueue(tx as never, practice.id)
        );
        sent += result.sent;
        suppressed += result.suppressed;
      } catch (error) {
        failed++;
        void alertOps(
          "Message queue drain failed",
          `practice=${practice.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    await reportCronHeartbeat({
      job: "message-queue-drain",
      status: failed > 0 ? "degraded" : "ok",
      detail: `${sent} sent, ${suppressed} suppressed, ${failed} practices failed`,
      metrics: {
        practices: allPractices.length,
        sent,
        suppressed,
        failed,
      },
    });

    return NextResponse.json({
      practices: allPractices.length,
      sent,
      suppressed,
      failed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void alertOps("Message queue drain cron failed", message);
    await reportCronHeartbeat({
      job: "message-queue-drain",
      status: "failed",
      detail: message,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
