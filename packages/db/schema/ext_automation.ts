import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { clients } from "./clients";
import { patients } from "./patients";
import { users } from "./users";
import { appointments } from "./scheduling";
import { visitCloseouts } from "./visit-closeouts";
import { careReminders } from "./care-reminders";
import { communications } from "./communications";
import {
  extMarketingChannelEnum,
  extMarketingContentItems,
  extMarketingMessageLogs,
  extMarketingStaffTasks,
} from "./ext_marketing";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Durable event vocabulary for the autopilot event bus.
 *
 * Tier 1 values are trigger keys ALREADY emitted by the current codebase
 * (apps/web/lib/marketing/messaging.ts TRIGGERS map, routers/appointments.ts,
 * routers/extensions/marketing.ts, seed-marketing*.ts). They are included so
 * historical ext_marketing_message_logs.trigger_key values can be backfilled
 * into ext_automation_events without a cast failure.
 *
 * Tier 2 values are required by the autopilot vision and emitted nowhere today.
 *
 * pgEnum values are ADDITIVE ONLY: Postgres supports
 * `ALTER TYPE ... ADD VALUE` but never DROP/RENAME VALUE. Never reorder or
 * remove a value here. High-cardinality or experimental variants belong in
 * `ext_automation_events.event_subtype`, not in this enum.
 */
export const extAutomationEventTypeEnum = pgEnum("ext_automation_event_type", [
  // ── Tier 1: already emitted in-repo ──────────────────────────────────────
  "appointment_booked",
  "appointment_reminder",
  "appointment_no_show",
  "appointment_completed",
  "visit_completed",
  "visit_closeout",
  "vaccine_due",
  "inactive_recall",
  "annual_checkup_due",
  "senior_milestone",
  "senior_screening",
  "surgery_completed",
  "wellness_enrolled",
  "dental_detected",
  "payment_failed",
  "patient_deceased",
  // ── Tier 2: required by the autopilot vision, not emitted today ──────────
  "lab_result_received",
  "treatment_plan_created",
  "prescription_issued",
  "review_received",
  "review_reply_published",
  "content_brief_approved",
  "content_published",
  "consent_revoked",
  "client_created",
  "patient_created",
  "patient_reactivated",
  "inventory_delivery_received",
]);

/**
 * Processing state of an event row.
 *
 * Field names and value set are aligned with Agent 3's worker contract
 * (EVENT-ENGINE-PLAN.md §C3 Phase 2) so the polling worker can query
 * `status = 'pending'` directly. `skipped` means "we looked at this event and
 * deliberately chose not to act"; the reason goes in processed_reason.
 */
export const extAutomationEventStatusEnum = pgEnum("ext_automation_event_status", [
  "pending",
  "processing",
  "processed",
  "failed",
  "skipped",
]);

export const extAutomationRuleActionEnum = pgEnum("ext_automation_rule_action", [
  "create_journey",
  "send_communication",
  "create_task",
  "create_content_brief",
]);

export const extAutomationEnrollmentStatusEnum = pgEnum(
  "ext_automation_enrollment_status",
  ["active", "completed", "exited", "paused", "failed"],
);

export const extAutomationStepStatusEnum = pgEnum("ext_automation_step_status", [
  "scheduled",
  "executing",
  "done",
  "skipped",
  "failed",
]);

/**
 * Why an automated action was withheld. Every row in
 * ext_automation_suppression_log is a defensible answer to "why did this
 * client not receive anything?" during a GDPR / TCPA enquiry.
 *
 * `deceased_patient` implements the SKILL.md Sympathy Gate and MUST be checked
 * unconditionally before any other reason.
 *
 * `no_consent` and `unknown_contact` are additions beyond the brief: the
 * existing engine already distinguishes "never opted in"
 * (ext_marketing_message_status 'suppressed_no_consent') from "opted out", and
 * conflating them would misreport the legal basis audit.
 */
