/**
 * Rules engine v1 for automation.
 *
 * Evaluates automation rules against events and schedules actions.
 *
 * Architecture:
 * - Loads active rules for practice from ext_automation_rules
 * - Evaluates JSON conditions (NOT SQL - tenant-isolation hazard)
 * - Schedules actions with appropriate delays
 * - Supports actions: create_journey, send_communication, create_task, create_content_brief
 *
 * See ARCHITECTURE-RESEARCH.md §C for full design.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import {
  extAutomationRules,
  extAutomationEvents,
  extAutomationJourneys,
  extAutomationEnrollments,
  type AutomationRuleCondition,
  type AutomationActionConfig,
} from "@openpims/db";
import type { AutomationEvent } from "./event-worker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RuleMatch {
  rule: typeof extAutomationRules.$inferSelect;
  score: number;
}

// ---------------------------------------------------------------------------
// Main rules evaluation function
// ---------------------------------------------------------------------------

/**
 * Evaluate all active rules against an event.
 *
 * @param db - Database connection
 * @param event - Event to evaluate
 * @returns Array of matched rules with scores
 */
export async function evaluateRules(
  db: Database,
  event: AutomationEvent
): Promise<RuleMatch[]> {
  // Load active rules for this practice and event type
  const rules = await db
    .select()
    .from(extAutomationRules)
    .where(
      and(
        eq(extAutomationRules.practiceId, event.practiceId),
        eq(extAutomationRules.triggerEvent, event.eventType as any),
        eq(extAutomationRules.enabled, true)
      )
    )
    .orderBy(extAutomationRules.priority);

  // Evaluate each rule's conditions
  const matches: RuleMatch[] = [];

  for (const rule of rules) {
    const condition = rule.conditionJson as AutomationRuleCondition | null;

    if (!condition) {
      // No conditions = rule always matches
      matches.push({ rule, score: 1 });
      continue;
    }

    // Evaluate condition against event payload and related entities
    const score = await evaluateCondition(db, event, condition);

    if (score > 0) {
      matches.push({ rule, score });
    }
  }

  return matches;
}

/**
 * Evaluate a single condition object against an event.
 *
 * Returns a score (0-1) indicating match strength.
 * 0 = no match, 1 = perfect match.
 */
async function evaluateCondition(
  db: Database,
  event: AutomationEvent,
  condition: AutomationRuleCondition
): Promise<number> {
  let score = 1.0;

  // Species filter
  if (condition.species && condition.species.length > 0) {
    if (event.patientId) {
      const [patient] = await db
        .select({ species: (db as any).patients.species })
        .from((db as any).patients)
        .where(eq((db as any).patients.id, event.patientId))
        .limit(1);

      if (!patient || !condition.species.includes(patient.species)) {
        return 0;
      }
    } else {
      return 0;
    }
  }

  // Age filter
  if (condition.minAgeYears !== undefined || condition.maxAgeYears !== undefined) {
    if (event.patientId) {
      const [patient] = await db
        .select({
          dateOfBirth: (db as any).patients.dateOfBirth,
        })
        .from((db as any).patients)
        .where(eq((db as any).patients.id, event.patientId))
        .limit(1);

      if (patient?.dateOfBirth) {
        const ageYears =
          (Date.now() - new Date(patient.dateOfBirth).getTime()) /
          (1000 * 60 * 60 * 24 * 365.25);

        if (
          condition.minAgeYears !== undefined &&
          ageYears < condition.minAgeYears
        ) {
          return 0;
        }

        if (
          condition.maxAgeYears !== undefined &&
          ageYears > condition.maxAgeYears
        ) {
          return 0;
        }
      } else {
        return 0;
      }
    } else {
      return 0;
    }
  }

  // Segment membership filter
  if (
    condition.segmentKeys &&
    condition.segmentKeys.length > 0 &&
    event.clientId
  ) {
    // TODO: Implement segment membership check
    // For now, allow if segmentKeys are specified but not enforced
  }

  // Exclude segment filter
  if (
    condition.excludeSegmentKeys &&
    condition.excludeSegmentKeys.length > 0 &&
    event.clientId
  ) {
    // TODO: Implement segment exclusion check
  }

  // Consent scope requirement
  if (condition.requireConsentScope) {
    // TODO: Implement consent scope verification
    // This would check ext_marketing_media_consents
  }

  return score;
}

