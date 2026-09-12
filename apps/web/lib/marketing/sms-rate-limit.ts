import { and, count, eq, gte } from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import { extSmsDeliveryLog } from "@openpims/db";

/**
 * Maximum number of marketing SMS allowed per client per rate-limit window.
 * Previously this was effectively 1 (zero-tolerance), which caused multi-step
 * journeys to self-block after the first message. Set to 3 to allow typical
 * 2-step (thank_you + review_request) journeys with headroom.
 */
export const MAX_MARKETING_SMS_PER_WINDOW = 3;

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
  return (row?.count ?? 0) < MAX_MARKETING_SMS_PER_WINDOW;
}