export const extAutomationSuppressionReasonEnum = pgEnum(
  "ext_automation_suppression_reason",
  [
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
  ],
);

// ---------------------------------------------------------------------------
// JSON payload shapes
// ---------------------------------------------------------------------------

export type AutomationRuleCondition = {
  species?: string[];
  visitTypes?: string[];
  segmentKeys?: string[];
  excludeSegmentKeys?: string[];
  minAgeYears?: number;
  maxAgeYears?: number;
  requireConsentScope?: string;
};

export type AutomationActionConfig = {
  journeyKey?: string;
  templateKey?: string;
  channel?: string;
  legalBasis?: string;
  pillarKey?: string;
  taskKind?: string;
  careReminderDueDays?: number;
  params?: Record<string, unknown>;
};

export type AutomationJourneyStep = {
  /** Zero-based position; must match ext_automation_step_executions.step_index. */
  index: number;
  kind: "wait" | "send" | "task" | "content_brief" | "condition" | "exit";
  label: string;
  /** Hours from enrollment (or from the previous step when relative=true). */
  delayHours: number;
  relative?: boolean;
  channel?: string;
  templateKey?: string;
  legalBasis?: string;
  taskKind?: string;
  pillarKey?: string;
  /** Branch key evaluated against the enrollment's event payload. */
  whenJson?: Record<string, unknown>;
  /** Suppression reasons that end the journey rather than skipping one step. */
  exitOnSuppression?: string[];
};

export type AutomationEventPayload = Record<string, unknown>;

// ---------------------------------------------------------------------------
// 2A. ext_automation_events — durable, append-only event log / bus
// ---------------------------------------------------------------------------

/**
 * The single durable record of "something happened in the clinic".
 *
 * Append-only: `deletedAt` is inherited from baseColumns() but MUST never be
 * set by application code (same contract as ext_ai_audit_log). Rows are
 * claimed by a worker with SELECT ... FOR UPDATE SKIP LOCKED, so `lockedAt`
 * and `lockedBy` exist to make stuck claims recoverable.
 */
