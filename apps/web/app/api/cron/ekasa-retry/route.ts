import { NextResponse } from "next/server";
import { db } from "@openpims/db/client";
import { ekasaReceipts, ekasaConfig } from "@openpims/db";
import { eq, and, isNull, or } from "drizzle-orm";
import { sendToEkasaApi } from "@/lib/ekasa/service";

// ---------------------------------------------------------------------------
// Cron Handler — spúšťaný periodicky pre odoslanie neodoslaných dokladov
// Konfigurácia: vercel.json -> { "crons": [{ "path": "/api/cron/ekasa-retry", "schedule": "0 * * * *" }] }
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  let processed = 0;
  let confirmed = 0;
  let stillFailed = 0;

  try {
    const pendingReceipts = await db.query.ekasaReceipts.findMany({
      where: and(
        isNull(ekasaReceipts.deletedAt),
        or(
          eq(ekasaReceipts.status, "FAILED"),
          eq(ekasaReceipts.status, "OFFLINE_STORED")
        )
      ),
      limit: 50,
      orderBy: ekasaReceipts.issuedAt,
    });

    if (pendingReceipts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Žiadne doklady na opätovné odoslanie",
        processed: 0,
        durationMs: Date.now() - startedAt.getTime(),
      });
    }

    const practiceIds = [...new Set(pendingReceipts.map((r) => r.practiceId as string))];
    const configs = await Promise.all(
      practiceIds.map((practiceId) =>
        db.query.ekasaConfig.findFirst({
          where: and(
            eq(ekasaConfig.practiceId, practiceId),
            isNull(ekasaConfig.deletedAt)
          ),
        })
      )
    );

    const configMap = new Map(
      configs
        .filter(Boolean)
        .map((c) => [c!.practiceId as string, c!])
    );

    for (const receipt of pendingReceipts) {
      const config = configMap.get(receipt.practiceId as string);
      if (!config) {
        console.warn(`[ekasa-retry] Chýba konfigurácia pre kliniku ${receipt.practiceId as string}`);
        continue;
      }

      processed++;
      const newRetryCount = (Number(receipt.retryCount ?? 0) + 1).toString();

      try {
        const apiResult = await sendToEkasaApi({
          apiUrl: config.ekasaApiUrl as string,
          receiptNumber: receipt.receiptNumber as string,
          dic: config.dic as string,
          pokladnicaId: config.pokladnicaId as string,
          amountTotal: receipt.amountTotal as string,
          amountVat: receipt.amountVat as string,
          paymentMethod: receipt.paymentMethod as string,
          okp: receipt.okp as string,
          pkp: receipt.pkp as string,
          issuedAt: receipt.issuedAt,
          items: [],
        });

        const newStatus = apiResult.success ? "CONFIRMED" : "FAILED";
        if (apiResult.success) confirmed++;
        else stillFailed++;

        await db
          .update(ekasaReceipts)
          .set({
            status: newStatus,
            uid: apiResult.uid ?? null,
            rawResponse: apiResult.rawResponse ?? null,
            retryCount: newRetryCount,
            lastRetryAt: new Date(),
          })
          .where(eq(ekasaReceipts.id, receipt.id));
      } catch (err) {
        stillFailed++;
        console.error(`[ekasa-retry] Chyba pri spracovaní dokladu ${receipt.receiptNumber as string}:`, err);
        await db
          .update(ekasaReceipts)
          .set({ retryCount: newRetryCount, lastRetryAt: new Date() })
          .where(eq(ekasaReceipts.id, receipt.id));
      }

      // Throttle — 500ms medzi volaniami FR SR API
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return NextResponse.json({
      success: true,
      message: `Retry dokončený: ${confirmed} potvrdených, ${stillFailed} stále chybných`,
      processed,
      confirmed,
      stillFailed,
      durationMs: Date.now() - startedAt.getTime(),
    });
  } catch (error) {
    console.error("[ekasa-retry] Kritická chyba cron jobu:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Neznáma chyba",
        processed,
        durationMs: Date.now() - startedAt.getTime(),
      },
      { status: 500 }
    );
  }
}
