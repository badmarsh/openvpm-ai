/**
 * Postgres-backed event bus worker for automation processing.
 *
 * This worker polls the ext_automation_events table for pending events
 * and processes them through the rules engine and journey engine.
 *
 * Architecture:
 * - No pg LISTEN/NOTIFY (incompatible with serverless/pgBouncer)
 * - Polling every 60 seconds via Vercel cron
 * - Claim pattern: a single UPDATE ... WHERE status='pending' ... RETURNING *.
 *   The UPDATE re-checks `status='pending'` under the row lock and RETURNING
 *   hands back exactly the rows THIS invocation flipped, so two overlapping
 *   workers can never both receive the same event.
 * - Stuck claim recovery: events in 'processing' > 5 min → reset to 'pending'
 *
 * See EVENT-ENGINE-PLAN.md §C for full design.
 */

import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNull, lte, sql, gte, lt } from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import {
  extAutomationEvents,
  extAutomationEventStatusEnum,
} from "@openpims/db";
import { evaluateRules } from "./rules-engine";
import { advanceJourney } from "./journey-engine";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * How many events to process per worker run.
 * This limits the transaction size and execution time.
 */
const BATCH_SIZE = 10;

/**
 * Time after which a stuck claim is considered abandoned (in minutes).
 * Events in 'processing' status longer than this are reset to 'pending'.
 */
const STUCK_CLAIM_THRESHOLD_MINUTES = 5;

/**
 * Pod identifier for claim tracking.
 * In production, this would be the Vercel function ID or pod name.
 */
const POD_ID = process.env.VERCEL_FUNCTION_ID ?? `worker_${Date.now()}`;

/**
 * Per-invocation claim token.
 *
 * POD_ID alone is NOT unique per run: it is a module-level constant, so every
 * concurrent `pollAndProcess()` inside one warm instance (cron + tRPC-triggered
 * drain, or two overlapping cron fires) shares it. Claiming by POD_ID would
 * hand the same rows to both runs. Each invocation therefore gets its own
 * token, and the claim is proven by the UPDATE's RETURNING clause rather than
 * by re-selecting on the token.
 */