/**
 * Execute action for a matched rule.
 */
export async function executeRuleAction(
  db: Database,
  event: AutomationEvent,
  rule: typeof extAutomationRules.$inferSelect,
  availableAt: Date
): Promise<void> {
  const action = rule.actionJson as AutomationActionConfig;

  switch (rule.actionType) {
    case "create_journey":
      await scheduleJourneyEnrollment(db, event, action, availableAt);
      break;

    case "send_communication":
      await scheduleCommunication(db, event, action, availableAt);
      break;

    case "create_task":
      await scheduleTask(db, event, action, availableAt);
      break;

    case "create_content_brief":
      await scheduleContentBrief(db, event, action, availableAt);
      break;

    default:
      console.warn(`[rules-engine] Unknown action type: ${rule.actionType}`);
  }
}

/**
 * Schedule journey enrollment for later execution.
 */
async function scheduleJourneyEnrollment(
  db: Database,
  event: AutomationEvent,
  action: AutomationActionConfig,
  availableAt: Date
): Promise<void> {
  if (!action.journeyKey || !event.clientId) {
    return;
  }

  // Find journey by key
  const [journey] = await db
    .select()
    .from(extAutomationJourneys)
    .where(
      and(
        eq(extAutomationJourneys.practiceId, event.practiceId),
        eq(extAutomationJourneys.journeyKey, action.journeyKey),
        eq(extAutomationJourneys.enabled, true)
      )
    )
    .limit(1);

  if (!journey) {
    console.warn(
      `[rules-engine] Journey not found: ${action.journeyKey}`
    );
    return;
  }

  // Create enrollment with dedupe key
  const dedupeKey = `journey_${journey.id}_client_${event.clientId}_event_${event.id}`;

  await db
    .insert(extAutomationEnrollments)
    .values({
      practiceId: event.practiceId,
      clientId: event.clientId,
      patientId: event.patientId,
      journeyId: journey.id,
      enrolledJourneyVersion: journey.version,
      triggeringEventId: event.id,
      status: "active",
      currentStepIndex: 0,
      currentStepAvailableAt: availableAt,
      dedupeKey,
    })
    .onConflictDoNothing({
      target: [
        (extAutomationEnrollments as any).practiceId,
        (extAutomationEnrollments as any).dedupeKey,
      ],
    });
}

/**
 * Schedule communication (SMS/email) for later sending.
 */
async function scheduleCommunication(
  db: Database,
  event: AutomationEvent,
  action: AutomationActionConfig,
  availableAt: Date
): Promise<void> {
  // This would integrate with ext_marketing_message_logs
  // For now, placeholder - actual implementation in TASK-6
  console.log(
    `[rules-engine] Scheduled communication for event ${event.id}`
  );
}

/**
 * Schedule staff task creation.
 */
async function scheduleTask(
  db: Database,
  event: AutomationEvent,
  action: AutomationActionConfig,
  availableAt: Date
): Promise<void> {
  // This would integrate with ext_marketing_staff_tasks
  // For now, placeholder
  console.log(
    `[rules-engine] Scheduled task for event ${event.id}`
  );
}

/**
 * Schedule content brief creation.
 */
async function scheduleContentBrief(
  db: Database,
  event: AutomationEvent,
  action: AutomationActionConfig,
  availableAt: Date
): Promise<void> {
  // This would integrate with ext_content_briefs
  // For now, placeholder
  console.log(
    `[rules-engine] Scheduled content brief for event ${event.id}`
  );
}
