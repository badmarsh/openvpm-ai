import { createHmac } from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@openpims/db/client";
import { webhooks } from "@openpims/db";
import { alertOps } from "@/lib/alerts";
import { withTenant } from "@/lib/tenant-db";

export async function dispatchWebhookEvent(
  practiceId: string,
  event: string,
  payload: Record<string, any>,
): Promise<void> {
  let activeWebhooks;
  try {
    // Tenant-scoped read (works under RLS regardless of the caller's context).
    activeWebhooks = await withTenant(db, practiceId, (tx) =>
      tx
        .select()
        .from(webhooks)
        .where(
          and(
            eq(webhooks.practiceId, practiceId),
            eq(webhooks.active, true),
            isNull(webhooks.deletedAt),
          ),
        ),
    );
  } catch (err) {
    console.error("[WebhookDispatcher] Failed to query webhooks:", err);
    return;
  }

  // Filter to webhooks that subscribe to this event
  const matching = activeWebhooks.filter((wh) => {
    const events = wh.events as string[];
    return Array.isArray(events) && (events.includes("*") || events.includes(event));
  });

  if (matching.length === 0) return;

  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const requests = matching.map(async (wh) => {
    try {
      const signature = createHmac("sha256", wh.secret)
        .update(body)
        .digest("hex");

      const res = await fetch(wh.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": event,
          "X-Webhook-Signature": signature,
        },
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (err) {
      console.error(
        `[WebhookDispatcher] Failed to deliver ${event} to ${wh.url}:`,
        err,
      );
      return false;
    }
  });

  // Fire all requests in parallel (don't block on responses). Alert ops once
  // per batch if any deliveries failed — a silently dead webhook means an
  // integration stops receiving events with no signal.
  Promise.allSettled(requests)
    .then((results) => {
      const failed = results.filter(
        (r) => r.status === "rejected" || r.value === false,
      ).length;
      if (failed > 0) {
        void alertOps(
          "Webhook delivery failed",
          `${failed} of ${matching.length} '${event}' webhook deliveries failed for practice ${practiceId}.`,
        );
      }
    })
    .catch(() => {
      // Intentionally swallowed - individual errors are logged above
    });
}
