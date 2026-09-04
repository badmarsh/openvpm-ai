import { NextResponse } from "next/server";
import { db } from "@openpims/db/client";
import { ekasaConfig } from "@openpims/db";
import { eq, and, isNull } from "drizzle-orm";
import { createDailyClosure } from "@/lib/ekasa/service";

// ---------------------------------------------------------------------------
// Automatická denná uzávierka (Z-report) — spúšťaná o 23:59
// Vercel Cron: { "path": "/api/cron/ekasa-daily-closure", "schedule": "59 23 * * *" }
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const dateStr = startedAt.toISOString().slice(0, 10);
  let processed = 0;
  let created = 0;
  const results: Array<{ practiceId: string; closureNumber?: string; error?: string }> = [];

  try {
    const activeConfigs = await db.query.ekasaConfig.findMany({
      where: and(
        eq(ekasaConfig.isActive, true),
        isNull(ekasaConfig.deletedAt)
      ),
    });

    for (const config of activeConfigs) {
      processed++;
      try {
        const closure = await createDailyClosure({
          practiceId: config.practiceId,
          dateStr,
        });
        created++;
        results.push({
          practiceId: config.practiceId,
          closureNumber: closure.closureNumber,
        });
      } catch (err) {
        results.push({
          practiceId: config.practiceId,
          error: err instanceof Error ? err.message : "Chyba pri uzávierke",
        });
      }
    }

    return NextResponse.json({
      success: true,
      date: dateStr,
      processed,
      created,
      durationMs: Date.now() - startedAt.getTime(),
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Neznáma chyba";
    return NextResponse.json(
      {
        success: false,
        error: message,
        durationMs: Date.now() - startedAt.getTime(),
      },
      { status: 500 }
    );
  }
}
