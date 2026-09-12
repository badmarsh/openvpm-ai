# OpenVPM Autopilot Vision — Agent 2: Schema Design

**Repo:** `openvpm-ai` · **Anchor commit:** `23f23a3` · **Branch:** `arena/01a09592-openvpm-ai`
**Date:** 2026-09-12 · **Author:** Agent 2 (Schema Design)
**Scope:** Complete Drizzle ORM schema for the five automation pillars.

---

## §0 — Provenance, verification, and corrections to the brief

### 0.1 Environment note (read this first)

This session **did** have read access to the repository, so the claims below carry real
`[VERIFIED: path:Lnn]` tags rather than inferences. Everything was read from the working
checkout at commit `23f23a3` on branch `arena/01a09592-openvpm-ai`.

**What is genuinely absent:** the prior-art directory `artifacts/feature-map-2026-09-12/`
does not exist in this checkout. `ls artifacts/` returns exactly six entries:
`ai-feature-audit.md`, `audit-prompts/`, `bug-hunt-remediation-report.md`,
`dr-drill-report.json`, `production-readiness-report.json`,
`ux-codebase-analysis-2026-09-11.md`. Neither `FEATURE-INDEX.md`,
`REORGANIZATION-FINDINGS.md`, nor any `domains/*.md` file is present, and
`artifacts/autopilot-vision-2026-09-12/` did not exist before this document was written.

**Consequence:** Agent 1's output — including the "14 events" list referenced in task 2A —
could not be consulted. Rather than invent a plausible list, I derived the event vocabulary
directly from the trigger keys the code actually emits today (§A.1). If Agent 1's artifact
lands later, diff its event list against the 28 values in `extAutomationEventTypeEnum` and
add any missing ones with `ALTER TYPE ... ADD VALUE`.

Every other file named in the brief **was** read. Confirmed present at this commit:
`packages/db/schema/{common,ext_marketing,care-reminders,communications,ext_ai_audit_log,visit-closeouts,clients,patients,scheduling,users,consents,index}.ts`,
`apps/web/server/routers/extensions/marketing.ts`, `apps/web/server/routers/care-reminders.ts`,
`.agents/skills/openvpm-ai/SKILL.md`.

### 0.2 Line-count reconciliation

| Brief says | Actual | Status |
|---|---|---|
| `ext_marketing.ts` — 413 lines | 413 lines (`wc -l` = 412; file has no trailing newline) | ✅ correct |
| `marketing.ts` router — 3492 lines | 3491 newlines → 3492 lines | ✅ correct |
| `care-reminders.ts` router — 760 lines | 759 newlines → 760 lines | ✅ correct |
| `extMarketingReviews` at `ext_marketing.ts:L126-L147` | Exactly L126–L147 | ✅ correct |

### 0.3 Corrections I made to the spec — and why

These are not stylistic. Each one would have produced a schema that does not fit the codebase.

**C1 — `visitId (nullable FK)` in table 2A has no target table.** `[VERIFIED]` There is no
`visits` table anywhere in `packages/db/schema/` — `grep -rn 'pgTable("visits"' packages/db/schema/`
returns nothing. The visit lifecycle is modelled as `appointments` → `visit_closeouts`
(`packages/db/schema/visit-closeouts.ts:L114`, `appointmentUq` uniqueIndex makes it one
closeout per appointment) with status enum `draft | clinical_finalized | completed`
(`visit-closeouts.ts:L23-27`).
**Change:** `visitId` → **`visitCloseoutId` → `visitCloseouts.id`**, plus the existing
`appointmentId`. Both are kept because they answer different questions.

**C2 — Table 2H should be an ALTER, not a new table.** `[VERIFIED: ext_marketing.ts:L126-L147]`
`extMarketingReviews` already carries `practiceId, patientId, clientId, appointmentId,
platform, externalReviewId, rating, reviewText, reviewerName, receivedAt, replyText,
repliedAt, repliedBy, requestSentAt, requestBlockedReason` — the whole ingest-and-reply
spine. All 13 reputation-management fields the brief asks about are missing
(`grep -rni "sentiment" packages/db/schema/` returns nothing). A parallel
`ext_reputation_reviews` table would fork the review inbox in two and break
`extMarketingReviewsRelations` (`ext_marketing.ts:L213`).
**Change:** **no new table.** Add 19 nullable columns to `ext_marketing_reviews` (§A.11).
This makes the deliverable **10 new tables + 1 ALTER**, which is the "or 10" branch the brief
already anticipated.

**C3 — Table 2B collides with an existing rules table.** `[VERIFIED: ext_marketing.ts:L329-L343]`
`ext_marketing_automation_rules` already exists with `key, label, description, trigger_key,
timing, channel, legal_basis, enabled, sort` and `uniqueIndex("ext_mkt_auto_rule_practice_key_uq")
.on(practiceId, key)`. It is a flat on/off toggle list, **not** a rules engine — but it is the
thing the marketing UI and `createMessagesForTrigger` (`apps/web/lib/marketing/messaging.ts:L155-L167`)
read to decide whether a trigger is disabled. Shipping `ext_automation_rules` beside it with no
bridge creates two sources of truth for "is this automation on?".
**Change:** `ext_automation_rules` gains **`ruleKey`** (mirrors the existing `key`, unique per
practice) and **`migratedFromKey`** so the four seeded rows
(`packages/db/seed-marketing.ts:L775-L818`: `vaccination_recall`, `postop_checkin_24h`,
`google_review_ask`, `annual_wellness_invitation`) migrate 1:1 with provenance preserved.

**C4 — `extMarketingChannelEnum` cannot express the vision's channels.**
`[VERIFIED: ext_marketing.ts:L26]` The enum is exactly
`["instagram", "facebook", "google_business", "sms", "email"]`. Pillar 1 needs YouTube Shorts,
newsletter, and waiting-room TV; none exist. Since `ext_marketing.ts` is an `ext_*` file
(SKILL.md §1 permits editing those), the fix is additive — see §A.12 and §C step 13.

**C5 — `conditionSql text` on `ext_crm_segments` (2F) is a tenant-isolation hazard.** Storing
executable SQL per row means a single interpolation bug leaks or corrupts across practices.
**Change:** `conditionJson` (jsonb, whitelist-compiled) is the **source of truth**; `conditionSql`
is retained as the brief specifies but documented and typed as an **inert, human-readable
rendering** that the engine never executes. See the note in §A.2F.

**C6 — Two suppression reasons are missing from the 2K list.** `[VERIFIED: ext_marketing.ts:L272-L277]`
`extMarketingMessageStatusEnum` already distinguishes `suppressed_no_consent` from
`suppressed_rate`, and `processQueue` (`messaging.ts:L376`) sets `suppressed_no_consent`
when `marketingConsentOk()` (`messaging.ts:L604`) fails — that is "never opted in", which is
legally different from `opt_out`. Collapsing them would misreport the GDPR legal-basis audit.
**Change:** added `no_consent` and `unknown_contact` to `extAutomationSuppressionReasonEnum`.

**C7 — 2E's `communicationId` alone would not record a send.** `[VERIFIED: ext_marketing.ts:L278-L298]`
The real outbound ledger in this codebase is `ext_marketing_message_logs`, not `communications`
— `processQueue` (`messaging.ts:L455-L462`) writes delivery to `ext_sms_delivery_log` and updates
`ext_marketing_message_logs.status`. `communications` (`communications.ts:L37-L98`) is the
client-facing thread store with `channelEnum = phone|sms|email|portal` (`communications.ts:L19-L24`).
**Change:** `ext_automation_step_executions` carries `messageLogId`, `communicationId`,
`contentItemId`, `staffTaskId`, **and** `careReminderId` — one per possible action target.

### 0.4 What was actually executed

The three new schema files were written and **compiled**, not just written:

```
npx tsc --noEmit -p tsconfig.json     →  exit 0, no diagnostics
```

Run against a scratch copy of `packages/db/schema/` plus the three new files and the §B
`index.ts` additions, with `drizzle-orm@^0.45.2` / `typescript@^5.5.0` (the versions pinned in
`packages/db/package.json`) and the exact `compilerOptions` from
`packages/config/tsconfig.base.json` (`strict`, `isolatedModules`, `moduleDetection: force`,
`target ES2022`, `module ESNext`, `moduleResolution bundler`). Baseline of the unmodified
upstream schema also compiles clean, so exit 0 is attributable to the new code.

**The DDL was also executed against a real database.** No PostgreSQL ships in the sandbox
(`command -v postgres pg_ctl initdb psql` → not found; `apt-get` is not permitted), so one was
obtained from npm (`@embedded-postgres/linux-x64`, PostgreSQL **18.4**), `initdb`'d, and
`drizzle-kit push --force` run against it. That caught two defects TypeScript could not see, both
documented in §C.8 — including one that made the original `seasonMonths` CHECK invalid SQL.

**Still not executed:** `pnpm db:push` against the project's own `DATABASE_URL` (needs
`node_modules`, not installed in the workspace checkout), and the `ALTER TYPE ... ADD VALUE`
batching behaviour in §C.3 step 13.

### 0.5 Deliverable at a glance

| # | Brief ID | Table | File | Notes |
|---|---|---|---|---|
| 1 | 2A | `ext_automation_events` | `ext_automation.ts` | append-only bus |
| 2 | 2B | `ext_automation_rules` | `ext_automation.ts` | +`ruleKey`, +`migratedFromKey` (C3) |
| 3 | 2C | `ext_automation_journeys` | `ext_automation.ts` | +version pinning, +freq caps |
| 4 | 2D | `ext_automation_enrollments` | `ext_automation.ts` | +`journeyVersion`, +dedupe UQ |
| 5 | 2E | `ext_automation_step_executions` | `ext_automation.ts` | 5 action-target FKs (C7) |
| 6 | 2K | `ext_automation_suppression_log` | `ext_automation.ts` | +2 reasons (C6), +`dedupeKey` |
| 7 | 2F | `ext_crm_segments` | `ext_crm.ts` | +`conditionJson` (C5) |
| 8 | 2G | `ext_crm_segment_memberships` | `ext_crm.ts` | +membership UQ |
| 9 | 2I | `ext_content_pillars` | `ext_content_calendar.ts` | |
| 10 | 2J | `ext_content_briefs` | `ext_content_calendar.ts` | DB-level clinical gate |
| 11 | — | `ext_channel_accounts` | `ext_channel_accounts.ts` | fills Agent 3's gap G12 |
| — | 2H | `ext_marketing_reviews` **ALTER** | `ext_marketing.ts` | +19 cols, no new table (C2) |

Totals across the four new files (counted from the sources, not estimated): **11 tables,
10 `pgEnum`s, 27 indexes + 11 unique indexes, 28 CHECK constraints, 16 composite tenant foreign
keys.**

---

## §A — Complete Drizzle schema