export const extAutomationEvents = pgTable(
  "ext_automation_events",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    eventType: extAutomationEventTypeEnum("event_type").notNull(),
    /** Free-text qualifier so the enum never churns on new variants. */
    eventSubtype: text("event_subtype"),
    /** When the thing happened in the clinic, not when the row was inserted. */
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    clientId: uuid("client_id"),
    patientId: uuid("patient_id"),
    appointmentId: uuid("appointment_id"),
    /**
     * There is no `visits` table in this schema. The canonical "visit closed"
     * record is visit_closeouts (one row per appointment, status 'completed').
     */
    visitCloseoutId: uuid("visit_closeout_id").references(
      () => visitCloseouts.id,
    ),
    payload: jsonb("payload").$type<AutomationEventPayload>().notNull().default({}),
    /** Router/procedure that emitted the event, e.g. "appointments.setStatus". */
    sourceRouter: text("source_router"),
    /**
     * Emitter-supplied idempotency key. Replaces the ad-hoc composite strings
     * currently passed as `eventId` to createMessagesForTrigger
     * (e.g. `dental_${patientId}_${Date.now()}`, messaging.ts:L665), which are
     * not stable across retries.
     */
    dedupeKey: text("dedupe_key"),
    /** Null for system emissions (cron, webhook, sync). */
    emittedBy: uuid("emitted_by").references(() => users.id),
    status: extAutomationEventStatusEnum("status").notNull().default("pending"),
    /**
     * WHY the processor chose not to act, when status is 'skipped' or 'failed'.
     * This is what makes the pipeline auditable rather than a black box: it
     * answers "what happened in the clinic today" even when the answer is
     * "nothing, because the sympathy gate fired".
     */
    processedReason: text("processed_reason"),
    /** Not before this time. Used for both initial delay and retry backoff. */
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Set by the worker that claimed this event. */
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    /**
     * When no worker has touched this event yet, or when the worker crashed
     * mid-processing and left the claim stuck. Workers reset these to
     * 'pending' and clear locked* fields before re-processing.
     */
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").notNull().default(0),
  },
  (t) => ({
    practiceStatusIdx: index("ext_auto_events_practice_status_idx").on(
      t.practiceId,
      t.status,
      t.availableAt,
    ),
    /** Idempotency index: one row per emitter-supplied dedupe key. */
    dedupeUq: uniqueIndex("ext_auto_events_dedupe_uq").on(
      t.practiceId,
      t.dedupeKey,
    ),
    sourceIdx: index("ext_auto_events_source_idx").on(
      t.sourceRouter,
      t.occurredAt,
    ),
    clientIdx: index("ext_auto_events_client_idx").on(
      t.practiceId,
      t.clientId,
      t.occurredAt,
    ),
    /**
     * Claim-recovery index: workers find stuck 'processing' rows by
     * (status, lockedAt) without scanning the whole table.
     */
    claimRecoveryIdx: index("ext_auto_events_claim_recovery_idx").on(
      t.status,
      t.lockedAt,
    ),
    /** FK indexes for tenant-isolated joins. */
    appointmentFkIdx: index("ext_auto_events_appointment_idx").on(
      t.practiceId,
      t.appointmentId,
    ),
    visitCloseoutFkIdx: index("ext_auto_events_visit_closeout_idx").on(
      t.practiceId,
      t.visitCloseoutId,
    ),
    /** CHECK: deletedAt must remain null (append-only ledger). */
    appendOnlyCheck: check(
      "ext_auto_events_append_only",
      sql`${t.deletedAt} IS NULL`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 2B. ext_automation_rules — rules engine table
// ---------------------------------------------------------------------------

/**
 * Declarative automation rules: "WHEN event X happens, IF condition Y holds,
 * THEN perform action Z".
 *
 * This table coexists with ext_marketing_automation_rules (the legacy flat
 * on/off toggle list). The `ruleKey` column mirrors the legacy `key` column,
 * and `migratedFromKey` preserves provenance when rules are migrated.
 *
 * conditionJson is the source of truth (jsonb, whitelist-compiled);
 * conditionSql is retained as an inert, human-readable rendering that the
 * engine never executes (tenant-isolation hazard).
 */
export const extAutomationRules = pgTable(
  "ext_automation_rules",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    /** Human-readable label shown in UI. */
    name: text("name").notNull(),
    /** Optional description for clinic staff. */
    description: text("description"),
    /**
     * Event type that triggers this rule. Must match a value in
     * ext_automation_event_type enum.
     */
    triggerEvent: extAutomationEventTypeEnum("trigger_event").notNull(),
    /**
     * JSON condition object: { species?, visitTypes?, segmentKeys?,
     * excludeSegmentKeys?, minAgeYears?, maxAgeYears?, requireConsentScope? }
     * This is the source of truth; conditionSql is derived documentation.
     */
    conditionJson: jsonb("condition_json").$type<AutomationRuleCondition>(),
    /**
     * Human-readable SQL-like rendering of conditionJson for documentation.
     * NEVER executed by the engine (tenant-isolation hazard).
     */
    conditionSql: text("condition_sql"),
    /** Action type: create_journey | send_communication | create_task | create_content_brief */
    actionType: extAutomationRuleActionEnum("action_type").notNull(),
    /** Action configuration JSON (see AutomationActionConfig type). */
    actionJson: jsonb("action_json").$type<AutomationActionConfig>().notNull(),
    /** Rule priority within practice (lower = higher priority). */
    priority: integer("priority").notNull().default(100),
    /** Whether this rule is currently active. */
    enabled: boolean("enabled").notNull().default(true),
    /**
     * Mirrors ext_marketing_automation_rules.key for migration bridge.
     * Unique per practice.
     */
    ruleKey: text("rule_key"),
    /**
     * If this rule was migrated from ext_marketing_automation_rules,
     * stores the original key for provenance.
     */
    migratedFromKey: text("migrated_from_key"),
  },
  (t) => ({
    practiceEnabledIdx: index("ext_auto_rules_practice_enabled_idx").on(
      t.practiceId,
      t.enabled,
      t.triggerEvent,
    ),
    /** Unique rule key per practice (migration bridge). */
    practiceKeyUq: uniqueIndex("ext_auto_rules_practice_key_uq").on(
      t.practiceId,
      t.ruleKey,
    ),
    /** Append-only check (deletedAt must remain null). */
    appendOnlyCheck: check(
      "ext_auto_rules_append_only",
      sql`${t.deletedAt} IS NULL`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 2C. ext_automation_journeys — journey definitions
// ---------------------------------------------------------------------------

/**
 * Multi-step client journeys (e.g. "vaccination recall", "post-op follow-up").
 *
 * Each journey has a versioned list of steps (AutomationJourneyStep[]).
 * When a journey is updated, existing enrollments continue on their enrolled
 * version; new enrollments use the latest version.
 */
export const extAutomationJourneys = pgTable(
  "ext_automation_journeys",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    /** Machine-readable key, e.g. "vaccination_recall", "postop_followup". */
    journeyKey: text("journey_key").notNull(),
    /** Human-readable name shown in UI. */
    name: text("name").notNull(),
    description: text("description"),
    /**
     * Ordered array of journey steps. Each step has:
     * { index, kind, label, delayHours, relative?, channel?, templateKey?, ... }
     */
    steps: jsonb("steps")
      .$type<AutomationJourneyStep[]>()
      .notNull(),
    /**
     * Journey version number. Increments on every steps[] change.
     * Existing enrollments pin to their enrolledVersion; new enrollments use max(version).
     */
    version: integer("version").notNull().default(1),
    /** Whether this journey is currently active (can accept new enrollments). */
    enabled: boolean("enabled").notNull().default(true),
    /**
     * Optional: maximum number of times a single client can be enrolled
     * in this journey within a rolling window (frequency cap).
     */
    maxEnrollmentsPerClient: integer("max_enrollments_per_client"),
    /**
     * Optional: rolling window in days for the enrollment cap.
     * If null, cap is lifetime.
     */
    enrollmentCapWindowDays: integer("enrollment_cap_window_days"),
  },
  (t) => ({
    practiceKeyIdx: index("ext_auto_journeys_practice_key_idx").on(
      t.practiceId,
      t.journeyKey,
    ),
    /** Unique journey key per practice. */
    practiceKeyUq: uniqueIndex("ext_auto_journeys_practice_key_uq").on(
      t.practiceId,
      t.journeyKey,
    ),
    practiceEnabledIdx: index("ext_auto_journeys_practice_enabled_idx").on(
      t.practiceId,
      t.enabled,
    ),
    appendOnlyCheck: check(
      "ext_auto_journeys_append_only",
      sql`${t.deletedAt} IS NULL`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 2D. ext_automation_enrollments — per-client journey enrollments
// ---------------------------------------------------------------------------

/**
 * Tracks a client's enrollment in a specific journey version.
 *
 * Each enrollment has a status (active | paused | completed | exited | failed)
 * and points to the current step being executed.
 */
export const extAutomationEnrollments = pgTable(
  "ext_automation_enrollments",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    patientId: uuid("patient_id").references(() => patients.id),
    /** Journey this enrollment belongs to. */
    journeyId: uuid("journey_id")
      .notNull()
      .references(() => extAutomationJourneys.id),
    /**
     * Journey version at enrollment time. This pins the enrollment to the
     * steps[] snapshot that was current when the client enrolled.
     */
    enrolledJourneyVersion: integer("enrolled_journey_version").notNull(),
    /** Event that triggered this enrollment. */
    triggeringEventId: uuid("triggering_event_id").references(
      () => extAutomationEvents.id,
    ),
    /** Current status of this enrollment. */
    status: extAutomationEnrollmentStatusEnum("status")
      .notNull()
      .default("active"),
    /** Zero-based index of the current step in the journey's steps[] array. */
    currentStepIndex: integer("current_step_index").notNull().default(0),
    /** When the current step becomes eligible for execution. */
    currentStepAvailableAt: timestamp("current_step_available_at", {
      withTimezone: true,
    }).notNull(),
    /** Why the enrollment exited/failed (when status is exited|failed). */
    exitReason: text("exit_reason"),
    /**
     * Idempotency key: prevents duplicate enrollments for the same
     * (client, journey, triggering event) combination.
     */
    dedupeKey: text("dedupe_key"),
  },
  (t) => ({
    practiceClientIdx: index("ext_auto_enrollments_practice_client_idx").on(
      t.practiceId,
      t.clientId,
    ),
    journeyIdx: index("ext_auto_enrollments_journey_idx").on(
      t.practiceId,
      t.journeyId,
    ),
    statusIdx: index("ext_auto_enrollments_status_idx").on(
      t.practiceId,
      t.status,
      t.currentStepAvailableAt,
    ),
    /**
     * Unique dedupe key per practice: prevents duplicate enrollments.
     */
    dedupeUq: uniqueIndex("ext_auto_enrollments_practice_dedupe_uq").on(
      t.practiceId,
      t.dedupeKey,
    ),
    /**
     * Unique (client, journey, triggeringEvent) per practice: prevents
     * enrolling the same client in the same journey twice for the same event.
     */
    clientJourneyEventUq: uniqueIndex(
      "ext_auto_enrollments_client_journey_event_uq",
    ).on(t.practiceId, t.clientId, t.journeyId, t.triggeringEventId),
    appendOnlyCheck: check(
      "ext_auto_enrollments_append_only",
      sql`${t.deletedAt} IS NULL`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 2E. ext_automation_step_executions — per-step execution ledger
// ---------------------------------------------------------------------------

/**
 * Immutable ledger of every journey step execution attempt.
 *
 * Each row records exactly one action (send SMS, create task, etc.) and
 * whether it succeeded, failed, or was suppressed. This is the audit trail
 * for "what did we try to do for this client, and why?"
 */
export const extAutomationStepExecutions = pgTable(
  "ext_automation_step_executions",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => extAutomationEnrollments.id),
    /** Zero-based step index matching the journey's steps[] array. */
    stepIndex: integer("step_index").notNull(),
    /** Step kind: wait | send | task | content_brief | condition | exit */
    stepKind: text("step_kind").notNull(),
    /** Human-readable step label from the journey definition. */
    stepLabel: text("step_label"),
    /** When this step became eligible for execution. */
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    /** When execution was attempted (regardless of outcome). */
    executedAt: timestamp("executed_at", { withTimezone: true }),
    /** scheduled | executing | done | skipped | failed */
    status: extAutomationStepStatusEnum("status")
      .notNull()
      .default("scheduled"),
    /** Why the step was skipped/failed (when applicable). */
    outcomeReason: text("outcome_reason"),
    /**
     * Exactly one of these action-target FKs is populated per row,
     * depending on stepKind:
     */
    /** ext_marketing_message_logs.id (for send steps). */
    messageLogId: uuid("message_log_id").references(
      () => extMarketingMessageLogs.id,
    ),
    /** communications.id (for portal/email log steps). */
    communicationId: uuid("communication_id").references(
      () => communications.id,
    ),
    /** ext_marketing_content_items.id (for content_brief steps). */
    contentItemId: uuid("content_item_id").references(
      () => extMarketingContentItems.id,
    ),
    /** ext_marketing_staff_tasks.id (for task steps). */
    staffTaskId: uuid("staff_task_id").references(
      () => extMarketingStaffTasks.id,
    ),
    /** care_reminders.id (for clinical task steps). */
    careReminderId: uuid("care_reminder_id").references(() => careReminders.id),
  },
  (t) => ({
    enrollmentIdx: index("ext_auto_step_exec_enrollment_idx").on(
      t.practiceId,
      t.enrollmentId,
    ),
    statusIdx: index("ext_auto_step_exec_status_idx").on(
      t.practiceId,
      t.status,
      t.scheduledAt,
    ),
    scheduledIdx: index("ext_auto_step_exec_scheduled_idx").on(
      t.practiceId,
      t.scheduledAt,
    ),
    messageLogIdx: index("ext_auto_step_exec_message_log_idx").on(
      t.practiceId,
      t.messageLogId,
    ),
    appendOnlyCheck: check(
      "ext_auto_step_exec_append_only",
      sql`${t.deletedAt} IS NULL`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 2K. ext_automation_suppression_log — suppression audit trail
// ---------------------------------------------------------------------------

/**
 * Immutable ledger of every time an automated action was withheld.
 *
 * Each row answers "why did this client NOT receive a message?" during a
 * GDPR/TCPA enquiry. This is critical for compliance: it proves that
 * suppressions were applied consistently and for documented reasons.
 */
export const extAutomationSuppressionLog = pgTable(
  "ext_automation_suppression_log",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    patientId: uuid("patient_id").references(() => patients.id),
    /** Event that would have triggered the action. */
    eventId: uuid("event_id").references(() => extAutomationEvents.id),
    /** Rule/journey that was suppressed. */
    ruleId: uuid("rule_id").references(() => extAutomationRules.id),
    journeyId: uuid("journey_id").references(() => extAutomationJourneys.id),
    enrollmentId: uuid("enrollment_id").references(
      () => extAutomationEnrollments.id,
    ),
    stepExecutionId: uuid("step_execution_id").references(
      () => extAutomationStepExecutions.id,
    ),
    /** Why the action was suppressed (see enum). */
    suppressionReason: extAutomationSuppressionReasonEnum("suppression_reason")
      .notNull(),
    /** Additional context (e.g. "quiet hours until 08:00", "rate limit until 2026-09-19"). */
    suppressionDetail: text("suppression_detail"),
    /**
     * Idempotency key: prevents duplicate suppression rows for the same
     * (client, reason, event) combination.
     */
    dedupeKey: text("dedupe_key"),
  },
  (t) => ({
    practiceClientIdx: index("ext_auto_suppress_practice_client_idx").on(
      t.practiceId,
      t.clientId,
    ),
    eventIdx: index("ext_auto_suppress_event_idx").on(
      t.practiceId,
      t.eventId,
    ),
    reasonIdx: index("ext_auto_suppress_reason_idx").on(
      t.practiceId,
      t.suppressionReason,
    ),
    /** Unique dedupe key per practice. */
    dedupeUq: uniqueIndex("ext_auto_suppress_practice_dedupe_uq").on(
      t.practiceId,
      t.dedupeKey,
    ),
    appendOnlyCheck: check(
      "ext_auto_suppress_append_only",
      sql`${t.deletedAt} IS NULL`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const extAutomationEventsRelations = relations(
  extAutomationEvents,
  ({ one, many }) => ({
    practice: one(practices, {
      fields: [extAutomationEvents.practiceId],
      references: [practices.id],
    }),
    client: one(clients, {
      fields: [extAutomationEvents.clientId],
      references: [clients.id],
    }),
    patient: one(patients, {
      fields: [extAutomationEvents.patientId],
      references: [patients.id],
    }),
    appointment: one(appointments, {
      fields: [extAutomationEvents.appointmentId],
      references: [appointments.id],
    }),
    visitCloseout: one(visitCloseouts, {
      fields: [extAutomationEvents.visitCloseoutId],
      references: [visitCloseouts.id],
    }),
    emittedByUser: one(users, {
      fields: [extAutomationEvents.emittedBy],
      references: [users.id],
    }),
    suppressions: many(extAutomationSuppressionLog),
  }),
);

export const extAutomationRulesRelations = relations(
  extAutomationRules,
  ({ one, many }) => ({
    practice: one(practices, {
      fields: [extAutomationRules.practiceId],
      references: [practices.id],
    }),
    suppressions: many(extAutomationSuppressionLog),
  }),
);

export const extAutomationJourneysRelations = relations(
  extAutomationJourneys,
  ({ one, many }) => ({
    practice: one(practices, {
      fields: [extAutomationJourneys.practiceId],
      references: [practices.id],
    }),
    enrollments: many(extAutomationEnrollments),
    suppressions: many(extAutomationSuppressionLog),
  }),
);

export const extAutomationEnrollmentsRelations = relations(
  extAutomationEnrollments,
  ({ one, many }) => ({
    practice: one(practices, {
      fields: [extAutomationEnrollments.practiceId],
      references: [practices.id],
    }),
    client: one(clients, {
      fields: [extAutomationEnrollments.clientId],
      references: [clients.id],
    }),
    patient: one(patients, {
      fields: [extAutomationEnrollments.patientId],
      references: [patients.id],
    }),
    journey: one(extAutomationJourneys, {
      fields: [extAutomationEnrollments.journeyId],
      references: [extAutomationJourneys.id],
    }),
    triggeringEvent: one(extAutomationEvents, {
      fields: [extAutomationEnrollments.triggeringEventId],
      references: [extAutomationEvents.id],
    }),
    stepExecutions: many(extAutomationStepExecutions),
    suppressions: many(extAutomationSuppressionLog),
  }),
);

export const extAutomationStepExecutionsRelations = relations(
  extAutomationStepExecutions,
  ({ one }) => ({
    practice: one(practices, {
      fields: [extAutomationStepExecutions.practiceId],
      references: [practices.id],
    }),
    enrollment: one(extAutomationEnrollments, {
      fields: [extAutomationStepExecutions.enrollmentId],
      references: [extAutomationEnrollments.id],
    }),
    messageLog: one(extMarketingMessageLogs, {
      fields: [extAutomationStepExecutions.messageLogId],
      references: [extMarketingMessageLogs.id],
    }),
    communication: one(communications, {
      fields: [extAutomationStepExecutions.communicationId],
      references: [communications.id],
    }),
    contentItem: one(extMarketingContentItems, {
      fields: [extAutomationStepExecutions.contentItemId],
      references: [extMarketingContentItems.id],
    }),
    staffTask: one(extMarketingStaffTasks, {
      fields: [extAutomationStepExecutions.staffTaskId],
      references: [extMarketingStaffTasks.id],
    }),
    careReminder: one(careReminders, {
      fields: [extAutomationStepExecutions.careReminderId],
      references: [careReminders.id],
    }),
  }),
);

export const extAutomationSuppressionLogRelations = relations(
  extAutomationSuppressionLog,
  ({ one }) => ({
    practice: one(practices, {
      fields: [extAutomationSuppressionLog.practiceId],
      references: [practices.id],
    }),
    client: one(clients, {
      fields: [extAutomationSuppressionLog.clientId],
      references: [clients.id],
    }),
    patient: one(patients, {
      fields: [extAutomationSuppressionLog.patientId],
      references: [patients.id],
    }),
    event: one(extAutomationEvents, {
      fields: [extAutomationSuppressionLog.eventId],
      references: [extAutomationEvents.id],
    }),
    rule: one(extAutomationRules, {
      fields: [extAutomationSuppressionLog.ruleId],
      references: [extAutomationRules.id],
    }),
    journey: one(extAutomationJourneys, {
      fields: [extAutomationSuppressionLog.journeyId],
      references: [extAutomationJourneys.id],
    }),
    enrollment: one(extAutomationEnrollments, {
      fields: [extAutomationSuppressionLog.enrollmentId],
      references: [extAutomationEnrollments.id],
    }),
    stepExecution: one(extAutomationStepExecutions, {
      fields: [extAutomationSuppressionLog.stepExecutionId],
      references: [extAutomationStepExecutions.id],
    }),
  }),
);
