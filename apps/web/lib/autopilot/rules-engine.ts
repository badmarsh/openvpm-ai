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
 * Action sinks (all durable, all tenant-scoped):
 * - create_journey      -> ext_automation_enrollments
 * - send_communication  -> ext_marketing_message_logs (status "queued", drained by the
 *                          message-queue-drain cron) with consent-gate + suppression logging
 * - create_task         -> ext_marketing_staff_tasks
 * - create_content_brief -> ext_content_briefs (status "pending", vet review required)
 *
 * See ARCHITECTURE-RESEARCH.md §C for full design.
 */

import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import {
  clients,
  patients,
  practices,
  extAutomationRules,
  extAutomationJourneys,
  extAutomationEnrollments,
  extAutomationSuppressionLog,
  extContentBriefs,
  extContentPillars,
  extCrmSegments,
  extCrmSegmentMemberships,
  extMarketingMessageLogs,
  extMarketingMessageTemplates,
  extMarketingStaffTasks,
  type AutomationRuleCondition,
  type AutomationActionConfig,
} from "@openpims/db";
import type { AutomationEvent } from "./event-worker";
import { consentGateCheck } from "./consent-gate";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RuleMatch {
  rule: typeof extAutomationRules.$inferSelect;
  score: number;
}

type AutomationRuleRow = typeof extAutomationRules.$inferSelect;

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
        eq(extAutomationRules.triggerEventType, event.eventType as never),
        eq(extAutomationRules.isActive, true)
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
  // Species filter
  if (condition.species && condition.species.length > 0) {
    if (event.patientId) {
      const [patient] = await db
        .select({ species: patients.species })
        .from(patients)
        .where(eq(patients.id, event.patientId))
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
        .select({ dob: patients.dob })
        .from(patients)
        .where(eq(patients.id, event.patientId))
        .limit(1);

      if (patient?.dob) {
        const ageYears =
          (Date.now() - new Date(patient.dob).getTime()) /
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

  // Segment membership filter (ALL listed segments must match)
  if (condition.segmentKeys && condition.segmentKeys.length > 0) {
    if (!event.clientId) {
      return 0;
    }
    const member = await clientMatchesAllSegments(
      db,
      event.practiceId,
      event.clientId,
      condition.segmentKeys
    );
    if (!member) {
      return 0;
    }
  }

  // Exclude segment filter (ANY match excludes the client)
  if (condition.excludeSegmentKeys && condition.excludeSegmentKeys.length > 0) {
    if (!event.clientId) {
      return 0;
    }
    const excluded = await clientMatchesAnySegment(
      db,
      event.practiceId,
      event.clientId,
      condition.excludeSegmentKeys
    );
    if (excluded) {
      return 0;
    }
  }

  // Consent scope requirement
  if (condition.requireConsentScope) {
    // TODO: Implement consent scope verification
    // This would check ext_marketing_media_consents
  }

  return 1.0;
}

// ---------------------------------------------------------------------------
// Segment membership checks (CRM targeting for rules)
// ---------------------------------------------------------------------------

/**
 * Resolve live (non-deleted) segment ids for practice + keys.
 * Returns null when ANY key is unknown so callers fail closed.
 */
async function resolveSegmentIds(
  db: Database,
  practiceId: string,
  segmentKeys: string[]
): Promise<string[] | null> {
  const rows = await db
    .select({ id: extCrmSegments.id, segmentKey: extCrmSegments.segmentKey })
    .from(extCrmSegments)
    .where(
      and(
        eq(extCrmSegments.practiceId, practiceId),
        inArray(extCrmSegments.segmentKey, segmentKeys),
        isNull(extCrmSegments.deletedAt)
      )
    );

  if (rows.length !== new Set(segmentKeys).size) {
    return null;
  }
  return rows.map((r) => r.id);
}

/**
 * Live membership segment ids for a client (excludes soft-deleted rows,
 * manual exclusions, and expired memberships).
 */
async function liveMembershipSegmentIds(
  db: Database,
  practiceId: string,
  clientId: string,
  segmentIds: string[]
): Promise<Set<string>> {
  if (segmentIds.length === 0) return new Set();
  const now = new Date();
  const rows = await db
    .select({
      segmentId: extCrmSegmentMemberships.segmentId,
      isManuallyExcluded: extCrmSegmentMemberships.isManuallyExcluded,
      expiresAt: extCrmSegmentMemberships.expiresAt,
    })
    .from(extCrmSegmentMemberships)
    .where(
      and(
        eq(extCrmSegmentMemberships.practiceId, practiceId),
        eq(extCrmSegmentMemberships.clientId, clientId),
        inArray(extCrmSegmentMemberships.segmentId, segmentIds),
        isNull(extCrmSegmentMemberships.deletedAt)
      )
    );

  const live = new Set<string>();
  for (const row of rows) {
    if (row.isManuallyExcluded) continue;
    if (row.expiresAt && row.expiresAt <= now) continue;
    live.add(row.segmentId);
  }
  return live;
}

async function clientMatchesAllSegments(
  db: Database,
  practiceId: string,
  clientId: string,
  segmentKeys: string[]
): Promise<boolean> {
  const ids = await resolveSegmentIds(db, practiceId, segmentKeys);
  if (!ids) return false;
  const live = await liveMembershipSegmentIds(db, practiceId, clientId, ids);
  return ids.every((id) => live.has(id));
}

async function clientMatchesAnySegment(
  db: Database,
  practiceId: string,
  clientId: string,
  segmentKeys: string[]
): Promise<boolean> {
  const ids = await resolveSegmentIds(db, practiceId, segmentKeys);
  if (!ids) return false;
  const live = await liveMembershipSegmentIds(db, practiceId, clientId, ids);
  return ids.some((id) => live.has(id));
}

// ---------------------------------------------------------------------------
// Action execution
// ---------------------------------------------------------------------------

/**
 * Execute action for a matched rule.
 */
export async function executeRuleAction(
  db: Database,
  event: AutomationEvent,
  rule: AutomationRuleRow,
  availableAt: Date
): Promise<void> {
  const action = rule.actionConfig as AutomationActionConfig;

  switch (rule.actionType) {
    case "create_journey":
      await scheduleJourneyEnrollment(db, event, rule, action, availableAt);
      break;

    case "send_communication":
      await scheduleCommunication(db, event, rule, action, availableAt);
      break;

    case "create_task":
      await scheduleTask(db, event, rule, action, availableAt);
      break;

    case "create_content_brief":
      await scheduleContentBrief(db, event, rule, action, availableAt);
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
  rule: AutomationRuleRow,
  action: AutomationActionConfig,
  _availableAt: Date
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
        eq(extAutomationJourneys.isActive, true)
      )
    )
    .limit(1);

  if (!journey) {
    console.warn(
      `[rules-engine] Journey not found: ${action.journeyKey} (rule ${rule.ruleKey})`
    );
    return;
  }

  await db
    .insert(extAutomationEnrollments)
    .values({
      practiceId: event.practiceId,
      clientId: event.clientId,
      patientId: event.patientId,
      journeyId: journey.id,
      journeyVersion: journey.version,
      triggerEventId: event.id,
      status: "active",
      currentStepIndex: 0,
    })
    .onConflictDoNothing();
}

/**
 * Queue an SMS/email communication for sending.
 *
 * Writes to ext_marketing_message_logs with status "queued"; the
 * message-queue-drain cron picks it up for actual dispatch. The sympathy gate
 * and marketing consent gate run first — blocked sends are recorded in
 * ext_automation_suppression_log (GDPR Art. 22 audit trail).
 */
async function scheduleCommunication(
  db: Database,
  event: AutomationEvent,
  rule: AutomationRuleRow,
  action: AutomationActionConfig,
  availableAt: Date
): Promise<void> {
  if (!event.clientId) {
    return;
  }

  const channel = action.channel === "email" ? "email" : "sms";
  const commType = channel === "email" ? "marketing_email" : "marketing_sms";

  const gate = await consentGateCheck(
    db,
    event.practiceId,
    event.clientId,
    event.patientId ?? undefined,
    commType
  );

  if (!gate.allowed) {
    await db.insert(extAutomationSuppressionLog).values({
      practiceId: event.practiceId,
      clientId: event.clientId,
      patientId: event.patientId ?? null,
      suppressionReason: normalizeSuppressionReason(gate.suppressionType),
      blockedAction: `rule:${rule.ruleKey}`,
      channelAttempted: channel as "sms" | "email",
      ruleId: rule.id,
      eventId: event.id,
    });
    console.log(
      `[rules-engine] Suppressed communication for event ${event.id} (rule ${rule.ruleKey}): ${gate.reason}`
    );
    return;
  }

  // Resolve the message template (best-effort; falls back to params.body).
  const templateKey = action.templateKey ?? "custom";
  let templateId: string | null = null;
  let templateVersion = 1;
  let templateBody: string | null = null;
  let templateLegalBasis: string | null = null;
  if (action.templateKey) {
    const [tpl] = await db
      .select()
      .from(extMarketingMessageTemplates)
      .where(
        and(
          eq(extMarketingMessageTemplates.practiceId, event.practiceId),
          eq(extMarketingMessageTemplates.key, action.templateKey),
          eq(extMarketingMessageTemplates.isActive, true),
          isNull(extMarketingMessageTemplates.deletedAt)
        )
      )
      .limit(1);
    if (tpl) {
      templateId = tpl.id;
      templateVersion = tpl.version;
      templateBody = tpl.body;
      templateLegalBasis = tpl.legalBasis;
    }
  }

  const rawBody =
    templateBody ??
    asString(action.params?.body) ??
    `Správa pre klienta (pravidlo ${rule.name}).`;
  const bodyRendered = await renderMessageBody(db, event, rawBody);

  await db
    .insert(extMarketingMessageLogs)
    .values({
      practiceId: event.practiceId,
      clientId: event.clientId,
      patientId: event.patientId ?? null,
      templateId,
      templateKey,
      templateVersion,
      legalBasis: action.legalBasis ?? templateLegalBasis ?? "consent",
      channel,
      language: "sk",
      bodyRendered,
      triggerKey: `rule_${rule.ruleKey}`,
      status: "queued",
      idempotencyKey: `rule-${rule.id}-event-${event.id}`,
      scheduledFor: availableAt,
    })
    .onConflictDoNothing();
}

/**
 * Create a staff task (reception / vet follow-up).
 */
async function scheduleTask(
  db: Database,
  event: AutomationEvent,
  rule: AutomationRuleRow,
  action: AutomationActionConfig,
  availableAt: Date
): Promise<void> {
  const dueAt = new Date(availableAt.getTime());
  if (action.careReminderDueDays && action.careReminderDueDays > 0) {
    dueAt.setDate(dueAt.getDate() + action.careReminderDueDays);
  }

  await db.insert(extMarketingStaffTasks).values({
    practiceId: event.practiceId,
    clientId: event.clientId ?? null,
    kind: action.taskKind ?? "info",
    title:
      asString(action.params?.title) ??
      `${rule.name} — ${event.eventType}`,
    detail:
      asString(action.params?.detail) ??
      `Automatická úloha z pravidla "${rule.ruleKey}" (udalost ${event.eventType}, ${event.id}).`,
    status: "open",
    dueAt,
  });
}

/**
 * Create a content-calendar brief for the social approval queue.
 *
 * Briefs always start in "pending" so the SKILL.md §3 human-in-the-loop gate
 * (vet review via ClinicalDiffConfirmModal / veterinarian-review-modal) applies
 * before anything is published.
 */
async function scheduleContentBrief(
  db: Database,
  event: AutomationEvent,
  rule: AutomationRuleRow,
  action: AutomationActionConfig,
  _availableAt: Date
): Promise<void> {
  let pillarId: string | null = null;
  if (action.pillarKey) {
    const [pillar] = await db
      .select({ id: extContentPillars.id })
      .from(extContentPillars)
      .where(
        and(
          eq(extContentPillars.practiceId, event.practiceId),
          eq(extContentPillars.pillarKey, action.pillarKey),
          isNull(extContentPillars.deletedAt)
        )
      )
      .limit(1);
    pillarId = pillar?.id ?? null;
  }

  const targetChannels = Array.isArray(action.params?.targetChannels)
    ? (action.params.targetChannels as unknown[]).map(String).slice(0, 8)
    : ["instagram", "facebook"];

  await db.insert(extContentBriefs).values({
    practiceId: event.practiceId,
    pillarId,
    triggerEventId: event.id,
    briefText:
      asString(action.params?.briefText) ??
      `Automatický námet z pravidla "${rule.ruleKey}" (udalost ${event.eventType}).`,
    targetChannels,
    targetAudience:
      asString(action.params?.targetAudience) ?? "majitelia spoločenských zvierat",
    clinicalClaims: [],
    status: "pending",
    generatedBy: "autopilot_rules_engine",
    generatedAt: new Date(),
    source: { eventType: event.eventType, eventId: event.id },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUPPRESSION_REASONS = new Set([
  "deceased_patient",
  "opt_out",
  "no_consent",
  "frequency_cap",
  "quiet_hours",
  "recovery_hold",
  "manual_block",
  "cooldown",
  "sensitivity_period",
  "unknown_contact",
  "sms_rate_limit",
]);

function normalizeSuppressionReason(
  reason: string | undefined
): (typeof extAutomationSuppressionLog.$inferInsert)["suppressionReason"] {
  if (reason && SUPPRESSION_REASONS.has(reason)) {
    return reason as never;
  }
  return "unknown_contact" as never;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/**
 * Minimal {{variable}} renderer for rule-driven messages.
 * Supports event payload keys plus client / patient / clinic conveniences.
 */
async function renderMessageBody(
  db: Database,
  event: AutomationEvent,
  template: string
): Promise<string> {
  const vars: Record<string, string> = {};
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) continue;
    vars[key] =
      typeof value === "string" ? value : JSON.stringify(value);
  }

  try {
    const [client] = event.clientId
      ? await db
          .select({
            firstName: clients.firstName,
            lastName: clients.lastName,
          })
          .from(clients)
          .where(eq(clients.id, event.clientId))
          .limit(1)
      : [];
    if (client) {
      vars.client_name =
        `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim();
      vars.client_first_name = client.firstName ?? "";
    }

    const [patient] = event.patientId
      ? await db
          .select({ name: patients.name, species: patients.species })
          .from(patients)
          .where(eq(patients.id, event.patientId))
          .limit(1)
      : [];
    if (patient) {
      vars.pet_name = patient.name ?? "";
      vars.patient_name = patient.name ?? "";
      vars.species = patient.species ?? "";
    }

    const [practice] = await db
      .select({ name: practices.name, phone: practices.phone })
      .from(practices)
      .where(eq(practices.id, event.practiceId))
      .limit(1);
    if (practice) {
      vars.clinic_name = practice.name ?? "";
      vars.clinic_phone = practice.phone ?? "";
    }
  } catch {
    // Variable enrichment is best-effort; never block the queue write.
  }

  return template.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (match, key: string) => vars[key] ?? match
  );
}