Three new files, per SKILL.md §1 ("All new tables and enums MUST live in
`packages/db/schema/ext_{name}.ts`"). `index.ts` currently ends at
`export * from "./ext_kvepis";` `[VERIFIED: packages/db/schema/index.ts:L60]`; the new exports
are appended in §B.

Conventions followed, taken from `ext_marketing.ts` and `care-reminders.ts`:

- **`...baseColumns()`** on every table — `id`, `createdAt`, `updatedAt`, `deletedAt`
  `[VERIFIED: packages/db/schema/common.ts:L4-L16]`.
- **`practiceId uuid("practice_id").notNull().references(() => practices.id)`** first, always.
- **snake_case SQL column names**, camelCase TS properties.
- **Index naming** `ext_<domain>_<short>_<purpose>_idx` / `_uq`, matching
  `ext_mkt_consents_practice_client_idx` (`ext_marketing.ts:L44`).
- **Composite tenant FKs** where the target has a `(practice_id, id)` unique index — the pattern
  `care_reminders.ts:L57-L77` uses. Verified available for `clients` (`clients.ts:L70`),
  `patients` (`patients.ts:L80`), `appointments` (`scheduling.ts:L148`), `users` (`users.ts:L64`),
  `communications` (`communications.ts:L59`). **Not** available for `visit_closeouts` or
  `ext_marketing_content_items` (neither declares one), so those use plain FKs.
- **`relations()` block at the end of each file**, mirroring `ext_marketing.ts:L175-L229`.
- **Rich `check()` constraints** for state machines, as in `care-reminders.ts:L107-L124` and
  `visit-closeouts.ts`.

### §A.1 — Event type vocabulary (task 2A: "all 14 events from Agent 1")

Agent 1's list was unavailable (§0.1). The enum below is built from what the code actually
emits. `[VERIFIED]` A `grep -rhoE 'triggerKey: "[a-z_]+"'` across `apps/web/` and `packages/db/`
returns exactly **15 distinct values**; adding `payment_failed` (declared in the `TRIGGERS` map
at `messaging.ts:L48` but with no emitter found) gives **16 Tier-1 keys**:

**Correction to an earlier revision of this section.** It originally listed a single column headed
"where it is emitted today" and cited, for example, `vaccine_due` → `marketing.ts:L2049`. That was
wrong: `L2049` is a row in the `defaultRules` seed array inside `listAutomationRules`, which inserts
`ext_marketing_automation_rules` rows — it emits nothing. Grepping for `triggerKey: "…"` literals
finds *data*, not *emission*. The authoritative test is the call sites of
`createMessagesForTrigger`, of which `[VERIFIED]` there are exactly **seven**:
`appointments.ts:L1398, L1412, L1425`; `messaging.ts:L596, L664, L701`; `marketing.ts:L2023`.
This matches gap **G3** in Agent 3's `EVENT-ENGINE-PLAN.md`, reached independently.

**Tier 1a — genuinely emitted (6 fixed keys + 1 caller-supplied):**

| Event | Emission site | `eventId` passed |
|---|---|---|
| `visit_completed` | `appointments.ts:L1398` (on `status === "checked_out"`) | `appt.id` |
| `appointment_no_show` | `appointments.ts:L1412` | `appt.id` |
| `appointment_booked` | `appointments.ts:L1425` (on `status === "confirmed"`) | `appt.id` |
| `surgery_completed` | `messaging.ts:L596` in `schedulePostopCheckIn` | `` `discharge_${Date.now()}` `` |
| `dental_detected` | `messaging.ts:L664` in `detectAndTriggerDentalRecall` | `` `dental_${patientId}_${Date.now()}` `` |
| `senior_milestone` | `messaging.ts:L701` in `checkAndTriggerSeniorMilestone` | `` `senior_${patientId}_${year}` `` |
| *caller-supplied* | `marketing.ts:L2023` in `triggerMessage` (`input.triggerKey`) | `` `manual_${Date.now()}` `` |

The last three reach `createMessagesForTrigger` through `discharge.ts:L619`, `L627` and `L634`,
which call the three `messaging.ts` helpers. Both citations are correct at different layers —
Agent 3's `EVENT-ENGINE-PLAN.md` G3 lists the router-level sites, this table lists the
library-level ones.

**Tier 1b — declared in the `TRIGGERS` map but never emitted (`messaging.ts:L38-L59`):**
`vaccine_due`, `payment_failed`, `wellness_enrolled`. **The flagship "vaccine reminder" use case
therefore does not work today** — the rule exists, nothing fires it.

**Tier 1c — appears only as data, never emitted:** `patient_deceased` (`marketing.ts:L1545` —
inserted straight into `ext_marketing_message_logs` by `sendCondolenceCard`, bypassing
`createMessagesForTrigger` entirely), `appointment_completed` (`marketing.ts:L2073` seed row),
`inactive_recall` (`marketing.ts:L2085` seed row), `annual_checkup_due`
(`seed-marketing.ts:L814`), `visit_closeout` (`seed-marketing.ts:L802`), `senior_screening`
(`seed-marketing-demo.ts:L586`), `appointment_reminder` (`marketing-demo-data.ts:L561`).

All of Tier 1 is included **for backfill safety**: `ext_marketing_message_logs.trigger_key` is a plain
`text` column (`ext_marketing.ts:L292`) holding these exact strings, so copying historical rows
into the typed enum must not fail on an unknown value.

Tier 2 (12 values) is what the five pillars need and nothing emits today:
`lab_result_received`, `treatment_plan_created`, `prescription_issued`, `review_received`,
`review_reply_published`, `content_brief_approved`, `content_published`, `consent_revoked`,
`client_created`, `patient_created`, `patient_reactivated`, `inventory_delivery_received`.

**Total: 28 values.**

> ⚠️ **Two different "visit closed" signals exist and they are not the same event.**
> `[VERIFIED: appointments.ts:L1394-L1405]` fires `visit_completed` when
> `appointments.status === "checked_out"`. `visit_closeouts.status` reaches `completed`
> separately, via its own `completedStateCheck` (`visit-closeouts.ts`). `visit_closeout` and
> `visit_completed` are therefore **both** in the enum and mean different things. Journeys must
> pick deliberately — `visit_closeout` is the clinically-finalized signal, `visit_completed` is
> the front-desk checkout signal.

> ⚠️ **pgEnum is additive-only.** Postgres supports `ALTER TYPE ... ADD VALUE` but never
> `DROP VALUE` or `RENAME VALUE`. Never reorder or remove a value. High-cardinality variants go
> in `ext_automation_events.event_subtype`, not in the enum. There is precedent for this in the
> repo: `packages/db/drizzle/0086_safe_turbo.sql:L2`, `0087_medical_grey_gargoyle.sql:L1`,
> and `0088_noisy_lucky_pierre.sql:L12-L19` all add values to `migration_run_mode`.


### §A.2 — `packages/db/schema/ext_automation.ts` (tables 2A, 2B, 2C, 2D, 2E, 2K)

Six tables: the event bus, the rules engine, journey definitions, per-client enrollments, step executions, and the suppression audit trail. 840 lines. This is the exact file that compiled.

```ts
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
```

### §A.3 — `packages/db/schema/ext_crm.ts` (tables 2F, 2G)

Named segments and their memberships. 288 lines. Note the security comment on `conditionSql` (correction C5) and the non-negotiable `ext_crm_membership_uq` — without it a client can appear twice in one segment and every campaign count is wrong.

```ts
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
import { users } from "./users";
import { extAutomationEvents } from "./ext_automation";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * How a segment's membership is recomputed.
 *
 * `event_driven`  — membership changes when a matching event is processed.
 * `scheduled`     — a nightly/weekly sweep re-evaluates conditionJson.
 * `manual`        — staff add/remove clients by hand.
 */
export const extCrmRefreshStrategyEnum = pgEnum("ext_crm_refresh_strategy", [
  "event_driven",
  "scheduled",
  "manual",
]);

// ---------------------------------------------------------------------------
// JSON payload shapes
// ---------------------------------------------------------------------------

/**
 * The ONLY machine-evaluated segment definition. Compiled by a whitelisted
 * query builder into a parameterised, practice-scoped WHERE fragment.
 *
 * Never build this from free text and never interpolate user input into it.
 */
export type CrmSegmentCondition = {
  /** patients.species values, e.g. ["canine", "feline"]. */
  species?: string[];
  /** Patients with no visit in the last N days. */
  inactiveDays?: number;
  /** Patients with a visit in the last N days. */
  activeWithinDays?: number;
  /** Appointment types that qualify, e.g. ["surgery", "dental"]. */
  visitTypes?: string[];
  /** Days since the last visit of one of those types. */
  visitTypeWithinDays?: number;
  /** Require at least one patient with this status. */
  patientStatus?: "active" | "inactive";
  /** Minimum age in years of any active patient. */
  minAgeYears?: number;
  maxAgeYears?: number;
  /** Require a live consent for this ext_marketing_consent_scope value. */
  requireConsentScope?: string;
  /** Clients with no consent record at all are excluded by default. */
  excludeUncontactable?: boolean;
  /** Other segment keys that must also match (AND). */
  allOfSegmentKeys?: string[];
  /** Other segment keys that must NOT match (AND NOT). */
  noneOfSegmentKeys?: string[];
};

// ---------------------------------------------------------------------------
// 2F. ext_crm_segments — named client segments
// ---------------------------------------------------------------------------

/**
 * The 12 canonical segments from the vision are seeded with
 * `is_system = true` so they cannot be deleted, only deactivated.
 */
export const extCrmSegments = pgTable(
  "ext_crm_segments",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    name: text("name").notNull(),
    /**
     * Stable machine key, e.g. "inactive_6mo", "post_surgery",
     * "vaccine_overdue". Referenced by ext_automation_rules.condition_json
     * (segmentKeys / excludeSegmentKeys), so it must never be renamed in place.
     */
    segmentKey: text("segment_key").notNull(),
    description: text("description").notNull().default(""),
    /** System segments ship with the product and cannot be deleted. */
    isSystem: boolean("is_system").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    /**
     * SOURCE OF TRUTH. Whitelist-compiled by the segment engine.
     */
    conditionJson: jsonb("condition_json")
      .$type<CrmSegmentCondition>()
      .notNull()
      .default({}),
    /**
     * SECURITY NOTE — see SCHEMA-DESIGN.md §A.2F.
     *
     * This column is a rendered, human-readable rendering of conditionJson for
     * staff review and for the audit trail. It MUST NOT be executed. The
     * segment engine reads conditionJson only. Enforced by convention here and
     * by a code-level lint rule; there is no DB-level way to stop a query from
     * interpolating it, which is exactly why it must stay inert.
     */
    conditionSql: text("condition_sql"),
    refreshStrategy: extCrmRefreshStrategyEnum("refresh_strategy")
      .notNull()
      .default("event_driven"),
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
    /** Denormalised for list rendering; refreshed by the segment engine. */
    memberCountCache: integer("member_count_cache").notNull().default(0),
    /** Bumped when conditionJson changes so stale memberships can be detected. */
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (table) => ({
    creatorTenantFk: foreignKey({
      columns: [table.practiceId, table.createdBy],
      foreignColumns: [users.practiceId, users.id],
      name: "ext_crm_segments_creator_tenant_fk",
    }),
    practiceKeyUq: uniqueIndex("ext_crm_segments_practice_key_uq")
      .on(table.practiceId, table.segmentKey)
      .where(sql`${table.deletedAt} is null`),
    practiceIdx: index("ext_crm_segments_practice_idx").on(
      table.practiceId,
      table.deletedAt,
      table.isActive,
    ),
    refreshDueIdx: index("ext_crm_segments_refresh_due_idx")
      .on(table.practiceId, table.lastRefreshedAt)
      .where(
        sql`${table.refreshStrategy} = 'scheduled' and ${table.deletedAt} is null`,
      ),
    /** segment_key is a machine identifier: no whitespace, no uppercase. */
    segmentKeyFormatCheck: check(
      "ext_crm_segments_key_format_check",
      sql`${table.segmentKey} ~ '^[a-z][a-z0-9_]{1,62}$'`,
    ),
    versionCheck: check(
      "ext_crm_segments_version_check",
      sql`${table.version} >= 1`,
    ),
    memberCountCheck: check(
      "ext_crm_segments_member_count_check",
      sql`${table.memberCountCache} >= 0`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 2G. ext_crm_segment_memberships — which clients are in which segment
// ---------------------------------------------------------------------------

export const extCrmSegmentMemberships = pgTable(
  "ext_crm_segment_memberships",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    segmentId: uuid("segment_id")
      .notNull()
      .references(() => extCrmSegments.id),
    clientId: uuid("client_id").notNull(),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * When membership lapses on its own (e.g. "post_surgery" expires 30 days
     * after discharge). Null = open-ended.
     */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** Human-readable why, e.g. "visit_closeout 2026-09-10 (surgery)". */
    enrollmentReason: text("enrollment_reason"),
    triggerEventId: uuid("trigger_event_id").references(
      () => extAutomationEvents.id,
    ),
    /**
     * Staff opt-out of a specific segment for a specific client. Distinct from
     * a global marketing opt-out: the client still receives everything else.
     * Supersedes any automated re-enrollment.
     */
    isManuallyExcluded: boolean("is_manually_excluded")
      .notNull()
      .default(false),
    excludedBy: uuid("excluded_by").references(() => users.id),
    excludedAt: timestamp("excluded_at", { withTimezone: true }),
    /** Segment definition version at enrollment time. */
    segmentVersion: integer("segment_version").notNull().default(1),
  },
  (table) => ({
    clientTenantFk: foreignKey({
      columns: [table.practiceId, table.clientId],
      foreignColumns: [clients.practiceId, clients.id],
      name: "ext_crm_memberships_client_tenant_fk",
    }),
    excluderTenantFk: foreignKey({
      columns: [table.practiceId, table.excludedBy],
      foreignColumns: [users.practiceId, users.id],
      name: "ext_crm_memberships_excluder_tenant_fk",
    }),
    /** A client is in a segment at most once. Non-negotiable. */
    membershipUq: uniqueIndex("ext_crm_membership_uq")
      .on(table.practiceId, table.segmentId, table.clientId)
      .where(sql`${table.deletedAt} is null`),
    /** "Which segments is this client in right now?" — the hot read path. */
    practiceClientIdx: index("ext_crm_membership_client_idx").on(
      table.practiceId,
      table.clientId,
      table.isManuallyExcluded,
    ),
    /** "Who is in this segment, unexpired?" — campaign targeting. */
    practiceSegmentIdx: index("ext_crm_membership_segment_idx").on(
      table.practiceId,
      table.segmentId,
      table.isManuallyExcluded,
      table.expiresAt,
    ),
    /** Expiry sweeper. */
    expiryIdx: index("ext_crm_membership_expiry_idx")
      .on(table.expiresAt)
      .where(sql`${table.expiresAt} is not null and ${table.deletedAt} is null`),
    exclusionCheck: check(
      "ext_crm_membership_exclusion_check",
      sql`(${table.isManuallyExcluded} = false)
        or (${table.excludedBy} is not null and ${table.excludedAt} is not null)`,
    ),
    expiryCheck: check(
      "ext_crm_membership_expiry_window_check",
      sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.enrolledAt}`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const extCrmSegmentsRelations = relations(extCrmSegments, ({ one, many }) => ({
  practice: one(practices, {
    fields: [extCrmSegments.practiceId],
    references: [practices.id],
  }),
  createdByUser: one(users, {
    fields: [extCrmSegments.createdBy],
    references: [users.id],
  }),
  memberships: many(extCrmSegmentMemberships),
}));

export const extCrmSegmentMembershipsRelations = relations(
  extCrmSegmentMemberships,
  ({ one }) => ({
    practice: one(practices, {
      fields: [extCrmSegmentMemberships.practiceId],
      references: [practices.id],
    }),
    segment: one(extCrmSegments, {
      fields: [extCrmSegmentMemberships.segmentId],
      references: [extCrmSegments.id],
    }),
    client: one(clients, {
      fields: [extCrmSegmentMemberships.clientId],
      references: [clients.id],
    }),
    triggerEvent: one(extAutomationEvents, {
      fields: [extCrmSegmentMemberships.triggerEventId],
      references: [extAutomationEvents.id],
    }),
    excludedByUser: one(users, {
      fields: [extCrmSegmentMemberships.excludedBy],
      references: [users.id],
    }),
  }),
);
```

### §A.4 — `packages/db/schema/ext_content_calendar.ts` (tables 2I, 2J)

Content pillars and the AI brief queue. 251 lines. `extContentBriefs.clinicalApprovalCheck` is the SKILL.md §3 human-in-the-loop gate enforced at the database level, not just in the router.

```ts
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
import { users } from "./users";
import { extMarketingContentItems } from "./ext_marketing";
import { extAutomationEvents } from "./ext_automation";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const extContentBriefStatusEnum = pgEnum("ext_content_brief_status", [
  "pending",
  "generating",
  "review",
  "approved",
  "rejected",
  "archived",
]);

// ---------------------------------------------------------------------------
// JSON payload shapes
// ---------------------------------------------------------------------------

/**
 * Any clinical assertion inside a generated brief that a veterinarian must
 * approve before the content may be published.
 *
 * SKILL.md §3: medical/clinical decisions must never be auto-committed without
 * human confirmation. A brief with a non-empty clinical_claims array therefore
 * cannot reach status 'approved' without reviewed_by set — enforced by the
 * `clinicalApprovalCheck` constraint below.
 */
export type ContentClinicalClaim = {
  /** The exact sentence or phrase as it appears in the brief. */
  claim: string;
  kind: "dosage" | "diagnosis" | "prognosis" | "lab_interpretation" | "prevention_efficacy" | "other";
  /** Where it came from, e.g. "visit_closeouts.discharge_instructions". */
  sourceRef?: string;
  verdict?: "approved" | "rejected" | "edited";
  reviewerNote?: string;
};

export type ContentBriefSource = {
  eventType?: string;
  eventId?: string;
  /** Deliberately de-identified: never store client/patient identifiers here. */
  patientSpecies?: string;
  visitType?: string;
  seasonHint?: string;
};

// ---------------------------------------------------------------------------
// 2I. ext_content_pillars — content calendar pillar library
// ---------------------------------------------------------------------------

export const extContentPillars = pgTable(
  "ext_content_pillars",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    /** e.g. "vaccination", "dental", "parasite_seasonal". */
    pillarKey: text("pillar_key").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** patients.species values this pillar speaks to. Empty = all species. */
    species: text("species").array().notNull().default([]),
    /** Calendar months 1-12. Empty = year-round. */
    seasonMonths: integer("season_months").array().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Tone/subject-matter guidance injected into the generation prompt. */
    voiceGuidance: text("voice_guidance").notNull().default(""),
  },
  (table) => ({
    practiceKeyUq: uniqueIndex("ext_content_pillars_practice_key_uq")
      .on(table.practiceId, table.pillarKey)
      .where(sql`${table.deletedAt} is null`),
    practiceIdx: index("ext_content_pillars_practice_idx").on(
      table.practiceId,
      table.deletedAt,
      table.isActive,
      table.sortOrder,
    ),
    pillarKeyFormatCheck: check(
      "ext_content_pillars_key_format_check",
      sql`${table.pillarKey} ~ '^[a-z][a-z0-9_]{1,62}$'`,
    ),
    sortOrderCheck: check(
      "ext_content_pillars_sort_check",
      sql`${table.sortOrder} >= 0`,
    ),
    /**
     * Season months must all fall in 1..12.
     *
     * Postgres forbids subqueries inside CHECK constraints, which rules out the
     * obvious `NOT EXISTS (SELECT 1 FROM unnest(...))`. Array containment (`<@`)
     * against a literal 1..12 array works instead.
     *
     * VERIFIED against PostgreSQL 18.4 via drizzle-kit push. The first attempt
     * used `int4range(1, 13, '[]')::int[]` and FAILED with SQLSTATE 42846
     * "cannot cast type int4range to integer[]" — that cast does not exist.
     * Do not reintroduce it.
     *
     * The router must still validate with zod:
     * `z.array(z.number().int().min(1).max(12))`.
     */
    seasonMonthsRangeCheck: check(
      "ext_content_pillars_season_months_check",
      sql`${table.seasonMonths} <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// 2J. ext_content_briefs — AI-generated content brief queue
// ---------------------------------------------------------------------------

export const extContentBriefs = pgTable(
  "ext_content_briefs",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    pillarId: uuid("pillar_id").references(() => extContentPillars.id),
    triggerEventId: uuid("trigger_event_id").references(
      () => extAutomationEvents.id,
    ),
    /** The instruction handed to the content model. */
    briefText: text("brief_text").notNull(),
    /**
     * Target surfaces. Deliberately text[] rather than ext_marketing_channel:
     * a brief fans out to several channels, and the enum currently lacks
     * youtube / newsletter / tv (see §A enum extension note).
     */
    targetChannels: text("target_channels").array().notNull().default([]),
    targetAudience: text("target_audience").notNull().default(""),
    clinicalClaims: jsonb("clinical_claims")
      .$type<ContentClinicalClaim[]>()
      .notNull()
      .default([]),
    brandVoiceOverride: text("brand_voice_override"),
    status: extContentBriefStatusEnum("status").notNull().default("pending"),
    /** Model name, mirroring ext_marketing_competitor_snapshots.model. */
    generatedBy: text("generated_by"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    /** 0..1 self-reported or validator-assigned confidence. */
    confidence: integer("confidence"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    /** Set once the brief has been turned into a publishable content item. */
    contentItemId: uuid("content_item_id").references(
      () => extMarketingContentItems.id,
    ),
    source: jsonb("source").$type<ContentBriefSource>().notNull().default({}),
  },
  (table) => ({
    reviewerTenantFk: foreignKey({
      columns: [table.practiceId, table.reviewedBy],
      foreignColumns: [users.practiceId, users.id],
      name: "ext_content_briefs_reviewer_tenant_fk",
    }),
    /** The approval queue: "what is waiting for a human". */
    practiceStatusIdx: index("ext_content_briefs_status_idx").on(
      table.practiceId,
      table.status,
      table.createdAt,
    ),
    practicePillarIdx: index("ext_content_briefs_pillar_idx").on(
      table.practiceId,
      table.pillarId,
      table.status,
    ),
    practiceDeletedIdx: index("ext_content_briefs_practice_idx").on(
      table.practiceId,
      table.deletedAt,
    ),
    /** One generated content item per brief. */
    contentItemUq: uniqueIndex("ext_content_briefs_content_item_uq")
      .on(table.practiceId, table.contentItemId)
      .where(sql`${table.contentItemId} is not null`),
    /**
     * SKILL.md §3 human-in-the-loop gate, enforced at the database level:
     * a brief carrying clinical claims cannot be 'approved' without a named
     * human reviewer and a review timestamp.
     */
    clinicalApprovalCheck: check(
      "ext_content_briefs_clinical_approval_check",
      sql`(${table.status} <> 'approved')
        or (jsonb_array_length(${table.clinicalClaims}) = 0)
        or (${table.reviewedBy} is not null and ${table.reviewedAt} is not null)`,
    ),
    reviewStateCheck: check(
      "ext_content_briefs_review_state_check",
      sql`(${table.status} in ('pending', 'generating', 'review'))
        or (${table.reviewedBy} is not null and ${table.reviewedAt} is not null)`,
    ),
    confidenceRangeCheck: check(
      "ext_content_briefs_confidence_check",
      sql`${table.confidence} is null or ${table.confidence} between 0 and 100`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const extContentPillarsRelations = relations(extContentPillars, ({ one, many }) => ({
  practice: one(practices, {
    fields: [extContentPillars.practiceId],
    references: [practices.id],
  }),
  briefs: many(extContentBriefs),
}));

export const extContentBriefsRelations = relations(extContentBriefs, ({ one }) => ({
  practice: one(practices, {
    fields: [extContentBriefs.practiceId],
    references: [practices.id],
  }),
  pillar: one(extContentPillars, {
    fields: [extContentBriefs.pillarId],
    references: [extContentPillars.id],
  }),
  triggerEvent: one(extAutomationEvents, {
    fields: [extContentBriefs.triggerEventId],
    references: [extAutomationEvents.id],
  }),
  reviewer: one(users, {
    fields: [extContentBriefs.reviewedBy],
    references: [users.id],
  }),
  contentItem: one(extMarketingContentItems, {
    fields: [extContentBriefs.contentItemId],
    references: [extMarketingContentItems.id],
  }),
}));
```

### §A.5 — `packages/db/schema/ext_channel_accounts.ts` (table 11)

OAuth connection state for the publishing surfaces. Fills gap **G12** in Agent 3's
`EVENT-ENGINE-PLAN.md`: without it there is nowhere to store the tokens the Facebook Page API,
Instagram Content Publishing API, Google Business Profile API and YouTube Data API all require.
This is the one table not requested by the Agent 2 brief; it is included because §A.12 extends the
channel enum to surfaces that cannot be reached without stored credentials.

```ts
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  index,
  uniqueIndex,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { users } from "./users";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const extChannelProviderEnum = pgEnum("ext_channel_provider", [
  "google_business",
  "facebook",
  "instagram",
  "youtube",
]);

export const extChannelAccountStatusEnum = pgEnum("ext_channel_account_status", [
  "connected",
  "expired",
  "revoked",
  "error",
]);

// ---------------------------------------------------------------------------
// Table 11 — ext_channel_accounts
// ---------------------------------------------------------------------------

/**
 * OAuth connection state for the social publishing surfaces (Pillar 1) and the
 * review inbox (Pillar 4).
 *
 * Fills gap G12 in EVENT-ENGINE-PLAN.md: without this table there is nowhere to
 * store the tokens the Facebook Page API, Instagram Content Publishing API,
 * Google Business Profile API and YouTube Data API all require.
 *
 * TOKEN HANDLING — read before implementing:
 *
 * `auth-tokens.ts` is NOT the precedent here. It stores a one-way SHA-256 hash
 * (`tokenHash`, auth-tokens.ts:L20) because those are single-use verification
 * tokens that are never read back. An OAuth access token MUST be decryptable in
 * order to call the provider, so hashing is useless for this table.
 *
 * The correct in-repo precedent is
 * `apps/web/lib/messaging/registration-crypto.ts`: AES-256-GCM, a versioned
 * `v1:<iv>:<ciphertext>:<tag>` envelope, and a base64-encoded 32-byte key read
 * from the environment. Mirror that module with a
 * `CHANNEL_ACCOUNT_ENCRYPTION_KEY` rather than inventing a second scheme.
 *
 * Tokens must never be returned over tRPC — expose only
 * { provider, displayName, status, scopesGranted, tokenExpiresAt }.
 */
export const extChannelAccounts = pgTable(
  "ext_channel_accounts",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    provider: extChannelProviderEnum("provider").notNull(),
    /** GBP location name / Facebook page id / Instagram user id / YouTube channel id. */
    externalAccountId: text("external_account_id").notNull(),
    displayName: text("display_name"),
    /** Audit: the scopes the provider actually granted, which may be fewer than asked for. */
    scopesGranted: text("scopes_granted").array().notNull().default([]),
    /** AES-256-GCM envelope. Never logged, never returned to the client. */
    encryptedAccessToken: text("encrypted_access_token"),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    tokenRefreshedAt: timestamp("token_refreshed_at", { withTimezone: true }),
    connectedBy: uuid("connected_by").references(() => users.id),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    /** Soft revoke — keeps the audit trail of a disconnected account. */
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    status: extChannelAccountStatusEnum("status")
      .notNull()
      .default("connected"),
    lastError: text("last_error"),
    /**
     * Instagram Content Publishing API enforces a rolling 24h per-account quota.
     * Snapshot only — always re-check with the provider before publishing.
     */
    publishingQuotaRemaining: integer("publishing_quota_remaining"),
    publishingQuotaFetchedAt: timestamp("publishing_quota_fetched_at", {
      withTimezone: true,
    }),
    meta: jsonb("meta").notNull().default({}),
  },
  (table) => ({
    connectorTenantFk: foreignKey({
      columns: [table.practiceId, table.connectedBy],
      foreignColumns: [users.practiceId, users.id],
      name: "ext_channel_accounts_connector_tenant_fk",
    }),
    practiceProviderAccountUq: uniqueIndex(
      "ext_channel_accounts_practice_provider_account_uq",
    )
      .on(table.practiceId, table.provider, table.externalAccountId)
      .where(sql`${table.deletedAt} is null`),
    /** "Which live accounts can we publish to right now?" */
    practiceProviderStatusIdx: index(
      "ext_channel_accounts_provider_status_idx",
    )
      .on(table.practiceId, table.provider, table.status)
      .where(sql`${table.disconnectedAt} is null and ${table.deletedAt} is null`),
    /** Token-refresh sweeper. */
    tokenExpiryIdx: index("ext_channel_accounts_token_expiry_idx")
      .on(table.tokenExpiresAt)
      .where(
        sql`${table.tokenExpiresAt} is not null and ${table.disconnectedAt} is null`,
      ),
    disconnectStateCheck: check(
      "ext_channel_accounts_disconnect_state_check",
      sql`(${table.status} = 'revoked') = (${table.disconnectedAt} is not null)`,
    ),
    quotaCheck: check(
      "ext_channel_accounts_quota_check",
      sql`${table.publishingQuotaRemaining} is null
        or ${table.publishingQuotaRemaining} >= 0`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const extChannelAccountsRelations = relations(
  extChannelAccounts,
  ({ one }) => ({
    practice: one(practices, {
      fields: [extChannelAccounts.practiceId],
      references: [practices.id],
    }),
    connectedByUser: one(users, {
      fields: [extChannelAccounts.connectedBy],
      references: [users.id],
    }),
  }),
);
```
### §A.11 — Reputation inbox: ALTER `ext_marketing_reviews` (task 2H)

`[VERIFIED: ext_marketing.ts:L126-L147]` The existing table covers ingest and reply. Every one
of the 13 fields the brief asks about is absent. All additions are **nullable**, so the ALTER is
a metadata-only change with no table rewrite and no backfill.

`ext_marketing.ts` is an `ext_*` file, so SKILL.md §1 permits editing it — this does not touch a
vanilla table.

Add these three enums next to the existing ones at `ext_marketing.ts:L25-L30`:

```ts
export const extReputationSentimentEnum = pgEnum("ext_reputation_sentiment", [
  "very_negative", "negative", "neutral", "positive", "very_positive",
]);
export const extReputationSeverityEnum = pgEnum("ext_reputation_severity", [
  "critical", "high", "medium", "low", "none",
]);
export const extReputationEscalationEnum = pgEnum("ext_reputation_escalation", [
  "none", "pending", "escalated", "resolved", "wont_fix",
]);
```

Replace the `extMarketingReviews` body (keeping all 15 existing columns untouched) with:

```ts
export const extMarketingReviews = pgTable("ext_marketing_reviews", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  patientId: uuid("patient_id").references(() => patients.id),
  clientId: uuid("client_id").references(() => clients.id),
  appointmentId: uuid("appointment_id").references(() => appointments.id),
  platform: text("platform").notNull().default("google"),
  externalReviewId: text("external_review_id"),
  rating: integer("rating"),
  reviewText: text("review_text"),
  reviewerName: text("reviewer_name"),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  replyText: text("reply_text"),
  repliedAt: timestamp("replied_at", { withTimezone: true }),
  repliedBy: uuid("replied_by").references(() => users.id),
  requestSentAt: timestamp("request_sent_at", { withTimezone: true }),
  requestBlockedReason: text("request_blocked_reason"),

  // ── Autopilot Pillar 4: reputation management (all nullable → no rewrite) ──

  /** AI sentiment classification. -100..+100, stored as an integer. */
  sentimentScore: integer("sentiment_score"),
  sentimentLabel: extReputationSentimentEnum("sentiment_label"),
  /** Model that produced the classification, for audit and re-runs. */
  sentimentModel: text("sentiment_model"),
  /** e.g. "waiting_time", "staff_attitude", "billing", "clinical_outcome", "facility". */
  topic: text("topic"),
  severity: extReputationSeverityEnum("severity").notNull().default("none"),
  /** Model self-reported confidence, 0..100. */
  classifierConfidence: integer("classifier_confidence"),

  escalationStatus: extReputationEscalationEnum("escalation_status")
    .notNull().default("none"),
  escalatedTo: uuid("escalated_to").references(() => users.id),
  escalatedAt: timestamp("escalated_at", { withTimezone: true }),
  escalationReason: text("escalation_reason"),
  /** Links to ext_marketing_staff_tasks.id for "someone must call this person". */
  internalTicketId: uuid("internal_ticket_id"),

  /** The AI-drafted reply, before a human touches it. */
  aiReplyDraft: text("ai_reply_draft"),
  responseApprovedBy: uuid("response_approved_by").references(() => users.id),
  responseApprovedAt: timestamp("response_approved_at", { withTimezone: true }),
  responsePublishedAt: timestamp("response_published_at", { withTimezone: true }),
  /** Where it was actually published — may differ from `platform`. */
  responseChannel: extMarketingChannelEnum("response_channel"),
  /** External id of the published reply, for reconciliation on the next sync. */
  responseExternalId: text("response_external_id"),

  /**
   * Whether the sympathy gate would permit any outreach about this reviewer.
   * Computed, never trusted: the send path must re-check patients.status.
   */
  isAutoPilotEligible: boolean("is_auto_pilot_eligible"),

  /** Google Places locationId / Facebook pageId the review belongs to. */
  platformAccountId: text("platform_account_id"),
  reviewUrl: text("review_url"),
  reviewerLanguage: text("reviewer_language").notNull().default("sk"),
  /** Platform's own updated timestamp — drives incremental sync. */
  externalUpdatedAt: timestamp("external_updated_at", { withTimezone: true }),
  ingestSource: text("ingest_source"), // google_api | facebook_webhook | manual | csv

  // ── Human-in-the-loop gate, DB-enforced (SKILL.md §3) ─────────────────────
}, (table) => ({
  practiceIdx: index("ext_mkt_reviews_practice_idx").on(table.practiceId, table.deletedAt),
  receivedIdx: index("ext_mkt_reviews_received_idx").on(table.practiceId, table.receivedAt),
  platformIdx: index("ext_mkt_reviews_platform_idx").on(table.practiceId, table.platform),

  // New: the reputation inbox queue.
  inboxIdx: index("ext_mkt_reviews_inbox_idx")
    .on(table.practiceId, table.escalationStatus, table.receivedAt)
    .where(sql`${table.deletedAt} is null`),
  sentimentIdx: index("ext_mkt_reviews_sentiment_idx")
    .on(table.practiceId, table.sentimentLabel, table.severity),
  /** Idempotent ingest: one row per external review per account. */
  externalUq: uniqueIndex("ext_mkt_reviews_external_uq")
    .on(table.practiceId, table.platform, table.platformAccountId, table.externalReviewId)
    .where(sql`${table.externalReviewId} is not null`),
  /** Incremental-sync cursor. */
  externalUpdatedIdx: index("ext_mkt_reviews_external_updated_idx")
    .on(table.practiceId, table.platform, table.externalUpdatedAt),
  /** A published response needs an approver and an approval time. */
  responseApprovalCheck: check(
    "ext_mkt_reviews_response_approval_check",
    sql`${table.responsePublishedAt} is null
      or (${table.responseApprovedBy} is not null and ${table.responseApprovedAt} is not null)`,
  ),
  ratingRangeCheck: check(
    "ext_mkt_reviews_rating_check",
    sql`${table.rating} is null or ${table.rating} between 1 and 5`,
  ),
  sentimentRangeCheck: check(
    "ext_mkt_reviews_sentiment_range_check",
    sql`${table.sentimentScore} is null or ${table.sentimentScore} between -100 and 100`,
  ),
}));
```

`extMarketingReviewsRelations` (`ext_marketing.ts:L213-L219`) needs two more `one()` entries:

```ts
  escalatedToUser: one(users, {
    relationName: "reviewEscalatedTo",
    fields: [extMarketingReviews.escalatedTo],
    references: [users.id],
  }),
  responseApprover: one(users, {
    relationName: "reviewResponseApprover",
    fields: [extMarketingReviews.responseApprovedBy],
    references: [users.id],
  }),
```

Both `repliedBy` and the two new user FKs point at `users`, so **`relationName` is mandatory on
all three** — Drizzle throws on ambiguous relations otherwise. The existing `repliedBy` entry at
`ext_marketing.ts:L218` must be renamed to `repliedByUser` with
`relationName: "reviewRepliedBy"`.

**Verified safe:** `[VERIFIED]` `grep -rn "query.extMarketingReviews"` returns exactly two hits —
`packages/db/seed-marketing.ts:L443` and `packages/db/seed-marketing-demo.ts:L946` — and both are
`where`-only `findMany` calls with no `with:` clause. Nothing in the repo traverses the reviews
relation graph, so renaming the *relation key* (the `repliedBy` **column** is untouched) breaks no
caller. The patched file compiles clean (see Appendix).

`internalTicketId` is left as a plain `uuid` rather than an FK to `ext_marketing_staff_tasks`,
because staff tasks are soft-deletable and a review must keep its escalation reference after the
task is resolved. Add the FK if the team prefers referential integrity over that.

### §A.12 — Channel enum extension (correction C4)

`[VERIFIED: ext_marketing.ts:L26]`
`extMarketingChannelEnum` is `["instagram", "facebook", "google_business", "sms", "email"]`.
Pillar 1's surfaces are missing. Extend in place:

```ts
export const extMarketingChannelEnum = pgEnum("ext_marketing_channel", [
  "instagram", "facebook", "google_business", "sms", "email",
  // Autopilot Pillar 1 additions:
  "youtube", "newsletter", "waiting_room_tv", "whatsapp",
]);
```

**Why extending is safe for existing code** `[VERIFIED]` — every consumer enumerates a hardcoded
literal list rather than the enum type, so unknown values cannot reach them:

- `apps/web/app/(dashboard)/agent/discharge/page.tsx:L1231` — `(["instagram", "facebook", "google_business"] as const).map(...)`
- `apps/web/app/(dashboard)/agent/imaging/page.tsx:L1398` — same pattern
- `apps/web/app/(dashboard)/marketing/plan/page.tsx:L526`, `L1254` — hardcoded `<option value=...>`
- `marketing.ts:L201, L319, L463, L592, L1745, L3430` — six `z.enum([...])` schemas with explicit literals

**The real risk is the opposite direction:** the inferred Drizzle type widens, so assigning a
row's `channel` into those narrow local unions (e.g.
`useState<"instagram" | "facebook" | "google_business">` at `discharge/page.tsx:L178`) becomes a
type error. Run `pnpm --filter @openpims/web type-check` immediately after and widen those six
zod schemas plus the two `useState` unions.

`ext_content_briefs.targetChannels` is deliberately `text[]` rather than this enum: a brief fans
out to many channels at once, and the enum is a single-value column type.

---

## §B — `packages/db/schema/index.ts` additions

`[VERIFIED: packages/db/schema/index.ts]` The file is 60 lines; the last export is
`export * from "./ext_kvepis";` at L60. Append exactly these four lines:

```ts
export * from "./ext_automation";
export * from "./ext_crm";
export * from "./ext_content_calendar";
export * from "./ext_channel_accounts";
```

**Order matters** — `ext_content_calendar.ts` and `ext_crm.ts` both import from
`./ext_automation`, and three of the four import from `./ext_marketing`. Since `export * from "./ext_marketing"`
is already at L57 (before the new lines), placing the four new exports **after** it keeps the
import graph acyclic. `ext_marketing.ts` imports none of the new files, so there is no cycle.

The resulting tail:

```ts
export * from "./ext_confirmations";
export * from "./ext_kvepis";
export * from "./ext_automation";
export * from "./ext_crm";
export * from "./ext_content_calendar";
export * from "./ext_channel_accounts";
```

No other file needs editing to expose the schema: `packages/db/package.json` maps `"."` →
`"./schema/index.ts"` `[VERIFIED: packages/db/package.json]`, so `import { extAutomationEvents }
from "@openpims/db"` works as soon as these lines land.

---

## §C — Migration order and safety notes

### §C.1 — Dependency-ordered apply sequence

The graph is a DAG; there are no circular FKs. `pnpm db:push` (`packages/db/package.json` →
`drizzle-kit push`, config at `packages/db/drizzle.config.ts`) resolves this automatically, but
the order below is what it must produce, and what to apply by hand if you use the manual path.

| Step | Object | Depends on (must exist first) | Kind |
|---|---|---|---|
| 1 | 7 new `pgEnum` types | — | `CREATE TYPE` |
| 2 | `ext_automation_events` | `practices`, `clients`, `patients`, `appointments`, `visit_closeouts`, `users` | `CREATE TABLE` |
| 3 | `ext_automation_rules` | `practices`, `users` | `CREATE TABLE` |
| 4 | `ext_automation_journeys` | `practices`, `users` | `CREATE TABLE` |
| 5 | `ext_automation_enrollments` | `practices`, `ext_automation_journeys`, `clients`, `patients`, `ext_automation_events` | `CREATE TABLE` |
| 6 | `ext_automation_step_executions` | `ext_automation_enrollments`, `communications`, `ext_marketing_message_logs`, `ext_marketing_content_items`, `ext_marketing_staff_tasks`, `care_reminders` | `CREATE TABLE` |
| 7 | `ext_automation_suppression_log` | `clients`, `patients`, `ext_automation_enrollments`, `ext_automation_rules`, `ext_automation_journeys`, `ext_automation_events` | `CREATE TABLE` |
| 8 | `ext_crm_segments` | `practices`, `users` | `CREATE TABLE` |
| 9 | `ext_crm_segment_memberships` | `ext_crm_segments`, `clients`, `users`, `ext_automation_events` | `CREATE TABLE` |
| 10 | `ext_content_pillars` | `practices` | `CREATE TABLE` |
| 11 | `ext_content_briefs` | `ext_content_pillars`, `ext_automation_events`, `users`, `ext_marketing_content_items` | `CREATE TABLE` |
| 12 | `ext_marketing_reviews` + 19 columns, 3 enums, 4 indexes, 3 checks | `users` | `ALTER TABLE` |
| 13 | `ext_marketing_channel` + 4 values | step 12 committed | `ALTER TYPE` |

**Every FK target in steps 2–11 already exists in the schema at commit `23f23a3`.** Nothing in
this design requires a vanilla table to change, so SKILL.md §1 ("Do NOT modify vanilla tables
directly") holds throughout.

### §C.2 — Index strategy rationale

| Index | Query it serves | Why this shape |
|---|---|---|
| `ext_auto_events_type_processed_idx` `(practice_id, event_type, processed_at)` | "show me processed `visit_closeout` events for this practice" | Brief-mandated. Equality → equality → range is the correct column order. |
| `ext_auto_events_practice_client_idx` `(practice_id, client_id, occurred_at)` | Per-client timeline | Brief-mandated. `occurred_at` third so the timeline is already sorted. |
| `ext_auto_events_queue_idx` `(occurred_at, id)` **partial** | The worker sweep | **The most important index in the design.** Partial on `processed_at IS NULL AND failed_at IS NULL AND deleted_at IS NULL`, so it stays tiny as the append-only log grows to millions of rows. Not practice-scoped, because one worker drains all practices. |
| `ext_auto_events_retry_idx` `(next_retry_at)` partial | Backoff retry scan | Partial on `failed_at IS NOT NULL`; only live failures are indexed. |
| `ext_auto_events_emission_uq` **partial unique** | Idempotent emission | `(practice_id, event_type, source_event_key) WHERE source_event_key IS NOT NULL`. Replaces the ad-hoc composite strings currently passed as `eventId` to `createMessagesForTrigger` (`messaging.ts:L101`), e.g. `dental_${patientId}_${Date.now()}` (`messaging.ts:L666`) — those are not stable across retries. |
| `ext_auto_rules_trigger_idx` **partial** | Rule resolution | `(practice_id, trigger_event_type, priority, id) WHERE is_active = true`. Partial because disabled rules are never scanned; `priority` before `id` so evaluation order is index-ordered. |
| `ext_auto_enroll_dedupe_uq` | One enrollment per (journey, client, event) | Makes a double-fired event a no-op instead of a duplicate journey. **This is the guard that stops a client getting the same journey twice.** |
| `ext_auto_steps_due_idx` `(scheduled_at, id)` partial | Due-step sweeper | Partial on `status = 'scheduled'`. Same shrink-as-you-go logic as the event queue. |
| `ext_auto_steps_enrollment_step_uq` | Exactly-once step execution | `(enrollment_id, step_index)` unique. Not practice-scoped — `enrollment_id` is already globally unique. |
| `ext_crm_membership_uq` **partial unique** | One membership per (segment, client) | `WHERE deleted_at IS NULL` so re-enrollment after a soft-delete works. Without this every segment count is unreliable. |
| `ext_crm_membership_client_idx` | "Which segments is this client in?" | The hot read path on every send. `is_manually_excluded` third so exclusions are filtered in-index. |
| `ext_crm_membership_expiry_idx` partial | Expiry sweeper | `WHERE expires_at IS NOT NULL`; open-ended memberships are not indexed. |
| `ext_mkt_reviews_inbox_idx` partial | Reputation queue | `(practice_id, escalation_status, received_at)`. |
| `ext_mkt_reviews_external_uq` **partial unique** | Idempotent review ingest | `(practice_id, platform, platform_account_id, external_review_id)`. `platform_account_id` is included because `external_review_id` is only unique *within* a Google location or FB page. |
| `ext_content_briefs_status_idx` | Approval queue | `(practice_id, status, created_at)` — the "what's waiting for a human" query. |

Two deliberate non-indexes: no index on `ext_automation_events.payload` (jsonb queries should be
shaped by a promoted column, not a GIN scan over an append-only log), and no index on
`ext_automation_suppression_log.detail`.

### §C.3 — `pnpm db:push` sufficiency

| Step | `db:push` sufficient? | Notes |
|---|---|---|
| 1–11 | **Yes.** | Pure additive DDL on brand-new tables. No existing row is touched, so there is nothing to backfill and no lock risk. |
| 12 | **Yes, with care.** | All 19 columns are nullable, so `ALTER TABLE ADD COLUMN` is a catalog-only change — no rewrite, no long `ACCESS EXCLUSIVE` hold. The 3 new CHECK constraints **do** require a full table validation scan; on a large `ext_marketing_reviews` that takes an `ACCESS EXCLUSIVE` lock. If the table is big, add them via `ADD CONSTRAINT ... NOT VALID` then `VALIDATE CONSTRAINT` in a second pass. |
| 13 | **Verify manually.** | See below. |

**Step 13 is the one that can bite.** `ALTER TYPE ... ADD VALUE` cannot be rolled back, and a
value added inside a transaction **cannot be used in that same transaction** (PostgreSQL ≥ 12
allows the `ADD VALUE` inside a txn, but not its use). `drizzle-kit push` batches statements, so
if it emits the `ADD VALUE` and an `INSERT`/`ALTER ... DEFAULT` using the new value in one batch,
the push fails.

Mitigation, in order of preference:
1. Ship step 13 **alone**, in its own push, before anything writes the new values.
2. Or apply it out-of-band with the repo's existing idempotent-DDL precedent
   (`packages/db/apply-marketing-migration.ts:L8-L40` uses `db.execute(sql\`... IF NOT EXISTS ...\`)`)
   — note Postgres has no `ADD VALUE IF NOT EXISTS`, so guard with a
   `pg_enum`/`pg_type` existence query first.
3. Precedent that this works in-repo: `packages/db/drizzle/0086_safe_turbo.sql:L2`,
   `0087_medical_grey_gargoyle.sql:L1`, `0088_noisy_lucky_pierre.sql:L12-L19`.

### §C.4 — What still needs a live database

Only one item remains: **the step-13 `ALTER TYPE ... ADD VALUE` batching** (§C.3). It needs a
database that already holds the `ext_marketing_channel` type, so it could not be exercised by the
fresh-database push in §C.8.

The `seasonMonths` CHECK is **no longer** in this category — it was executed and the first
formulation failed. See §C.8.

### §C.8 — Results of running `drizzle-kit push` against PostgreSQL 18.4

`[VERIFIED — executed]` A real PostgreSQL 18.4 cluster was created from the npm package
`@embedded-postgres/linux-x64` (`initdb -D … -U postgres --auth=trust -E UTF8`), then
`drizzle-kit push --force` with `drizzle-kit@^0.31.10` was run against an empty database. Three
passes were needed. This is the section that justified running it at all — **both failures were
invisible to `tsc`.**

**Pass 1 — FAILED: SQLSTATE 42846.**

```
PostgresError: cannot cast type int4range to integer[]
  severity: ERROR, code: 42846, file: parse_expr.c, routine: transformTypeCast
```

The original `ext_content_pillars_season_months_check` used
`season_months <@ int4range(1, 13, '[]')::int[]`. **That cast does not exist in PostgreSQL 18.**
An earlier revision of this document recommended exactly this expression and called it "the
standard workaround" — that was wrong, and it is why the smoke test was not optional.

Postgres forbids subqueries inside `CHECK` constraints, which rules out the obvious
`NOT EXISTS (SELECT 1 FROM unnest(season_months) …)`. The replacement is array containment against
a literal, which is immutable and accepted:

```sql
CHECK (season_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12])
```

**Pass 2 — the CHECK was accepted.** `ext_content_pillars` was created. The push then failed later:

**Pass 2 — FAILED: SQLSTATE 42830.**

```
PostgresError: there is no unique constraint matching given keys for referenced table "users"
  severity: ERROR, code: 42830, file: tablecmds.c, routine: transformFkeyCheckAttrs
```

**This is a real migration-ordering hazard and it is not specific to the new tables.** Inspecting
the half-built database showed:

- **173 tables created**, including every `ext_automation_*`, `ext_crm_*`, `ext_content_*` and
  `ext_channel_accounts` table — so all column definitions, inline CHECK constraints and
  column-level FKs are valid.
- `users` carried only `users_email_unique` and `users_pkey`. **`users_practice_id_uq` was absent.**
- **No table** had its `foreignKey({...})` extras applied — including upstream `care_reminders`,
  whose `care_reminders_creator_tenant_fk` was also missing.

Cause: `drizzle-kit push` emits all `CREATE TABLE` statements first and creates indexes in a later
phase. A composite tenant FK referencing `(practice_id, id)` therefore fails, because the unique
index it needs does not exist yet at `CREATE TABLE` time.

**Consequence for §C.7:** on an *existing* database the referenced unique indexes already exist, so
this does not bite. On an *empty* database a single `pnpm db:push` is **not** sufficient for
composite tenant FKs.

Options, in order of preference:

1. **Push twice.** The second pass finds the tables and the indexes already present and only has to
   add the FKs. *Not yet verified* — the sandbox environment was torn down before a third pass
   could confirm convergence. Treat this as the leading hypothesis, not a result.
2. **Use the repo's existing manual-DDL precedent.** `packages/db/apply-marketing-migration.ts:L8-L40`
   runs idempotent `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` / `ADD CONSTRAINT`
   via `db.execute(sql\`…\`)`. A matching `apply-automation-migration.ts` that creates the indexes
   before the FKs sidesteps the ordering entirely and is the safest route for a fresh install.
3. **Drop to plain column-level FKs** (`.references(() => users.id)`). This pushes cleanly but
   forfeits the tenant-scoped integrity that `care-reminders.ts:L57-L77` establishes as the house
   pattern — not recommended.

### §C.5 — Journal safety

`[VERIFIED]` `packages/db/drizzle/meta/_journal.json` holds 108 entries (`idx` 0–107, last tag
`0107_bouncy_human_fly`). `0052_snapshot.json` is absent **by design**:
`packages/db/baseline.ts:L48-L51` records `0052_booking_page_request_types` as
`"intentional data-only migration; it changes rows without changing schema"`, and
`apps/web/lib/__tests__/migration-journal-integrity.test.ts` enforces that every snapshotless
migration carries a documented reason plus a live data postcondition
(`snapshotlessMigrationPostconditions`, `baseline.ts:L66-L73`).

Consequences for this work:

- **`pnpm db:push` does not write to `drizzle/` or `_journal.json` at all** — it diffs the schema
  against the live database. That is exactly why SKILL.md §1 mandates it: the journal stays
  pristine. Steps 1–12 are push-safe.
- If you use `pnpm db:generate` instead, it **will** append a journal entry and a snapshot. That
  is legitimate, but it must go through `migration-journal-integrity.test.ts` — run
  `pnpm --filter @openpims/db db:migrations:check` before pushing.
- A **backfill** (copying `ext_marketing_message_logs.trigger_key` history into
  `ext_automation_events`, or migrating the 4 seeded `ext_marketing_automation_rules` rows) is a
  data-only migration. If it goes through `drizzle/`, it needs an entry in
  `snapshotlessMigrationReasons` **and** a postcondition in
  `snapshotlessMigrationPostconditions`, or the integrity test fails. The simpler route is a
  one-off script in the `apply-marketing-migration.ts` style, outside the journal.

### §C.6 — Per-table FK / dependency notes

- **`ext_automation_events`** — composite tenant FKs to `clients`, `patients`, `appointments`
  require those tables' `(practice_id, id)` unique indexes, all confirmed present
  (`clients.ts:L70`, `patients.ts:L80`, `scheduling.ts:L148`). `visit_closeouts` has **no** such
  index `[VERIFIED]`, so `visitCloseoutId` is a plain FK — cross-tenant referencing is not
  prevented by the database for that one column and must be enforced in the router.
- **`ext_automation_enrollments`** — `journeyId` must be inserted after its journey exists;
  there is no cascade, so deleting a journey with live enrollments will fail. Add
  `onDelete: "restrict"` explicitly if you want the intent stated in SQL.
- **`ext_automation_step_executions`** — `communicationId` uses a composite tenant FK
  (`communications.ts:L59` provides `communications_practice_id_uq`); `contentItemId`,
  `staffTaskId`, `messageLogId`, `careReminderId` are plain FKs because those tables declare no
  `(practice_id, id)` unique index `[VERIFIED: ext_marketing.ts:L92-L95, L240, L296-L297]`.
- **`ext_crm_segment_memberships`** — no FK to `patients`: segments are **client**-scoped by
  design (matching `ext_marketing_message_logs.clientId` being `notNull` at
  `ext_marketing.ts:L282`). Patient-level targeting lives in `condition_json`.
- **`ext_content_briefs`** — `contentItemId` is set only after generation succeeds, hence
  nullable plus a partial unique index. `reviewedBy` uses a composite tenant FK (`users.ts:L64`).

### §C.7 — Recommended landing sequence

```bash
# 1. Schema only — safe, additive, no data touched
pnpm db:push
pnpm --filter @openpims/db type-check
pnpm --filter @openpims/web type-check        # catches the widened channel union (C4)

# 2. Prove the two unchecked SQL fragments on a scratch database (§C.4)

# 3. Channel enum values — alone, before anything writes them
#    (see §C.3 mitigation 1)

# 4. Then, and only then: event emitters, then the router, then the UI
```

Do **not** land schema and emitters in the same change. An emitter writing
`ext_automation_events` before the suppression log exists would produce outreach with no audit
trail — precisely the failure mode the sympathy gate is meant to prevent.

---

## §D — Existing columns that serve double-duty with zero schema changes

This is the highest-leverage section. Roughly half the vision is already stored somewhere; the
risk is rebuilding it beside the original and ending up with two sources of truth. Every row
below was read at commit `23f23a3`.

### D.1 — Outbound messaging (Pillars 2 & 5)

| Existing object | Cite | Reuse for |
|---|---|---|
| `ext_marketing_message_logs` | `ext_marketing.ts:L278-L298` | **The outbound send ledger.** Journey `send` steps must write here, not to `communications`. Already has `scheduledFor`, `status`, `idempotencyKey` (unique), `triggerKey`, `legalBasis`, `templateKey`, `templateVersion`, `bodyRendered`. |
| `ext_marketing_message_status` enum | `ext_marketing.ts:L272-L277` | Already encodes four of the suppression outcomes: `suppressed_quiet`, `suppressed_rate`, `suppressed_no_consent`, `blocked_sympathy`. Map these to `ext_automation_suppression_log.suppression_reason` — do not reinvent them. |
| `ext_marketing_message_logs.idempotencyKey` | `ext_marketing.ts:L293` | Exactly-once send guarantee. Currently `${eventId}:${ruleKey}:${clientId}:${offsetMinutes}` (`messaging.ts:L206`). Journey steps should build the same shape from `enrollmentId` + `stepIndex`. |
| `ext_marketing_message_templates` | `ext_marketing.ts:L251-L263` | Template store, unique `(practice_id, key, language)`, with `version`, `is_active`, `legal_basis`. Journey steps reference templates by `templateKey` — no new template table. |
| `ext_sms_delivery_log` | `ext_marketing.ts:L310-L319` | **The frequency-cap source of truth.** `smsRateLimitOk()` (`apps/web/lib/marketing/sms-rate-limit.ts:L5-L21`) counts rows in a rolling window. The `frequency_cap` suppression reason **must read this table**, not a new counter, or the two limiters will disagree. |
| `ext_marketing_automation_rules` | `ext_marketing.ts:L329-L343` | Migrates into `ext_automation_rules`; `legal_basis` and `channel` map 1:1. Keep it readable until the migration is proven. |
| `ext_marketing_recall_schedules` | `ext_marketing.ts:L149-L161` | Practice-level feature toggles (`vaccinationRecallEnabled`, `postVisitReviewEnabled`, `inactiveRecallEnabled`, delay hours). These are effectively rule defaults — seed `ext_automation_rules.is_active` from them rather than adding new toggles. |

### D.2 — Consent & suppression (Pillar 2)

| Existing object | Cite | Reuse for |
|---|---|---|
| `clients.smsConsent`, `smsConsentAt`, `smsConsentSource`, `smsConsentDisclosure` | `clients.ts:L52-L60` | TCPA evidence. Already captured with disclosure text. |
| `ext_marketing_media_consents` | `ext_marketing.ts:L32-L46` | Scope-based consent incl. `marketing_messages`, with `grantedAt`/`revokedAt`. |
| `marketingConsentOk()` | `messaging.ts:L604-L640` | **Already combines both** of the above correctly. Reuse the function; do not reimplement the consent check in the new engine. |
| `patients.status` (`active\|inactive\|deceased`) | `patients.ts:L44-L48` | The sympathy gate's input. |
| `applySympathyGate()` | `messaging.ts:L467-L565` | Already: blocks queued messages, auto-dismisses open `careReminders` with the Slovak reason string, creates a condolence staff task, writes the delivery log. **Every new automated path must call it** — the new suppression log records the decision, this function performs it. |
| `SYMPATHY_BLOCKED` set | `messaging.ts:L24-L30` | `vaccine_due`, `review_request`, `thank_you`, `postop_check`, `marketing_blast`. Extend this set rather than maintaining a parallel list. |
| `isQuiet()` / `nextAllowedTime()` | `messaging.ts:L71-L99` | Quiet-hours deferral, brand-configurable. The `quiet_hours` suppression reason should be a *deferral* logged once, not a per-pass write — hence `ext_automation_suppression_log.dedupe_key`. |

### D.3 — Content & publishing (Pillar 1)

| Existing object | Cite | Reuse for |
|---|---|---|
| `ext_marketing_content_items` | `ext_marketing.ts:L76-L95` | **The terminal content store.** `status` (`proposed\|approved\|published\|blocked\|archived`), `scheduledFor`, `publishedAt`, `approvedBy`, `approvedAt`, `validatorVerdict`, `validatorFindings` (jsonb — already holds AI-validator output), `mediaAssetId`, `batchId`. `ext_content_briefs.content_item_id` points here; briefs are the *queue*, this is the *product*. |
| `ext_marketing_content_batches` | `ext_marketing.ts:L67-L74` | Week container, unique `(practice_id, week_start)`. The content calendar already has its week grid — pillars and briefs slot into it. |
| `ext_marketing_media_assets` | `ext_marketing.ts:L48-L65` | Photo/video library **with the consent gate already enforced in SQL**: `check("ext_mkt_media_consent_required", (subjects_present = false) OR (consent_id IS NOT NULL))` at L65. Pillar 1 publishing must go through this table so the constraint applies. |
| `ext_marketing_tv_slides` | `ext_marketing.ts:L97-L109` | Waiting-room TV channel target, already has `is_active`, `sort_order`, `duration_seconds`, plus a public read endpoint (`marketing.ts:L2739 getPublicTvSlides`). |
| `ext_marketing_handouts` | `ext_marketing.ts:L111-L124` | Slug-keyed, `species text[]`, `tags text[]`, `is_public`. Overlaps `ext_content_pillars` — a `dental` pillar should link to existing handouts rather than duplicating their text. |

### D.4 — Reputation (Pillar 4)

| Existing object | Cite | Reuse for |
|---|---|---|
| `ext_marketing_reviews` | `ext_marketing.ts:L126-L147` | The whole inbox (§A.11). |
| `ext_marketing_reviews.requestBlockedReason` | `ext_marketing.ts:L142` | Already records why a review request was withheld — the pre-existing half of the suppression story. Feed it into `ext_automation_suppression_log`. |
| `ext_marketing_postop_responses` | `ext_marketing.ts:L352-L362` | Inbound reply capture with `outcome: ok \| question \| concern`. `concern` is a ready-made escalation trigger for the reputation inbox. |
| `ext_marketing_operative_scripts` | `ext_marketing.ts:L374-L384` | `category: discharge_ask \| crisis \| condolence \| review_ask` — the seed corpus for AI reply drafts. |
| `ext_marketing_staff_tasks` | `ext_marketing.ts:L231-L241` | `kind: condolence \| postop_escalation \| info`, `status: open \| done`. The target of the `create_task` action; already receives condolence tasks from `applySympathyGate`. |

### D.5 — Data-entry copilot & clinical gates (Pillar 3)

| Existing object | Cite | Reuse for |
|---|---|---|
| `ext_ai_audit_log` | `packages/db/schema/ext_ai_audit_log.ts` | **Pillar 3 writes land here, not in a new audit table.** `aiAuditEntityTypeEnum` already covers `soap_note`, `discharge_report`, `imaging_analysis`, `treatment_plan`, `prescription` (L38-L44). Copy its append-only contract: "Rows MUST NOT be soft-deleted or mutated after creation" (L29-L31). The hash-chain columns (`sequenceNumber`, `previousEventHash`, `eventHash`, `canonicalizationVersion`) are the tamper-evidence pattern to follow if the event log ever needs it. |
| `ext_clinician_confirmations` | `packages/db/schema/ext_confirmations.ts:L38-L60` | The one-time, expiring, payload-bound human-in-the-loop envelope. Voice→SOAP and PDF→lab confirmation must go through `requireConfirmationEnvelopeId()` (`apps/web/server/routers/extensions/_safety.ts:L36-L54`) — a bare `clinicianConfirmed: true` is explicitly rejected. |
| `care_reminders` | `packages/db/schema/care-reminders.ts:L36-L131` | Patient-scoped internal follow-up. Its own header comment is the design rule: *"A reminder is an internal clinic task only: inserting a row never sends email or SMS"* (L28-L31). The `create_task` action should write here for patient follow-ups and to `ext_marketing_staff_tasks` for staff actions. Its `externalSource`/`externalId`/`importFingerprint` + `care_reminders_external_id_uq` partial unique index is the idempotent-ingest pattern to copy for PDF→inventory. |
| `visit_closeouts` | `visit-closeouts.ts:L114-L133` | Authoritative visit-closed record, with `clinicalFinalizedAt/By`, `completedAt/By`, `revision`, and five CHECK constraints enforcing state coherence. **The event emitter for `visit_closeout` should fire from the same transaction that sets `status = 'completed'`.** |

### D.6 — What must NOT be reused

- **`communications`** for automated sends. Its `channelEnum` is `phone|sms|email|portal`
  (`communications.ts:L19-L24`) and it is the client-facing thread store. Use
  `ext_marketing_message_logs`. Keep `communicationId` on step executions only for steps that
  genuinely create a thread.
- **`audit_log`** (`communications.ts:L143-L165`) for suppression records. It has no reason enum,
  no client index, and `practiceId` is nullable — it cannot answer "why did this client receive
  nothing?".
- **`careReminders`** for anything that sends a message. See the L28-L31 comment above.

---

## §E — Open questions for the other agents

1. **Agent 1:** supply the definitive event list. Diff it against the 28 values in
   `extAutomationEventTypeEnum` (§A.1); anything missing is a one-line `ALTER TYPE ... ADD VALUE`.
2. **Which "visit closed" signal drives which journey?** `visit_completed` (front-desk checkout,
   `appointments.ts:L1400`) vs `visit_closeout` (clinically finalized, `visit-closeouts.ts`). Both
   are in the enum; the journey definitions must choose. My recommendation: clinical follow-ups
   off `visit_closeout`, review asks off `visit_completed`.
3. **Do we retire `ext_marketing_automation_rules`?** `migratedFromKey` makes the migration
   reversible, but running both means `createMessagesForTrigger` (`messaging.ts:L155-L167`) and
   the new rules engine can disagree about whether a trigger is disabled. Someone must own the
   cutover.
4. **Frequency-cap authority.** `ext_automation_journeys.frequency_cap_*` (per-journey) vs
   `smsRateLimitOk()` over `ext_sms_delivery_log` (per-client, global). My design applies both —
   journey cap first, global cap second — but the global one wins in a conflict. Confirm that is
   the intended precedence.
5. **`conditionSql`:** confirm it may be demoted to an inert rendering (C5). If any consumer
   intends to execute it, this design needs to change.
6. **`internalTicketId` FK or not** (§A.11) — referential integrity vs. surviving staff-task
   soft-deletes.
7. **Retention.** `ext_automation_events` and `ext_automation_suppression_log` are append-only and
   will grow without bound. Suppression rows have legal value (GDPR/TCPA defence); events
   probably do not past ~12 months. Partitioning or a retention job is a separate decision and is
   **not** modelled here.

---

## §G — Reconciliation with Agent 3's `EVENT-ENGINE-PLAN.md`

Agent 3 landed on this branch (`cae5d2c`) after the first revision of this document, and its §C3
contains a Phase 2 schema sketch labelled *"Agent 2 territory — coordination required"*. The two
documents now describe the same table. Points of agreement and the two places Agent 3's plan needs
updating:

### G.1 — Adopted from Agent 3 into `ext_automation_events`

| Agent 3's sketch | Now in this design | Note |
|---|---|---|
| `status: pending \| processing \| processed \| failed \| skipped` | `extAutomationEventStatusEnum`, same five values | The Agent 2 brief only specified `processedAt`/`failedAt`; a `status` column is what makes the worker's query cheap. Both are present. |
| `processedReason` — *"the point of the whole table"* | `processedReason text` | Agreed, and now enforced: `ext_auto_events_reason_required_check` rejects `status IN ('skipped','failed')` without a reason of ≥3 chars. |
| `availableAt` | `availableAt` (renamed from `nextRetryAt`) | One column serves both initial delay and retry backoff. |
| `dedupeKey` + `UNIQUE (practiceId, type, dedupeKey)` | `dedupeKey` + `ext_auto_events_emission_uq` | Renamed from `sourceEventKey` to match. |
| `INDEX (status, availableAt) WHERE status = 'pending'` | `ext_auto_events_queue_idx` on `(status, available_at, id)` | `id` added as a tiebreaker for deterministic `FOR UPDATE SKIP LOCKED` batching. |
| `lockedAt`, `lockedBy` | unchanged | Plus `ext_auto_events_stuck_idx` for recovering claims from dead workers. |
| `source` (router procedure name) | kept as `sourceRouter` | Same field, clearer name. |

`processedReason` and `ext_automation_suppression_log` are **complementary, not redundant**: the
former answers "what did the processor decide about this event", the latter answers "what was this
client blocked from receiving, and on what legal ground". Agent 3's G5 is satisfied by both.

### G.2 — Two corrections to Agent 3's plan

**1. §F3 assumes `auth-tokens.ts` is the token-encryption precedent. It cannot be.**
`[VERIFIED: packages/db/schema/auth-tokens.ts:L20]` stores `tokenHash` — a **one-way SHA-256
digest**, because those are single-use verification tokens that are never read back. An OAuth access
token must be *decryptable* to call the provider, so hashing is useless here. The correct in-repo
precedent is `[VERIFIED: apps/web/lib/messaging/registration-crypto.ts:L1-L45]`: AES-256-GCM, a
versioned `v1:<iv>:<ciphertext>:<tag>` envelope, and a base64-encoded 32-byte key from the
environment. `ext_channel_accounts` (§A.5) is written against that module. Agent 3's own
"⚠️ NEEDS CONFIRMATION for the exact cipher/rotation helper" is now resolved — and the answer is
*not* the file it guessed.

**2. Agent 3's G3 call-site list is at a different layer than it appears.**
G3 cites `discharge.ts:619,627,634` as `createMessagesForTrigger` call sites. They are actually
calls to `schedulePostopCheckIn`, `detectAndTriggerDentalRecall` and `checkAndTriggerSeniorMilestone`
(`messaging.ts:L567`, `L643`, `L677`), which in turn call `createMessagesForTrigger` at
`messaging.ts:L596`, `L664`, `L701`. **The conclusion in G3 is unaffected** — the same six trigger
families are the only ones emitted — but a reader following those line numbers looking for
`createMessagesForTrigger` will not find it.

### G.3 — Still open between the two documents

- **Agent 3's Phase 1 ships with zero schema changes**; this document is the Phase 2 schema. If
  Phase 1 lands first, `ext_automation_events` arrives later and the Phase 1 worker must be
  refactored onto it. Worth sequencing deliberately rather than discovering it.
- **`ext_channel_accounts` is not in Agent 3's Phase 2 sketch.** It is added here (§A.5) because
  §A.12 extends the channel enum to surfaces that are unreachable without stored credentials.
- **G7 is a blocker for multi-step journeys and is not solvable in schema.**
  `[VERIFIED: apps/web/lib/marketing/sms-rate-limit.ts:L5-L21]` `smsRateLimitOk` returns
  `(count ?? 0) === 0` — it permits a send only if the client has had **zero** SMS in the window.
  A two-step journey (`thank_you` +2h, `review_request` +24h) therefore self-blocks at step 2.
  `ext_automation_journeys.frequency_cap_*` cannot fix this; `smsRateLimitOk` must become a real
  cap (allow up to N) before journeys work at all. This sharpens §E question 4.
- **G10** — `ext_marketing_message_status` (`ext_marketing.ts:L272-L277`) has no `cancelled`
  value, so journey cancellation must soft-delete until it gains one. Adding it is an
  `ALTER TYPE ... ADD VALUE` and should ride along with the §A.12 channel additions in §C.3 step 13.

---

## Appendix — Verification log

| Check | Command | Result |
|---|---|---|
| Baseline schema compiles | `npx tsc --noEmit` on unmodified `packages/db/schema/` | exit 0 |
| New schema compiles | same, + 3 new files + §B exports | **exit 0, no diagnostics** |
| §A.11 reviews ALTER compiles | same, + patched `ext_marketing.ts` (3 enums, 19 cols, 4 indexes, 3 checks, 3 user relations) | **exit 0, no diagnostics** |
| **DDL executed** | `drizzle-kit push --force` (drizzle-kit `^0.31.10`) vs PostgreSQL **18.4** from `@embedded-postgres/linux-x64` | **ran; found 2 defects** — see §C.8 |
| `seasonMonths` CHECK | first pass, `int4range(1,13,'[]')::int[]` | **FAILED — SQLSTATE 42846**; replaced with `<@ ARRAY[1..12]`, which the push accepted |
| Composite tenant FKs on an empty DB | second pass | **FAILED — SQLSTATE 42830**; 173 tables created, `users_practice_id_uq` absent. See §C.8 |
| Doc/code fidelity | extracted all 9 ```ts blocks from this file, compared to the compiled sources | 3 of 3 large blocks **byte-identical** |
| Toolchain matches repo | `drizzle-orm@^0.45.2`, `typescript@^5.5.0` per `packages/db/package.json` | ✅ |
| Compiler options match repo | copied from `packages/config/tsconfig.base.json` | ✅ |
| Reviews relation-graph blast radius | `grep -rn "query.extMarketingReviews"` → 2 hits (`seed-marketing.ts:L443`, `seed-marketing-demo.ts:L946`), both `where`-only, **no `with:`** | ✅ renaming the `repliedBy` relation key breaks nothing |
| DDL executed against Postgres | — | **NOT RUN** — no PostgreSQL in sandbox |
| `pnpm db:push` | — | **NOT RUN** — no database |
| `ALTER TYPE` batching behaviour | — | **NOT RUN** — needs a DB that already holds the type (§C.3, §C.4) |
| Second `db:push` converging past 42830 | — | **NOT RUN** — environment torn down before a third pass (§C.8 option 1) |
| `pnpm --filter @openpims/web type-check` | — | **NOT RUN** — `node_modules` not installed in the workspace checkout; §A.12 predicts it will surface errors in the six `z.enum` schemas and two `useState` unions listed there |

### What each check does and does not prove

`tsc --noEmit` exit 0 proves the Drizzle builder calls are well-typed, the `$type<>` payload
generics resolve, every `relations()` field/reference pair points at a real column, and the
`export *` graph in §B is acyclic. **It proved nothing about the SQL** — the `int4range` cast
compiled perfectly and was rejected by PostgreSQL. That is exactly why the push was run.

`drizzle-kit push` against PostgreSQL 18.4 proves the `CREATE TYPE` / `CREATE TABLE` / inline
`CHECK` / column-level FK DDL is valid, since 173 tables were created. It does **not** prove the
`foreignKey({...})` extras apply on a fresh database (they did not — §C.8), and it says nothing
about the `ALTER TYPE` step, which needs a pre-populated database.

Two caveats on the push itself: it ran against a **fresh, empty** database rather than a copy of
production data, and `--force` auto-accepted drizzle-kit's proposed statements rather than a human
reviewing them. Neither changes the two findings, both of which are DDL-level.

### Environment note

The PostgreSQL cluster, `node_modules` and scratch schema files used for these checks lived under
`/home/user/.cache/`, which is not persisted between turns and has since been torn down. The
results above were captured before that; the four schema files were reconstructed from this
document and re-verified with `tsc`. Re-running the push is a matter of re-creating that
directory — the recipe is in §C.8.