function createClaimToken(): string {
  return `${POD_ID}:${randomUUID()}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AutomationEvent = typeof extAutomationEvents.$inferSelect;

// ---------------------------------------------------------------------------
// Main worker function
// ---------------------------------------------------------------------------

/**
 * Poll and process pending automation events.
 *
 * This function:
 * 1. Recovers stuck claims (processing > 5 min)
 * 2. Claims up to BATCH_SIZE pending events
 * 3. Processes each event through rules engine
 * 4. Updates event status to 'processed' or 'failed'
 *
 * @param db - Database connection
 * @returns Number of events processed
 */
export async function pollAndProcess(db: Database): Promise<number> {
  const now = new Date();
  const stuckThreshold = new Date(
    now.getTime() - STUCK_CLAIM_THRESHOLD_MINUTES * 60 * 1000
  );

  // =========================================================================
  // Step 1: Recover stuck claims
  // =========================================================================
  await recoverStuckClaims(db, stuckThreshold);

  // =========================================================================
  // Step 2: Claim pending events
  // =========================================================================
  const events = await claimPendingEvents(db, now, BATCH_SIZE);

  if (events.length === 0) {
    return 0;
  }

  // =========================================================================
  // Step 3: Process each event
  // =========================================================================
  const processedCount = await processEventBatch(db, events, now);

  return processedCount;
}

// ---------------------------------------------------------------------------
// Step 1: Recover stuck claims
// ---------------------------------------------------------------------------

/**
 * Reset events that have been stuck in 'processing' status for too long.
 *
 * This handles worker crashes: if a worker claims an event but crashes
 * before completing, the event would be stuck forever without this recovery.
 */
async function recoverStuckClaims(
  db: Database,
  stuckThreshold: Date
): Promise<void> {
  const stuckEvents = await db
    .select({ id: extAutomationEvents.id })
    .from(extAutomationEvents)
    .where(
      and(
        eq(extAutomationEvents.status, "processing" as const),
        lt(extAutomationEvents.lockedAt, stuckThreshold)
      )
    );

  if (stuckEvents.length === 0) {
    return;
  }

  const eventIds = stuckEvents.map((e) => e.id);

  await db
    .update(extAutomationEvents)
    .set({
      status: "pending",
      lockedAt: null,
      lockedBy: null,
      retryCount: sql`${extAutomationEvents.retryCount} + 1`,
      processedReason: "Worker crash recovery - claim reset",
    })
    .where(inArray(extAutomationEvents.id, eventIds));

  console.log(
    `[automation-worker] Recovered ${stuckEvents.length} stuck events`
  );
}

// ---------------------------------------------------------------------------
// Step 2: Claim pending events
// ---------------------------------------------------------------------------

/**
 * Claim up to `limit` pending events that are available for processing.
 *
 * Exclusivity comes from the claiming UPDATE itself, not from a follow-up
 * SELECT: the `status = 'pending'` predicate is re-evaluated under the row
 * lock, and `RETURNING` yields precisely the rows this invocation flipped.
 * A competing worker that lost the race simply gets zero rows back.
 *
 * (The previous implementation re-selected on `lockedBy = POD_ID`; because
 * POD_ID is shared by every concurrent run in a warm instance, both runs
 * received the same events and processed them twice.)
 */
async function claimPendingEvents(
  db: Database,
  now: Date,
  limit: number
): Promise<AutomationEvent[]> {
  // Cheap pre-filter: narrows the UPDATE's id list so the claim stays small.
  const pendingEvents = await db
    .select({ id: extAutomationEvents.id })
    .from(extAutomationEvents)
    .where(
      and(
        eq(extAutomationEvents.status, "pending" as const),
        lte(extAutomationEvents.availableAt, now),
        isNull(extAutomationEvents.deletedAt)
      )
    )
    .orderBy(extAutomationEvents.availableAt)
    .limit(limit);

  if (pendingEvents.length === 0) {
    return [];
  }

  const eventIds = pendingEvents.map((e) => e.id);

  // Claim the events atomically and take back only what we actually claimed.
  const claimedEvents = await db
    .update(extAutomationEvents)
    .set({
      status: "processing" as const,
      lockedAt: now,
      lockedBy: createClaimToken(),
    })
    .where(
      and(
        inArray(extAutomationEvents.id, eventIds),
        eq(extAutomationEvents.status, "pending" as const)
      )
    )
    .returning();

  return claimedEvents;
}

// ---------------------------------------------------------------------------
// Step 3: Process event batch
// ---------------------------------------------------------------------------

/**
 * Process a batch of claimed events through rules and journey engines.
 */
async function processEventBatch(
  db: Database,
  events: AutomationEvent[],
  now: Date
): Promise<number> {
  let successCount = 0;

  for (const event of events) {
    try {
      await processSingleEvent(db, event, now);
      successCount++;
    } catch (error) {
      console.error(
        `[automation-worker] Failed to process event ${event.id}:`,
        error
      );

      // Mark event as failed
      await db
        .update(extAutomationEvents)
        .set({
          status: "failed",
          failedAt: now,
          failureReason: error instanceof Error ? error.message : "Unknown error",
          processedReason: error instanceof Error ? error.message : "Unknown error",
          lockedAt: null,
          lockedBy: null,
          retryCount: sql`${extAutomationEvents.retryCount} + 1`,
        })
        .where(eq(extAutomationEvents.id, event.id));
    }
  }

  return successCount;
}

/**
 * Process a single event through the automation pipeline.
 */
async function processSingleEvent(
  db: Database,
  event: AutomationEvent,
  now: Date
): Promise<void> {
  console.log(
    `[automation-worker] Processing event ${event.id} (${event.eventType})`
  );

  // Step 1: Evaluate rules for this event
  const ruleMatches = await evaluateRules(db, event);

  // Step 2: Execute matched rules
  for (const match of ruleMatches) {
    try {
      await executeRuleAction(db, event, match, now);
    } catch (error) {
      console.error(
        `[automation-worker] Rule action failed for event ${event.id}:`,
        error
      );
      // Continue with other rules even if one fails
    }
  }

  // Step 3: Advance any enrolled journeys
  if (event.clientId) {
    await advanceJourney(db, event.clientId, event.practiceId);
  }

  // Step 4: Mark event as processed
  await db
    .update(extAutomationEvents)
    .set({
      status: "processed",
      processedAt: now,
      lockedAt: null,
      lockedBy: null,
    })
    .where(eq(extAutomationEvents.id, event.id));
}

/**
 * Execute a single rule action.
 */
async function executeRuleAction(
  db: Database,
  event: AutomationEvent,
  match: any, // RuleMatch type from rules-engine
  now: Date
): Promise<void> {
  const { actionType, actionJson } = match.rule;

  switch (actionType) {
    case "create_journey":
      // Journey enrollment handled by journey engine
      break;

    case "send_communication":
      // Communication sending handled by messaging.ts
      break;

    case "create_task":
      // Task creation handled by marketing router
      break;

    case "create_content_brief":
      // Content brief creation handled by content calendar
      break;

    default:
      console.warn(
        `[automation-worker] Unknown action type: ${actionType}`
      );
  }
}
