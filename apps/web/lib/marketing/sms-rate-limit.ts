import { and, count, eq, gte } from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import { extSmsDeliveryLog } from "@openpims/db";

export async function smsRateLimitOk(
  db: Database | any,
  practiceId: string,
  clientId: string,
  windowDays: number = 7
): Promise<boolean> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ count: count() })
    .from(extSmsDeliveryLog)
    .where(
      and(
        eq(extSmsDeliveryLog.practiceId, practiceId),
        eq(extSmsDeliveryLog.clientId, clientId),
        gte(extSmsDeliveryLog.sentAt, since),
      )
    );
  return (row?.count ?? 0) === 0;
}
