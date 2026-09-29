import { NextResponse } from "next/server";
import { db } from "@openpims/db/client";
import { ekasaConfig } from "@openpims/db";
import { eq, and, isNull } from "drizzle-orm";
import { createDailyClosure } from "@/lib/ekasa/service";
import { withTenant } from "@/lib/tenant-db";
import { cronAuthError } from "@/lib/cron-auth";
import { reportCronHeartbeat } from "@/lib/cron-heartbeat";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authError = cronAuthError(req);
  if (authError) return authError;

  const startedAt = new Date();
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bratislava",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(startedAt);
  let processed = 0;
  let created = 0;

  try {
    const activeConfigs = await db.query.ekasaConfig.findMany({
      where: and(eq(ekasaConfig.isActive, true), isNull(ekasaConfig.deletedAt)),
    });

    for (const config of activeConfigs) {
      processed++;
      try {
        await withTenant(db, config.practiceId, (tx) =>
          createDailyClosure(tx, {
            practiceId: config.practiceId,
            dateStr,
          }),
        );
        created++;
      } catch {
        // Continue remaining practices; do not leak clinic identifiers in the HTTP body.
      }
    }

    await reportCronHeartbeat({
      job: "ekasa-daily-closure",
      status: created === processed ? "ok" : "degraded",
      detail: `${created}/${processed} daily closures created for ${dateStr}`,
      metrics: { processed, created },
    });
    return NextResponse.json({
      success: true,
      date: dateStr,
      processed,
      created,
      durationMs: Date.now() - startedAt.getTime(),
    });
  } catch (error) {
    await reportCronHeartbeat({
      job: "ekasa-daily-closure",
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
      metrics: { processed, created },
    });
    return NextResponse.json(
      {
        success: false,
        durationMs: Date.now() - startedAt.getTime(),
      },
      { status: 500 },
    );
  }
}
