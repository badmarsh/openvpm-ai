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
    processedAt: timestamp("processed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    retryCount: integer("retry_count").notNull().default(0),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    /** Bumped when the payload shape changes; lets readers stay compatible. */
    schemaVersion: integer("schema_version").notNull().default(1),
  },
  (table) => ({
    clientTenantFk: foreignKey({
      columns: [table.practiceId, table.clientId],
      foreignColumns: [clients.practiceId, clients.id],
      name: "ext_auto_events_client_tenant_fk",
    }),
    patientTenantFk: foreignKey({
      columns: [table.practiceId, table.patientId],
      foreignColumns: [patients.practiceId, patients.id],
      name: "ext_auto_events_patient_tenant_fk",
    }),
    appointmentTenantFk: foreignKey({
      columns: [table.practiceId, table.appointmentId],
      foreignColumns: [appointments.practiceId, appointments.id],
      name: "ext_auto_events_appointment_tenant_fk",
    }),
    /** Required by the brief: processing-queue queries scoped by event type. */
    practiceTypeProcessedIdx: index("ext_auto_events_type_processed_idx").on(
      table.practiceId,
      table.eventType,
      table.processedAt,
    ),
    /** Required by the brief: per-client history / "what did we do for X". */
    practiceClientIdx: index("ext_auto_events_practice_client_idx").on(
      table.practiceId,
      table.clientId,
      table.occurredAt,
    ),
    /**
     * The actual work-queue scan. Partial so the index stays small as the log
     * grows: only rows still awaiting a worker are ever in it. Matches the
     * index Agent 3's polling worker was designed against.
     */
    queueIdx: index("ext_auto_events_queue_idx")
      .on(table.status, table.availableAt, table.id)
      .where(sql`${table.status} = 'pending' and ${table.deletedAt} is null`),
    /** Stuck-claim recovery: rows left in 'processing' by a dead worker. */
    stuckIdx: index("ext_auto_events_stuck_idx")
      .on(table.lockedAt)
      .where(sql`${table.status} = 'processing'`),
    practiceAppointmentIdx: index("ext_auto_events_appointment_idx").on(
      table.practiceId,
      table.appointmentId,
    ),
    /** Makes event emission idempotent under webhook/cron retries. */
    emissionUq: uniqueIndex("ext_auto_events_emission_uq")
      .on(table.practiceId, table.eventType, table.dedupeKey)
      .where(sql`${table.dedupeKey} is not null`),
    retryCountCheck: check(
      "ext_auto_events_retry_count_check",
      sql`${table.retryCount} >= 0`,
    ),
    terminalStateCheck: check(
      "ext_auto_events_terminal_state_check",
      sql`${table.processedAt} is null or ${table.failedAt} is null`,
    ),
    statusTimestampCheck: check(
      "ext_auto_events_status_timestamp_check",
      sql`(${table.status} = 'processed') = (${table.processedAt} is not null)
        and (${table.status} = 'failed') = (${table.failedAt} is not null)`,
    ),
    /** A skip or a failure must say why. */
    reasonRequiredCheck: check(
      "ext_auto_events_reason_required_check",
      sql`${table.status} not in ('skipped', 'failed')
        or char_length(btrim(coalesce(${table.processedReason}, ''))) >= 3`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 2B. ext_automation_rules — the rules engine
// ---------------------------------------------------------------------------

/**
 * NOTE — COLLISION: `ext_marketing_automation_rules` already exists
 * (ext_marketing.ts:329) with columns key/label/trigger_key/timing/channel/
 * legal_basis/enabled/sort and a unique (practice_id, key). It is a flat
 * on/off toggle table, not a rules engine. The four seeded rows migrate 1:1
 * into this table; `migrated_from_key` records the provenance so the old table
 * can be retired without losing the mapping.
 */
export const extAutomationRules = pgTable(
  "ext_automation_rules",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    /** Stable upsert key (mirrors ext_marketing_automation_rules.key). */
    ruleKey: text("rule_key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    isActive: boolean("is_active").notNull().default(false),
    triggerEventType: extAutomationEventTypeEnum("trigger_event_type").notNull(),
    conditionJson: jsonb("condition_json")
      .$type<AutomationRuleCondition>()
      .notNull()
      .default({}),
    delayHours: integer("delay_hours").notNull().default(0),
    actionType: extAutomationRuleActionEnum("action_type").notNull(),
    actionConfig: jsonb("action_config")
      .$type<AutomationActionConfig>()
      .notNull()
      .default({}),
    priority: integer("priority").notNull().default(100),
    /**
     * GDPR legal basis for anything this rule sends. Mirrors
     * ext_marketing_automation_rules.legal_basis and
     * ext_marketing_message_templates.legal_basis.
     */
    legalBasis: text("legal_basis").notNull().default("contract"),
    /** Consent scope from ext_marketing_consent_scope, when one is required. */
    requiresConsentScope: text("requires_consent_scope"),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    /** ext_marketing_automation_rules.key this rule was migrated from. */
    migratedFromKey: text("migrated_from_key"),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (table) => ({
    creatorTenantFk: foreignKey({
      columns: [table.practiceId, table.createdBy],
      foreignColumns: [users.practiceId, users.id],
      name: "ext_auto_rules_creator_tenant_fk",
    }),
    practiceKeyUq: uniqueIndex("ext_auto_rules_practice_key_uq")
      .on(table.practiceId, table.ruleKey)
      .where(sql`${table.deletedAt} is null`),
    /** Rule resolution: "which active rules fire for this event type". */
    triggerIdx: index("ext_auto_rules_trigger_idx")
      .on(table.practiceId, table.triggerEventType, table.priority, table.id)
      .where(sql`${table.isActive} = true and ${table.deletedAt} is null`),
    practiceIdx: index("ext_auto_rules_practice_idx").on(
      table.practiceId,
      table.deletedAt,
    ),
    delayCheck: check(
      "ext_auto_rules_delay_check",
      sql`${table.delayHours} >= 0`,
    ),
    priorityCheck: check(
      "ext_auto_rules_priority_check",
      sql`${table.priority} >= 0`,
    ),
    validityWindowCheck: check(
      "ext_auto_rules_validity_check",
      sql`${table.validFrom} is null or ${table.validTo} is null or ${table.validFrom} <= ${table.validTo}`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 2C. ext_automation_journeys — journey definitions (templates)
// ---------------------------------------------------------------------------

export const extAutomationJourneys = pgTable(
  "ext_automation_journeys",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    journeyKey: text("journey_key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    triggerEventType: extAutomationEventTypeEnum("trigger_event_type").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    steps: jsonb("steps")
      .$type<AutomationJourneyStep[]>()
      .notNull()
      .default([]),
    /**
     * Bumped on every edit. Enrollments pin the version they started with so
     * editing a live journey cannot corrupt in-flight instances.
     */
    version: integer("version").notNull().default(1),
    /** Frequency cap: max N journey messages per client per rolling window. */
    frequencyCapWindowDays: integer("frequency_cap_window_days")
      .notNull()
      .default(30),
    frequencyCapMaxSteps: integer("frequency_cap_max_steps")
      .notNull()
      .default(4),
    /** Whether a new trigger event may re-enroll a client already enrolled. */
    allowReentry: boolean("allow_reentry").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (table) => ({
    creatorTenantFk: foreignKey({
      columns: [table.practiceId, table.createdBy],
      foreignColumns: [users.practiceId, users.id],
      name: "ext_auto_journeys_creator_tenant_fk",
    }),
    practiceKeyUq: uniqueIndex("ext_auto_journeys_practice_key_uq")
      .on(table.practiceId, table.journeyKey)
      .where(sql`${table.deletedAt} is null`),
    triggerIdx: index("ext_auto_journeys_trigger_idx")
      .on(table.practiceId, table.triggerEventType, table.id)
      .where(sql`${table.isActive} = true and ${table.deletedAt} is null`),
    versionCheck: check(
      "ext_auto_journeys_version_check",
      sql`${table.version} >= 1`,
    ),
    frequencyCapCheck: check(
      "ext_auto_journeys_frequency_cap_check",
      sql`${table.frequencyCapWindowDays} >= 1 and ${table.frequencyCapMaxSteps} >= 0`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 2D. ext_automation_enrollments — per-client journey instances
// ---------------------------------------------------------------------------

export const extAutomationEnrollments = pgTable(
  "ext_automation_enrollments",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    journeyId: uuid("journey_id")
      .notNull()
      .references(() => extAutomationJourneys.id),
    /** Pinned at enrollment time; see ext_automation_journeys.version. */
    journeyVersion: integer("journey_version").notNull().default(1),
    clientId: uuid("client_id").notNull(),
    patientId: uuid("patient_id"),
    triggerEventId: uuid("trigger_event_id")
      .notNull()
      .references(() => extAutomationEvents.id),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    exitedAt: timestamp("exited_at", { withTimezone: true }),
    exitReason: text("exit_reason"),
    currentStepIndex: integer("current_step_index").notNull().default(0),
    status: extAutomationEnrollmentStatusEnum("status")
      .notNull()
      .default("active"),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    pauseReason: text("pause_reason"),
    lastStepExecutedAt: timestamp("last_step_executed_at", {
      withTimezone: true,
    }),
  },
  (table) => ({
    clientTenantFk: foreignKey({
      columns: [table.practiceId, table.clientId],
      foreignColumns: [clients.practiceId, clients.id],
      name: "ext_auto_enrollments_client_tenant_fk",
    }),
    patientTenantFk: foreignKey({
      columns: [table.practiceId, table.patientId],
      foreignColumns: [patients.practiceId, patients.id],
      name: "ext_auto_enrollments_patient_tenant_fk",
    }),
    journeyFk: foreignKey({
      columns: [table.journeyId],
      foreignColumns: [extAutomationJourneys.id],
      name: "ext_auto_enrollments_journey_fk",
    }),
    /** Required by the brief: active journeys for a given client. */
    practiceClientStatusIdx: index("ext_auto_enroll_client_status_idx").on(
      table.practiceId,
      table.clientId,
      table.status,
    ),
    /** Required by the brief: fleet view per journey. */
    practiceJourneyStatusIdx: index("ext_auto_enroll_journey_status_idx").on(
      table.practiceId,
      table.journeyId,
      table.status,
    ),
    /**
     * One enrollment per client per journey per triggering event. Makes
     * double-fire of the same event a no-op instead of a duplicate journey.
     */
    enrollmentUq: uniqueIndex("ext_auto_enroll_dedupe_uq").on(
      table.practiceId,
      table.journeyId,
      table.clientId,
      table.triggerEventId,
    ),
    stateCheck: check(
      "ext_auto_enroll_state_check",
      sql`(${table.status} in ('active', 'paused') and ${table.exitedAt} is null)
        or (${table.status} in ('completed', 'exited', 'failed') and ${table.exitedAt} is not null)`,
    ),
    pauseCheck: check(
      "ext_auto_enroll_pause_check",
      sql`(${table.status} = 'paused') = (${table.pausedAt} is not null)`,
    ),
    stepIndexCheck: check(
      "ext_auto_enroll_step_index_check",
      sql`${table.currentStepIndex} >= 0`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 2E. ext_automation_step_executions — individual step results
// ---------------------------------------------------------------------------

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
    stepIndex: integer("step_index").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    skippedAt: timestamp("skipped_at", { withTimezone: true }),
    skipReason: text("skip_reason"),
    /** Reuses ext_marketing_channel per the brief (see migration note: needs ADD VALUE). */
    channelUsed: extMarketingChannelEnum("channel_used"),
    /**
     * The real outbound ledger in this codebase is ext_marketing_message_logs,
     * not `communications`. Populate this for send steps.
     */
    messageLogId: uuid("message_log_id").references(
      () => extMarketingMessageLogs.id,
    ),
    communicationId: uuid("communication_id"),
    contentItemId: uuid("content_item_id").references(
      () => extMarketingContentItems.id,
    ),
    staffTaskId: uuid("staff_task_id").references(
      () => extMarketingStaffTasks.id,
    ),
    careReminderId: uuid("care_reminder_id").references(() => careReminders.id),
    status: extAutomationStepStatusEnum("status")
      .notNull()
      .default("scheduled"),
    failureReason: text("failure_reason"),
  },
  (table) => ({
    communicationTenantFk: foreignKey({
      columns: [table.practiceId, table.communicationId],
      foreignColumns: [communications.practiceId, communications.id],
      name: "ext_auto_steps_communication_tenant_fk",
    }),
    /** The due-step sweeper: cheap, partial, ordered. */
    dueIdx: index("ext_auto_steps_due_idx")
      .on(table.scheduledAt, table.id)
      .where(
        sql`${table.status} = 'scheduled' and ${table.deletedAt} is null`,
      ),
    practiceEnrollmentIdx: index("ext_auto_steps_enrollment_idx").on(
      table.practiceId,
      table.enrollmentId,
      table.stepIndex,
    ),
    /** A step runs exactly once per enrollment. */
    stepUq: uniqueIndex("ext_auto_steps_enrollment_step_uq").on(
      table.enrollmentId,
      table.stepIndex,
    ),
    practiceStatusIdx: index("ext_auto_steps_status_idx").on(
      table.practiceId,
      table.status,
      table.executedAt,
    ),
    stepIndexCheck: check(
      "ext_auto_steps_step_index_check",
      sql`${table.stepIndex} >= 0`,
    ),
    terminalTimestampCheck: check(
      "ext_auto_steps_terminal_check",
      sql`(${table.status} = 'done') = (${table.executedAt} is not null)
        and (${table.status} = 'skipped') = (${table.skippedAt} is not null)`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 2K. ext_automation_suppression_log — audit trail of every withheld action
// ---------------------------------------------------------------------------

/**
 * Append-only. One row per withheld action. `dedupeKey` keeps a client who is
 * suppressed on every cron pass from flooding the log: callers should build it
 * as `${clientId}:${reason}:${blockedAction}:${YYYY-MM-DD}`.
 */
export const extAutomationSuppressionLog = pgTable(
  "ext_automation_suppression_log",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    clientId: uuid("client_id").notNull(),
    patientId: uuid("patient_id"),
    suppressionReason: extAutomationSuppressionReasonEnum(
      "suppression_reason",
    ).notNull(),
    /** What was blocked, e.g. "journey:post_vaccine.step_2", "rule:review_ask". */
    blockedAction: text("blocked_action").notNull(),
    channelAttempted: extMarketingChannelEnum("channel_attempted"),
    blockedAt: timestamp("blocked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** When the hold lifts (cooldown / quiet hours / recovery hold). */
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
    enrollmentId: uuid("enrollment_id").references(
      () => extAutomationEnrollments.id,
    ),
    ruleId: uuid("rule_id").references(() => extAutomationRules.id),
    journeyId: uuid("journey_id").references(() => extAutomationJourneys.id),
    eventId: uuid("event_id").references(() => extAutomationEvents.id),
    dedupeKey: text("dedupe_key"),
    detail: text("detail"),
  },
  (table) => ({
    clientTenantFk: foreignKey({
      columns: [table.practiceId, table.clientId],
      foreignColumns: [clients.practiceId, clients.id],
      name: "ext_auto_suppression_client_tenant_fk",
    }),
    patientTenantFk: foreignKey({
      columns: [table.practiceId, table.patientId],
      foreignColumns: [patients.practiceId, patients.id],
      name: "ext_auto_suppression_patient_tenant_fk",
    }),
    /** "Why has this client heard nothing from us?" — the primary query. */
    practiceClientIdx: index("ext_auto_suppression_client_idx").on(
      table.practiceId,
      table.clientId,
      table.blockedAt,
    ),
    practiceReasonIdx: index("ext_auto_suppression_reason_idx").on(
      table.practiceId,
      table.suppressionReason,
      table.blockedAt,
    ),
    /** Sympathy-gate evidence must be retrievable by patient. */
    practicePatientIdx: index("ext_auto_suppression_patient_idx").on(
      table.practiceId,
      table.patientId,
      table.blockedAt,
    ),
    dedupeUq: uniqueIndex("ext_auto_suppression_dedupe_uq")
      .on(table.practiceId, table.dedupeKey)
      .where(sql`${table.dedupeKey} is not null`),
    blockedActionCheck: check(
      "ext_auto_suppression_blocked_action_check",
      sql`char_length(btrim(${table.blockedAction})) between 3 and 200`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const extAutomationEventsRelations = relations(
  extAutomationEvents,
  ({ one }) => ({
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
  }),
);

export const extAutomationRulesRelations = relations(
  extAutomationRules,
  ({ one }) => ({
    practice: one(practices, {
      fields: [extAutomationRules.practiceId],
      references: [practices.id],
    }),
    createdByUser: one(users, {
      fields: [extAutomationRules.createdBy],
      references: [users.id],
    }),
  }),
);

export const extAutomationJourneysRelations = relations(
  extAutomationJourneys,
  ({ one, many }) => ({
    practice: one(practices, {
      fields: [extAutomationJourneys.practiceId],
      references: [practices.id],
    }),
    createdByUser: one(users, {
      fields: [extAutomationJourneys.createdBy],
      references: [users.id],
    }),
    enrollments: many(extAutomationEnrollments),
  }),
);

export const extAutomationEnrollmentsRelations = relations(
  extAutomationEnrollments,
  ({ one, many }) => ({
    practice: one(practices, {
      fields: [extAutomationEnrollments.practiceId],
      references: [practices.id],
    }),
    journey: one(extAutomationJourneys, {
      fields: [extAutomationEnrollments.journeyId],
      references: [extAutomationJourneys.id],
    }),
    client: one(clients, {
      fields: [extAutomationEnrollments.clientId],
      references: [clients.id],
    }),
    patient: one(patients, {
      fields: [extAutomationEnrollments.patientId],
      references: [patients.id],
    }),
    triggerEvent: one(extAutomationEvents, {
      fields: [extAutomationEnrollments.triggerEventId],
      references: [extAutomationEvents.id],
    }),
    stepExecutions: many(extAutomationStepExecutions),
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
    enrollment: one(extAutomationEnrollments, {
      fields: [extAutomationSuppressionLog.enrollmentId],
      references: [extAutomationEnrollments.id],
    }),
    rule: one(extAutomationRules, {
      fields: [extAutomationSuppressionLog.ruleId],
      references: [extAutomationRules.id],
    }),
    journey: one(extAutomationJourneys, {
      fields: [extAutomationSuppressionLog.journeyId],
      references: [extAutomationJourneys.id],
    }),
    event: one(extAutomationEvents, {
      fields: [extAutomationSuppressionLog.eventId],
      references: [extAutomationEvents.id],
    }),
  }),
);
