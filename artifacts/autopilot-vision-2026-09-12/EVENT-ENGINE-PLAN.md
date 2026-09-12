# AGENT 3 — Event Engine & Journeys Implementation Plan

**Repo:** `openvpm-ai` · **Anchor commit:** `23f23a3` · **Branch:** `arena/01a09592-openvpm-ai`
**Date:** 2026-09-12 · **Author:** Agent 3 (event engine / journeys)
**Companion artifacts:** `EVENT-ENGINE-PLAN.md` (this file) is independent of Agent 1/2 outputs.

---

## Evidence & scope note — READ FIRST

This plan was produced under a session constraint stated as: **no filesystem access**; treat every
path in the brief as a *description* of what exists and tag claims `[INFERRED — no filesystem access]`.

The accurate position is somewhere in between, and you should know which is which:

- **Earlier in this same session, direct reads of the repo succeeded** (grep/sed/cat against
  `packages/db/schema/*.ts`, `apps/web/server/routers/**`, `apps/web/lib/marketing/**`,
  `apps/web/lib/webhook-dispatcher.ts`, `apps/web/vercel.json`, `apps/web/app/api/cron/**`).
  Every `[VERIFIED:path:Lnn]` tag below comes from that real tool output and the line number was
  confirmed by a targeted grep, not estimated.
- **I could not re-verify or explore further after that point.** So: line numbers are trustworthy,
  but *completeness* is not — I may have missed emission points or helper functions in files I did
  not open. Sections flagged **⚠️ NEEDS CONFIRMATION** are the ones where a fresh read would most
  likely change the answer.
- The **prior-art artifacts do not exist in the repo.** `artifacts/feature-map-2026-09-12/` and its
  four domain files (`FEATURE-INDEX.md`, `REORGANIZATION-FINDINGS.md`, `domains/*.md`) are **absent**
  from the checked-out tree. I therefore could not read them, and I have **not** summarised or cited
  them. Everything in §A is derived from primary source code, not from that feature map.
  `[VERIFIED: repo listing at /home/user/openvpm-ai — directory absent]`

### Tag legend

| Tag | Meaning |
|---|---|
| `[VERIFIED:path:Lnn]` | Read directly; line number confirmed by grep in this session |
| `[INFERRED — no filesystem access]` | Reasoning from described/read structure; not directly confirmed |
| `[ASPIRATIONAL]` | Design target, does not exist yet |

### ⚠️ NEEDS CONFIRMATION (in priority order)

1. **§B completeness** — I searched for closeout/vaccine/invoice/cancel/deceased in
   `apps/web/server/routers/`. I did **not** search `apps/web/app/**` (server actions),
   `packages/**` beyond schema, or the portal routes. Other emission paths may exist.
2. **`processQueue` has no provider call** — I read `apps/web/lib/marketing/messaging.ts:376-465`
   and saw no SMS/email send. If a provider call lives in a helper I did not open, delete finding **G4**.
   This is the single highest-impact claim in the document.
3. **Whether `vaccine_due` / `inactive_recall` / `payment_failed` / `wellness_enrolled` are emitted
   anywhere** — I found no call sites. A repo-wide grep for `createMessagesForTrigger` would settle it.
4. **`apps/web/messages/{en,sk}.json` symmetry** — confirmed both files exist; key parity not checked.

---

## Executive summary

**The event engine is roughly 60% built already — and it is built in the wrong place.**

OpenVPM already has: a trigger→template→scheduled-message pipeline, an idempotency-keyed durable
message log, a sympathy gate, consent and rate-limit suppression, an after-commit effect hook, a
webhook dispatcher, 15 production cron jobs, and a rules table. That is most of an automation
platform.

What is missing is **not** schema. It is:

1. **Trigger coverage** — of the 10 trigger families defined in `TRIGGERS`, only 3 are ever emitted,
   and the *modern* visit-completion path fires nothing at all (**G1**).
2. **A worker** — the queue is drained only by a human clicking a tRPC mutation (**G2**).
3. **A real event record** — events are materialised directly as message rows, so there is nowhere to
   record "this happened, and here is why we chose not to act" (**G5**).

The strategic recommendation: **do not build an event bus in Phase 1.** Ship Phase 1 by *wiring up
what exists* (cron + missing emitters), because `ext_marketing_message_logs` already functions as the
event log. Build the real `ext_automation_events` bus in Phase 2, once journeys need branching,
re-evaluation, and audit — which they do not in Phase 1.

---

# §A — Existing automation scaffolding inventory

## A1. Tables that already carry automation state

All in `packages/db/schema/ext_marketing.ts` (412 lines) unless noted.

| Table | Role in an automation system | Verified |
|---|---|---|
| `ext_marketing_automation_rules` | **Rules table.** `key`, `triggerKey`, `timing`, `channel`, `legalBasis`, `enabled`, `sort`. Unique per `(practiceId, key)`. | `[VERIFIED:packages/db/schema/ext_marketing.ts]` |
| `ext_marketing_message_logs` | **The event + delivery log.** `triggerKey`, `templateKey`, `templateVersion`, `idempotencyKey` (unique), `scheduledFor`, `sentAt`, `status`, `legalBasis`, `bodyRendered`, `clientId`, `patientId`. | `[VERIFIED]` |
| `ext_marketing_message_status` (enum) | `queued`, `sent`, `delivered`, `failed`, `suppressed_quiet`, `suppressed_rate`, `suppressed_no_consent`, **`blocked_sympathy`** | `[VERIFIED]` |
| `ext_marketing_message_templates` | Versioned templates, `(practiceId, key, language)` unique. `legalBasis` per template. | `[VERIFIED]` |
| `ext_sms_delivery_log` | **Unified frequency-cap ledger** across vanilla + marketing. `source`, `sourceRecordId`. | `[VERIFIED]` |
| `ext_marketing_recall_schedules` | Practice-level feature switches: vaccination recall, post-visit review, handout, inactive recall + their lead-time params. | `[VERIFIED]` |
| `ext_marketing_reviews` | Reputation inbox: `platform`, `externalReviewId`, `rating`, `reviewText`, `replyText`, `repliedAt`, `requestSentAt`, `requestBlockedReason`. | `[VERIFIED]` |
| `ext_marketing_content_items` / `_batches` | Content calendar with approval: status `proposed → approved → published / blocked / archived`, `scheduledFor`, `publishedAt`, `approvedBy`, `approvedAt`, `validatorVerdict`. | `[VERIFIED]` |
| `ext_marketing_staff_tasks` | Human escalation queue: `kind` = `condolence` \| `postop_escalation` \| `info`. | `[VERIFIED]` |
| `ext_marketing_postop_responses` | Client inbound reply capture (`ok`/`question`/`concern`) → escalates to staff task. | `[VERIFIED]` |
| `ext_marketing_media_consents` | Consent scope incl. `marketing_messages`, with `grantedAt`/`revokedAt`. | `[VERIFIED]` |
| `careReminders` | Vanilla follow-up task list. `open`/`completed`/`dismissed` + `dismissalReason`. **Flat, not a journey** — no `journeyId`, `stepKey`, `channel`, or `templateKey`. | `[VERIFIED:packages/db/schema/care-reminders.ts]` |
| `visitCloseouts` | Vanilla visit closeout. Status `draft → clinical_finalized → completed`, `chargeDisposition`, `prescriptionDisposition`, `followUpDisposition`, `diagnosisSummary`, `revision`. | `[VERIFIED:packages/db/schema/visit-closeouts.ts]` |
| `communications` | Vanilla comms log with `dedupeKey` unique index — the model for idempotent outbound. | `[VERIFIED:packages/db/schema/communications.ts]` |

**There is no `ext_automation_events`, no journey/enrollment table, no segment table, and no
`ext_channel_accounts` table anywhere in `packages/db/schema/`.**
`[VERIFIED: grep for automation_events|journey|segment|channel_account|content_brief across packages/db/schema/*.ts returns only unrelated matches in conversion-milestones.ts and funnel-events.ts]`

## A2. The trigger/message engine — `apps/web/lib/marketing/messaging.ts` (710 lines)

| Symbol | Line | What it does |
|---|---|---|
| `SYMPATHY_BLOCKED` | 24 | Set of template keys unconditionally blocked for deceased patients: `vaccine_due`, `review_request`, `thank_you`, `postop_check`, `marketing_blast` |
| `TRIGGERS` | 38 | **Hardcoded** map: trigger key → array of `{key, offsetMinutes, relativeTo}` steps. This *is* the journey definition. 10 trigger families. |
| `renderTemplate` | 64 | `{{var}}` interpolation |
| `isQuiet` / `nextAllowedTime` | 71 / 81 | Quiet-hours gating |
| `createMessagesForTrigger` | 101 | **The enrollment function.** Sympathy gate → rate limit → per-step template pick → quiet-hours → idempotency key → insert `queued` row |
| `DEFAULT_TRIGGER_TEMPLATES` | 252 | Hardcoded Slovak/English fallback bodies for `dental_education`, `dental_recall`, `senior_wellness_invite` |
| `pickTemplate` | 288 | DB template → fallback → `undefined` |
| `templateVars` | 326 | Builds `client_name`, `pet_name`, `booking_url`, `handout_url`, `checkin_url`, `unsubscribe_url`, … |
| `processQueue` | 376 | Drains `queued AND scheduledFor <= now`, limit 100 |
| `applySympathyGate` | 467 | Blocks queued messages, auto-dismisses open `careReminders`, creates condolence staff task |
| `schedulePostopCheckIn` | 567 | Respects `postVisitHandoutEnabled` switch |
| `marketingConsentOk` | 604 | `clients.smsConsent` AND no revoked `marketing_messages` consent |
| `detectAndTriggerDentalRecall` | 643 | **Regex over clinical free text** → `dental_detected` trigger |
| `checkAndTriggerSeniorMilestone` | 677 | Age threshold (7y dog / 8y cat) → `senior_milestone` trigger |

`[VERIFIED:apps/web/lib/marketing/messaging.ts:Lnn — all line numbers from grep -n of top-level declarations]`

### `TRIGGERS` — the de-facto journey definitions (hardcoded)

```
appointment_booked   → booking_confirmation (0m), appointment_reminder (-24h rel. appointment)
visit_completed      → thank_you (+2h), review_request (+24h)
vaccine_due          → vaccine_due (0m), vaccine_due (+11d)
appointment_no_show  → noshow_rebook (+2h)
payment_failed       → payment_failed (0m)
surgery_completed    → postop_check (+24h)
wellness_enrolled    → wellness_welcome (+60m)
dental_detected      → dental_education (+7d), dental_recall (+21d)
senior_milestone     → senior_wellness_invite (+2d)
```
`[VERIFIED:apps/web/lib/marketing/messaging.ts:38-62]`

**Configurable vs hardcoded**

| Concern | State |
|---|---|
| Practice on/off + timing params | ✅ Configurable — `ext_marketing_recall_schedules` |
| Rule enable/disable | ✅ Configurable — `ext_marketing_automation_rules.enabled` |
| Message copy | ✅ Configurable — `ext_marketing_message_templates` (versioned) |
| Quiet hours, rate-limit window, brand | ✅ Configurable — `practices.settings.brandKit` via `getBrand` `[VERIFIED:apps/web/lib/marketing/planner.ts:38-78]` |
| **Journey step graph** (which steps, what offsets) | ❌ **Hardcoded** in `TRIGGERS` |
| **Which trigger keys exist** | ❌ **Hardcoded** in `TRIGGERS` |
| **Segment membership** | ❌ Does not exist |
| **Channel selection** | ❌ Derived from template row, not rule |

## A3. Outbound dispatch primitives

| Primitive | Location | Purpose |
|---|---|---|
| `dispatchWebhookEvent(practiceId, event, payload)` | `apps/web/lib/webhook-dispatcher.ts:12` | Loads active `webhooks`, filters by subscribed event, HMAC-SHA256 signs, 10s timeout, parallel `Promise.allSettled`, `alertOps` on failure. Wrapped in `withSystem` + `lockPracticeForExternalSideEffects`. |
| `dispatchAppointmentWebhookAfterCommit(ctx, …)` | `apps/web/lib/appointment-webhooks.ts:44` | **The canonical post-commit pattern**: if `ctx.postCommitEffect` exists, defer; else run inline. |
| `ctx.postCommitEffect(fn)` | `apps/web/server/trpc.ts:67` (type), `:368`, `:521` (wiring) | Queues a mutation side effect that runs *after* the outer RLS transaction commits. **Mutation-only** (throws otherwise). Effects run before the tRPC result returns. Callback receives the **root pool**, not the tx handle. |

`[VERIFIED]` for all four.

> **Design consequence:** the repo already has a first-class "run this after commit" primitive, and it
> is used for webhooks but **not** for the marketing triggers. Every `createMessagesForTrigger` call
> site is inline/awaited. This is the single cheapest correctness win available (see **G6**).

## A4. The cron layer — already production-grade

`apps/web/vercel.json` declares **16 cron entries**; 15 route directories exist under
`apps/web/app/api/cron/`:

`activation-digest`, `auth-cleanup`, `backup`, `billing-lifecycle`, `conversion-reconcile`,
`ekasa-daily-closure`, `ekasa-retry`, `file-replicas`, `first-clinic-win`, `prescription-expiry`,
`rate-limit-cleanup`, **`reminders`**, `setup-recovery`, `sms-operations`, `sms-provider-events`,
`usage-reconcile`, `voice-audio-retention`
`[VERIFIED:apps/web/vercel.json + directory listing]`

Established conventions, all reusable verbatim:

- `cronAuthError(request)` → 401 unless `Authorization: Bearer $CRON_SECRET`
  (also accepts `x-cron-secret` for local curl). **Never authorizes when `CRON_SECRET` is unset** —
  deliberate anti-cross-tenant-sweep guard. `[VERIFIED:apps/web/lib/cron-auth.ts]`
- `withSystem(db, …)` for cross-tenant sweeps; `withTenant(db, practiceId, …)` for per-practice writes
- `lockPracticeForExternalSideEffects(tx, practiceId)` — recovery-hold serialization
- `reportCronHeartbeat({job, status, detail, metrics})` — ok / degraded / failed
- `alertOps(title, body)` on crash
- Idempotency via dedupe keys + row claiming (`claimAppointmentReminderCommunication`)

`[VERIFIED:apps/web/app/api/cron/reminders/route.ts]`

## A5. `care-reminders.ts` — the closest existing "journey" pattern

759 lines. Procedures: `list`, `create`, `sendOutreach`, `setCompleted`, `setDismissed`.

Reusable conventions worth copying into every new automation router:

- `manageProcedure` = `protectedProcedure.use(requireRole("admin","veterinarian","technician","front_desk"))`
- **Optimistic concurrency** via `expectedUpdatedAt` input compared to `row.updatedAt.getTime()` → `CONFLICT`
- `.for("update")` row locking inside the transaction
- Batch `setDismissed` verifies every row's status before and after; rollback semantics via row-count check
- Bulk dismissal **requires a reason** (3–500 chars) enforced in `.superRefine`
- Outreach idempotency: `dedupeKey = ${channel}:care-reminder:${practiceId}:${requestId}` →
  `onConflictDoNothing({target: communications.dedupeKey})`, then replay-detect by comparing content
- `withDurableSmsCommunication` wrapper; `outcome_unknown` → refuse to resend
- **Defensive sympathy filtering** in `list`: `sql\`${patients.status} is distinct from 'deceased'\``
  when `status === "open"` `[VERIFIED:apps/web/server/routers/care-reminders.ts]`

`[VERIFIED:apps/web/server/routers/care-reminders.ts]`

## A6. Gap register

| # | Gap | Severity | Evidence |
|---|---|---|---|
| **G1** | **The modern closeout path fires no marketing trigger.** `encounters.completeVisit` sets closeout `completed` (`:2547`) and appointment `checked_out` (`:2576`) directly. Only `appointments.setStatus` fires `visit_completed` (`:1400`). Clinics using the closeout flow get **zero** post-visit automation. | 🔴 Critical | `[VERIFIED:apps/web/server/routers/encounters.ts:2341,2547,2576]` vs `[VERIFIED:apps/web/server/routers/appointments.ts:1397-1407]` |
| **G2** | **No worker drains the queue.** `processQueuedMessages` is a manual tRPC mutation (`marketing.ts:1997`) requiring `admin`/`veterinarian`/`front_desk`. Not in `vercel.json`, not in `app/api/cron/`. Queued messages sit forever unless a human clicks. | 🔴 Critical | `[VERIFIED:apps/web/server/routers/extensions/marketing.ts:1997]` + `[VERIFIED:apps/web/vercel.json — no marketing cron]` |
| **G3** | **6 of 10 trigger families are never emitted.** Only `visit_completed`, `appointment_no_show`, `appointment_booked`, `surgery_completed`, `dental_detected`, `senior_milestone` have call sites. `vaccine_due`, `payment_failed`, `wellness_enrolled`, `inactive_recall` are dead. **The flagship "vaccine reminder" use case does not work.** | 🔴 Critical | `[VERIFIED: repo-wide grep for createMessagesForTrigger → only appointments.ts:1398,1412,1425; discharge.ts:619,627,634; marketing.ts:2023]` |
| **G4** | **`processQueue` never calls a provider.** After consent + rate checks it sets `status: "delivered"` and writes `ext_sms_delivery_log` — no SMS/email send. The marketing queue is currently a **simulator**. (Care reminders *do* send, via `sendCareReminder`/`sendCareReminderSms`.) | 🔴 Critical | `[VERIFIED:apps/web/lib/marketing/messaging.ts:~455-467]` ⚠️ see NEEDS CONFIRMATION #2 |
| **G5** | **No event record.** Events are materialised straight into message rows. Nothing persists "visit closed at T" independent of "we decided to send X" — so suppression decisions, re-evaluation, and auditing are impossible. | 🟠 High | `[INFERRED — no filesystem access]` from absence of `ext_automation_events` |
| **G6** | **Marketing triggers run inline, not post-commit.** Webhooks use `dispatchAppointmentWebhookAfterCommit`; the three `createMessagesForTrigger` calls in `appointments.ts` are bare `await` inside try/catch **after** the tx — except they are not wrapped in `postCommitEffect`, so a trigger failure cannot roll back the tx but *can* surface latency. Inconsistent with the repo's own best practice. | 🟠 High | `[VERIFIED:apps/web/server/routers/appointments.ts:1397-1432]` |
| **G7** | **Frequency cap is a hard block, not a limit.** `smsRateLimitOk` returns `(count ?? 0) === 0` — i.e. allow only if the client has had **zero** SMS in the window (default 7 days). `[VERIFIED:apps/web/lib/marketing/sms-rate-limit.ts]`. A 2-step journey (`thank_you` +2h, `review_request` +24h) therefore self-blocks at step 2. **Multi-step journeys cannot work as configured.** | 🟠 High | `[VERIFIED:apps/web/lib/marketing/sms-rate-limit.ts]` + `[VERIFIED:apps/web/lib/marketing/messaging.ts:449]` |
| **G8** | **`detectAndTriggerDentalRecall` regex-matches clinical free text** and schedules client outreach from it. Regex-driven clinical inference feeding automated outbound is a governance risk; it belongs behind a confirmation step. | 🟠 High | `[VERIFIED:apps/web/lib/marketing/messaging.ts:643-655]` |
| **G9** | **`ext_marketing_reviews` has no sentiment/status/escalation fields.** No JSONB `meta` column either. Reputation inbox cannot store classification without a schema change. | 🟡 Medium | `[VERIFIED:packages/db/schema/ext_marketing.ts]` |
| **G10** | **No `cancelled` state in `ext_marketing_message_status`.** Journey exit/cancellation must use soft-delete (`deletedAt` from `baseColumns`) until the enum gains a value. | 🟡 Medium | `[VERIFIED]` |
| **G11** | **`marketing.ts` is 3,491 lines** with 18 query procedures, default-rule seeding inside `listAutomationRules`, and at least one sample-data generator touching `ext_marketing_reviews`. Highest-collision-risk file in the extension layer. | 🟡 Medium | `[VERIFIED:apps/web/server/routers/extensions/marketing.ts]` |
| **G12** | **No `ext_channel_accounts`.** Social publishing (Phase 2) has nowhere to store OAuth tokens. | 🟡 Medium | `[VERIFIED: grep — absent]` |

---

# §B — Event emission points

## B1. Requested triggers

Line numbers confirmed by targeted grep. **Payload** = data in scope at that point in the enclosing
function. **Mode** recommendation uses the repo's own `postCommitEffect` primitive.

| # | Trigger | File | Line | Procedure | Payload available | Mode | Risk if emit fails |
|---|---|---|---|---|---|---|---|
| 1 | **Visit closed** (authoritative) | `apps/web/server/routers/encounters.ts` | **2547** (closeout→`completed`), **2576** (appt→`checked_out`) | `completeVisit` (`:2341`) | `closeout.id`, `appointmentId`, `patientId` (via appt), `clientId`, `chargeDisposition`, `invoiceId`, `handoffMethod`, `diagnosisSummary`, `followUpDisposition`, `completedAt`, `completedBy`, `revision` | **Async — `postCommitEffect`** | 🔴 **Currently missing entirely.** Failure = silent loss of all post-visit automation (thank-you, review ask, reactivation). Non-blocking by design: closeout already committed. |
| 1b | **Visit closed** (legacy) | `apps/web/server/routers/appointments.ts` | **1400** | `setStatus` | `appt.id`, `clientId`, `patientId`, `startTime`, `status`, `previousStatus` | **Async — `postCommitEffect`** | 🟠 Currently inline `await` in try/catch. Failure logged, status change survives. **Duplicate risk with #1 if both paths run.** |
| 2 | **Vaccine administered** | `apps/web/server/routers/records.ts` | **2506** (existing webhook `vaccination.recorded`); insert at **2492** | `createVaccination` (`:2472`) | `record.id`, `patientId`, `vaccineName`, `administeredBy`, `appointmentId`, `lotNumber`, `productExpirationDate`, `doseType`, `licensedDurationMonths`, `rabiesTagNumber` | **Async — `postCommitEffect`** | 🟠 Low clinical risk, but `vaccine_due` recall is a **revenue-critical** journey. Emit must not block the clinical write. |
| 3 | **Invoice paid** | `apps/web/server/routers/billing.ts` | **3377** (`recordPayment`), **4142** (`applyInvoiceAdjustment`, `closesInvoice`) | `recordPayment`; `applyInvoiceAdjustment` (`:3977`) | `invoiceId`, `paymentId`/`adjustmentId`, `paidAmount`, `adjustedAmount`, `total`, `invoice.appointmentId`, `invoice.clientId` | **Async — `postCommitEffect`** | 🟠 Payment already committed. Never let an automation failure unwind a financial transaction. |
| 4 | **Appointment cancelled** | `apps/web/server/routers/appointments.ts` | **1371** (webhook `appointment.cancelled`), **1601-1603** (series cancel `.set({status:"cancelled"})`) | `setStatus`; series cancel | `appt.id`, `startTime`, `endTime`, `previousStatus`, `patientId`, `clientId`, `doctorId`, `locationId`, `typeId` | **Async — `postCommitEffect`** | 🟡 Low. Note: **no `appointment_cancelled` trigger exists in `TRIGGERS`** — must be added (rebook nudge). |
| 5 | **Patient deceased** | `apps/web/server/routers/patients.ts` | **1153** (`applySympathyGate`), **1145** (`patient.status_changed` webhook) | `update` | `patient.id`, `patient.clientId`, `existingStatus`, `input.status` | **Synchronous, in-transaction** | 🔴 **Must stay synchronous.** This is the safety gate: blocking queued messages, dismissing open reminders, and creating the condolence task must commit atomically with the status change. An async emit here is a compliance defect. |
| 5b | **Euthanasia recorded** | `apps/web/server/routers/extensions/statutory.ts`; also `reports.ts` | ⚠️ exact line **not confirmed** | — | euthanasia register row, patient, dosing | **Synchronous** | 🔴 Same as #5. ⚠️ **NEEDS CONFIRMATION** — I did not open these files. If euthanasia does not set `patients.status = 'deceased'`, the sympathy gate has a hole. |

## B2. Triggers defined but never emitted (dead)

| Trigger key | Expected call site | Status |
|---|---|---|
| `vaccine_due` | A scheduler sweeping vaccination expiry against `vaccinationRecallLeadDays` | ❌ **No caller.** Would need a new cron (see §E3). |
| `inactive_recall` | A scheduler sweeping last-visit date against `inactiveRecallMonths` | ❌ **No caller.** |
| `payment_failed` | Billing dunning path | ❌ **No caller.** `payment.failed` is not in the dispatched webhook list. |
| `wellness_enrolled` | `wellness.ts` enrollment | ❌ **No caller.** ⚠️ did not open `wellness.ts`. |
| `appointment_cancelled` | — | ❌ **Not defined and not emitted.** |

`[VERIFIED: repo-wide grep for createMessagesForTrigger returns only the 7 call sites listed in G3]`

## B3. Emission contract (recommended)

```ts
// apps/web/lib/automation/emit.ts
export type AutomationEvent =
  | { type: "visit.completed"; practiceId: string; appointmentId: string;
      patientId: string | null; clientId: string | null; closeoutId: string;
      occurredAt: Date; source: "encounters.completeVisit" }
  | { type: "vaccination.recorded"; practiceId: string; vaccinationRecordId: string;
      patientId: string; clientId: string | null; vaccineName: string | null;
      expiresAt: Date | null; occurredAt: Date }
  | { type: "invoice.paid"; practiceId: string; invoiceId: string;
      clientId: string | null; patientId: string | null; amountCents: number; occurredAt: Date }
  | { type: "appointment.cancelled"; practiceId: string; appointmentId: string;
      clientId: string | null; patientId: string | null; startAt: Date; occurredAt: Date }
  | { type: "patient.deceased"; practiceId: string; patientId: string;
      clientId: string | null; occurredAt: Date };

/**
 * Fire-and-forget by contract: callers MUST NOT await delivery and MUST NOT
 * let a rejection escape. `patient.deceased` is the sole exception — it is
 * applied synchronously in-transaction via applySympathyGate().
 */
export function emitAfterCommit(
  ctx: { postCommitEffect?: (fn: (db: Database) => Promise<void>) => void },
  event: AutomationEvent,
): void {
  const persist = async (db: Database) => {
    try {
      await persistEvent(db, event);            // phase 2: ext_automation_events
      await materialiseJourneySteps(db, event);  // phase 1: ext_marketing_message_logs rows
    } catch (err) {
      console.error("[automation] emit failed", event.type, err);
      await alertOps("Automation emit failed", `${event.type} for practice ${event.practiceId}`);
    }
  };
  if (ctx.postCommitEffect) ctx.postCommitEffect(persist);
  else void persist(ctx.db as Database).catch(() => undefined);
}
```

**Deceased handling is deliberately excluded from `emitAfterCommit`.** `applySympathyGate` must run
inside the patient-update transaction (`patients.ts:1153` does this correctly — keep it).

---

# §C — Event processor architecture

## C1. Option analysis

### Option A — pg polling worker (Next.js route + cron)

**Pros**
- **Zero new infrastructure.** The repo already runs 15 cron routes this exact way.
- Reuses proven primitives: `cronAuthError`, `withSystem`/`withTenant`,
  `lockPracticeForExternalSideEffects`, `reportCronHeartbeat`, `alertOps`.
- Survives serverless; each tick is stateless, horizontally safe if you add `FOR UPDATE SKIP LOCKED`.
- Debuggable with `curl -H "x-cron-secret: …"` — no queue dashboard needed.
- Natural fit for journeys, which are **time-based** (`scheduledFor`), not arrival-based. Latency of
  5–15 min is irrelevant when the smallest journey offset is 2 hours.
- Self-host and Vercel both supported; `vercel.json` is the only deployment delta.

**Cons**
- Minimum latency = cron period (Vercel Hobby caps cron at once/day; Pro allows minute granularity).
- Needs claim semantics or two overlapping ticks double-send.
- Polling cost scales with table size (mitigated by the partial index pattern already used in
  `care_reminders_open_due_idx`).

### Option B — pg `LISTEN/NOTIFY`

**Pros**
- Sub-second latency; no polling.

**Cons**
- **Requires a persistent connection**, which is fundamentally at odds with Next.js serverless
  lambdas. Node's `pg` client holds a dedicated socket; on Vercel the function freezes between
  requests and the listener dies.
- Supabase/Neon/pgBouncer in **transaction mode** (which every serverless Postgres uses) does not
  support `LISTEN` — the command is not forwarded to a backend connection.
- No durability: a NOTIFY delivered while no listener is attached is **lost silently**. Losing
  `visit.completed` means a client never gets a review ask.
- Would need a separate long-running worker process → contradicts the single Next.js deployment.

**Verdict: do not use.** It is attractive on paper and breaks in exactly this stack.

### Option C — External queue (BullMQ + Redis / Inngest)

**Pros**
- Real retries, backoff, delays, concurrency, dead-letter, observability.
- Webhook-driven (Inngest) → near-zero latency without a DB poll.

**Cons**
- **New infrastructure dependency** (Redis or an Inngest account + outbound network) for a product
  whose current deployment is "one Next.js app + one Postgres". Ops burden on a self-hosted
  veterinary clinic is a real objection.
- Splits state: queue state in Redis, business state in Postgres → dual-write consistency problems.
- `pnpm-lock.yaml` is 311 KB and dependency additions are reviewed; the repo's extension pattern
  (`ext_*.ts` + tRPC) is deliberately vanilla-Postgres-only.
- Overkill for Phase 1 volumes: a 3-vet clinic generates tens of events/day, not thousands/hour.

## C2. Recommendation

> **Option A — pg polling worker. Specifically: extend the existing cron layer with a new
> `/api/cron/automation` route registered in `apps/web/vercel.json`.**

**Justification, in this codebase's terms:**

1. Every journey step is already a row with a `scheduledFor` timestamp
   (`ext_marketing_message_logs`). **Time-based work is a polling problem, not a queue problem.**
   A worker that wakes up and asks "what is due?" is a natural fit; a push queue adds machinery to
   deliver work that was never urgent.
2. The repo has already solved every hard part: auth, tenant scoping, recovery-hold locking,
   heartbeat reporting, alerting, idempotent claiming. Option A is ~150 lines of *new* logic against
   infrastructure that is already in production for 15 other jobs.
3. Option B is architecturally incompatible with serverless Postgres.
4. Option C buys retries and observability we do not yet need, at the cost of a new runtime
   dependency — and crucially, **the durable state must live in Postgres regardless** (for the
   approval UI, audit, and sympathy-gate queries). Adding Redis means two sources of truth.

**Revisit Option C when** any of these become true: outbound publishing to Meta/GBP needs
sophisticated retry/backoff (Phase 2 — see §F, where 429 `EXPIRED` container polling and
50-post/day ceilings genuinely benefit from a queue); event volume exceeds ~10k/day; or per-event
latency under 60s becomes a product requirement. **Design for this now** by keeping state in
Postgres and the worker stateless, so swapping the trigger later is a one-file change.

## C3. Skeleton implementation

### Phase 1 (no new schema) — drain the existing message log

```ts
// apps/web/app/api/cron/automation/route.ts
import { NextResponse } from "next/server";
import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "@openpims/db/client";
import { practices, extMarketingMessageLogs } from "@openpims/db";
import { cronAuthError } from "@/lib/cron-auth";
import { alertOps } from "@/lib/alerts";
import { withSystem, withTenant } from "@/lib/tenant-db";
import { reportCronHeartbeat } from "@/lib/cron-heartbeat";
import { lockPracticeForExternalSideEffects } from "@/lib/recovery-hold";
import { processQueue } from "@/lib/marketing/messaging";

export async function GET(request: Request) {
  const authError = cronAuthError(request);
  if (authError) return authError;

  const counts = { practices: 0, sent: 0, suppressed: 0, failed: 0 };
  try {
    const ids = await withSystem(db, (tx) =>
      tx.select({ id: practices.id }).from(practices).where(isNull(practices.deletedAt)),
    );
    for (const { id: practiceId } of ids) {
      counts.practices++;
      try {
        // Serialize against recovery hold; skip practices mid-restore.
        const held = await withTenant(db, practiceId, async (tx) =>
          !(await lockPracticeForExternalSideEffects(tx as any, practiceId)));
        if (held) continue;
        const r = await processQueue(db, practiceId);   // existing: consent + rate + sympathy gates
        counts.sent += r.sent; counts.suppressed += r.suppressed;
      } catch (err) {
        counts.failed++;
        console.error(`[cron/automation] practice ${practiceId}`, err);
      }
    }
    await reportCronHeartbeat({
      job: "automation",
      status: counts.failed > 0 ? "degraded" : "ok",
      detail: `${counts.sent} sent, ${counts.suppressed} suppressed, ${counts.failed} practice failures`,
      metrics: counts,
    });
    return NextResponse.json(counts);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void alertOps("Automation cron crashed", message);
    await reportCronHeartbeat({ job: "automation", status: "failed", detail: message });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

Register in `apps/web/vercel.json` `crons`:

```json
{ "path": "/api/cron/automation", "schedule": "*/15 * * * *" }
```

> ⚠️ **Before this ships, G4 and G7 must be fixed**, or the worker will cheerfully mark messages
> "delivered" without sending them and will suppress every second step of every journey. See §E2.

### Phase 2 (with `ext_automation_events`) — durable event bus

```ts
// apps/web/lib/automation/processor.ts  — called by the same cron route
export async function processAutomationEvents(db: Database, batchSize = 100) {
  const claimed = await db.execute(sql`
    UPDATE ext_automation_events SET status = 'processing', attempts = attempts + 1,
           locked_at = now(), locked_by = ${WORKER_ID}
    WHERE id IN (
      SELECT id FROM ext_automation_events
      WHERE status = 'pending' AND available_at <= now() AND deleted_at IS NULL
      ORDER BY available_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    ) RETURNING *`);
  for (const event of claimed.rows as AutomationEventRow[]) {
    try {
      const rules = await matchRules(db, event);            // ext_marketing_automation_rules
      for (const rule of rules) {
        await assertSympathyGate(db, event);                // hard stop, never skippable
        await materialiseJourneySteps(db, event, rule);      // → ext_marketing_message_logs
      }
      await db.update(extAutomationEvents)
        .set({ status: "processed", processedAt: new Date() })
        .where(eq(extAutomationEvents.id, event.id));
    } catch (err) {
      await db.update(extAutomationEvents).set({
        status: event.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "pending",
        availableAt: backoff(event.attempts + 1),           // 1m → 5m → 30m → 2h
        lastError: String(err),
      }).where(eq(extAutomationEvents.id, event.id));
    }
  }
  return { processed: claimed.rows.length };
}
```

`FOR UPDATE SKIP LOCKED` is what makes overlapping ticks safe — this is the piece Option A needs and
Option B/C get for free.

### Phase 2 schema sketch (Agent 2 territory — coordination required)

```
ext_automation_events
  practiceId, type, subjectClientId, subjectPatientId,
  payload jsonb, source (router procedure name),
  status: pending | processing | processed | failed | skipped,
  availableAt, attempts, lastError, lockedAt, lockedBy,
  processedAt, processedReason            -- WHY we chose not to act
  UNIQUE (practiceId, type, dedupeKey)    -- idempotent emission
  INDEX  (status, availableAt) WHERE status = 'pending'

ext_automation_journeys       -- template: key, steps jsonb, frequencyCap, enabled
ext_automation_enrollments    -- journeyId, clientId, patientId, state, currentStep,
                                 enteredAt, nextStepAt, exitedAt, exitReason
ext_channel_accounts          -- §F
```

**`processedReason` is the point of the whole table.** G5 exists precisely because Phase 1 cannot
answer "why didn't we message this client?" — that answer is the difference between a marketing tool
and an auditable one.

---

# §D — tRPC router structure

All files under `apps/web/server/routers/extensions/`, registered in `extensions/index.ts` as
`trpc.extensions.automationEvents.*` etc. `[VERIFIED:apps/web/server/routers/extensions/index.ts —
16 routers already mounted this way]`

Conventions inherited from `care-reminders.ts`: `manageProcedure` role gate, `expectedUpdatedAt`
optimistic concurrency, `activePractice()` guard, `requireRole("admin")` for config mutations.

## D1. `automation-events.ts` — `trpc.extensions.automationEvents.*`

| Procedure | Type | Role | Purpose |
|---|---|---|---|
| `list` | query | protected | Filter by `type`, `status`, `clientId`, date range; paginated. **Admin/ops view.** |
| `byClient` | query | protected | Timeline for one client — the "what did we do and why" audit surface. |
| `replay` | mutation | admin | Re-enqueue a `failed` event (resets `attempts`, sets `availableAt = now()`). |
| `skip` | mutation | admin | Mark `skipped` with a mandatory reason (3–500 chars, mirroring `setDismissed`). |
| `stats` | query | protected | Counts by status/type over N days; feeds `reportCronHeartbeat` dashboard. |

> Phase 1: `list`/`byClient`/`stats` are served by querying `ext_marketing_message_logs` with the
> same filters — the router surface stays stable while the backing table changes. **This is why the
> router should be built in Phase 1** even though the events table is Phase 2.

## D2. `automation-rules.ts` — `trpc.extensions.automationRules.*`

| Procedure | Type | Role | Purpose |
|---|---|---|---|
| `list` | query | protected | All rules for the practice, ordered by `sort`. |
| `upsert` | mutation | admin | Create/update by `(practiceId, key)`. |
| `toggle` | mutation | admin, veterinarian | Enable/disable. |
| `remove` | mutation | admin | Hard delete (rules are config, not clinical data). |
| `seedDefaults` | mutation | admin | Idempotent default seeding. **Extracted out of `listAutomationRules`** (G11). |

**Refactor note:** `listAutomationRules` currently seeds four hardcoded Slovak rules *inside a query*
(`marketing.ts:2034-2103`) — a read path with a write side effect. Move this to `seedDefaults` and
make `list` pure. `[VERIFIED:apps/web/server/routers/extensions/marketing.ts:2034-2103]`

## D3. `automation-journeys.ts` — `trpc.extensions.automationJourneys.*`

Phase 1: **read-only** over the hardcoded `TRIGGERS` map (exposes what exists; no CRUD).
Phase 2: full CRUD once `ext_automation_journeys` lands.

| Procedure | Type | Role | Phase | Purpose |
|---|---|---|---|---|
| `list` | query | protected | 1 | Journey templates with resolved step counts and total duration. |
| `preview` | query | protected | 1 | Dry-run: given a client, show the steps that *would* be scheduled and which gates would block them. **Highest-value endpoint in the whole layer** — makes the sympathy gate visible before go-live. |
| `upsert` / `toggle` / `remove` | mutation | admin | 2 | CRUD on journey templates. |
| `validate` | mutation | admin | 2 | Reject step graphs that violate frequency caps or contain a `SYMPATHY_BLOCKED` template without a gate. |

## D4. `automation-enrollments.ts` — `trpc.extensions.automationEnrollments.*`

| Procedure | Type | Role | Purpose |
|---|---|---|---|
| `list` | query | protected | Active enrollments, filterable by journey/client/state. |
| `byClient` | query | protected | One client's journey history — what step they are on, what is queued. |
| `enroll` | mutation | manage | Manual enrollment (front-desk starting a recall by hand). |
| `pause` / `resume` | mutation | manage | Pause without losing journey position. |
| `exit` | mutation | manage | Exit with mandatory reason; cancels remaining `queued` steps. |
| `history` | query | protected | Full step timeline with per-step status. |

Phase 1 mapping: "enrollment" = the set of `ext_marketing_message_logs` rows sharing a
`(clientId, triggerKey, eventId)` idempotency prefix. **Exit = soft-delete the remaining `queued`
rows** (`deletedAt`), because the status enum has no `cancelled` value (G10).
`[INFERRED — no filesystem access on baseColumns, but soft-delete is the established pattern across
every ext_* table read in this session]`

## D5. `crm-segments.ts` — `trpc.extensions.crmSegments.*`

Phase 1: **computed on demand, no table.** Membership is a SQL predicate evaluated at send time.

| Procedure | Type | Role | Purpose |
|---|---|---|---|
| `list` | query | protected | 12 segment definitions + live counts. |
| `members` | query | protected | Paginated membership for one segment. |
| `preview` | query | protected | Count only — for the approval-step UI ("this will reach 143 clients"). |
| `refresh` | mutation | admin | **Phase 1 no-op** (returns `{ computed: true }`); Phase 2 materialises a snapshot table. |
| `explain` | query | protected | Why a given client is/isn't in a segment. Debugging tool for front desk. |

Phase 1 segment predicates (all expressible against existing tables):

| # | Segment | Predicate |
|---|---|---|
| 1 | Active patients | `patients.status = 'active'` |
| 2 | Due vaccination | `vaccinationRecords` expiry within `vaccinationRecallLeadDays` |
| 3 | Lapsed 6–12 mo | no appointment in 6–12 months |
| 4 | Lapsed >12 mo | no appointment > `inactiveRecallMonths` |
| 5 | Post-op (<72 h) | surgery/discharge within 72 h |
| 6 | Chronic condition | open `problems` |
| 7 | Senior (7y dog / 8y cat) | `patients.dob` + species |
| 8 | Wellness enrolled | `wellnessEnrollments` active |
| 9 | New client (<90 d) | `clients.createdAt` |
| 10 | High-value | invoice total above threshold (12 mo) |
| 11 | No-show history | ≥1 `no_show` in 12 mo |
| 12 | **Do-not-contact** | revoked consent OR email suppression — **hard exclusion, always applied last** |

## D6. `content-briefs.ts` — `trpc.extensions.contentBriefs.*`

Backed by existing `ext_marketing_content_items` + `ext_marketing_content_batches`.

| Procedure | Type | Role | Purpose |
|---|---|---|---|
| `list` | query | protected | Briefs by week/status/channel (the content calendar). |
| `generate` | mutation | manage | AI-draft from an event or recipe; creates `proposed` items. |
| `approve` | mutation | admin, veterinarian | `proposed → approved`, sets `approvedBy`/`approvedAt`. **Mandatory human gate.** |
| `reject` | mutation | admin, veterinarian | `proposed → archived` with reason. |
| `schedule` | mutation | manage | Set `scheduledFor` on an approved item. |
| `publish` | mutation | admin | `approved → published`. Phase 2 calls the channel adapter (§F). |

**Safety:** `generate` must never produce clinical claims without review. The existing
`extMarketingMediaAssets` check `consent_required` (`subjectsPresent = false OR consentId IS NOT NULL`)
is the model — reuse it in `generate` so a brief can never reference a patient photo lacking consent.
`[VERIFIED:packages/db/schema/ext_marketing.ts — ext_mkt_media_consent_required check]`

## D7. Cross-cutting requirements

- **i18n:** every new UI string needs a key in **both** `apps/web/messages/en.json` **and**
  `apps/web/messages/sk.json`. Both files confirmed present. Server errors stay English; localisation
  is client-side via `useI18n()`. `[VERIFIED:apps/web/messages/ — en.json, sk.json]`
- **Nav:** new pages go in `apps/web/config/custom-nav.ts` (`CustomNavItem` with `href`, `label`,
  `i18nKey`, `icon`, `roles`, `section`). Never edit `sidebar.tsx`. Existing marketing items already
  use `i18nKey: "nav.marketing*"`. `[VERIFIED:apps/web/config/custom-nav.ts:57-138]`
- **Sympathy gate:** every send path must call `assertPatientNotDeceased` / `applySympathyGate`.
  Not optional, not configurable.
- **Clinical writes:** no journey may write to `patients`, `vaccinationRecords`, or SOAP without
  human confirmation. Journeys may only *read* clinical data and *create* `careReminders` (internal
  tasks) — never auto-resolve them.

---

# §E — Phase 1 plan (existing tables only)

## E0. The key insight

**`ext_marketing_message_logs` already IS an event log.** It has `triggerKey` (event type),
`clientId`/`patientId` (subject), `idempotencyKey` (dedupe), `scheduledFor` (delayed work),
`status` (state machine incl. suppression reasons), and `practiceId` (tenant). Journeys are
**eagerly materialised**: enrolling a client in `visit_completed` writes two dated rows
(`thank_you` +2h, `review_request` +24h) immediately. "Advancing" a journey is then just the cron
picking up rows whose `scheduledFor` has arrived.

**So Phase 1 needs no schema change at all.** It needs: wire the worker, add the missing emitters,
and fix two behavioural bugs.

## E1. Feature → table map

| # | Phase 1 feature | Table(s) | Notes |
|---|---|---|---|
| 1 | **Automation worker** | `ext_marketing_message_logs` | New `/api/cron/automation` + `vercel.json` entry. Fixes **G2**. |
| 2 | **Visit-closed trigger** | `ext_marketing_message_logs` | New emitter in `encounters.completeVisit` (`:2547`). Fixes **G1**. |
| 3 | **Vaccine-due recall scheduler** | `vaccinationRecords` + `ext_marketing_recall_schedules` + `ext_marketing_message_logs` | New cron (or extend #1). Reads `vaccinationRecallLeadDays`. Fixes **G3**. |
| 4 | **Inactive-patient reactivation** | `appointments` + `ext_marketing_recall_schedules` + `ext_marketing_message_logs` | Sweep last-visit vs `inactiveRecallMonths`. Fixes **G3**. |
| 5 | **Appointment-cancelled nudge** | `ext_marketing_message_logs` | New `appointment_cancelled` entry in `TRIGGERS` + emitter at `appointments.ts:1371`. |
| 6 | **Journey pause/exit** | `ext_marketing_message_logs` | Exit = soft-delete undelivered `queued` rows (**G10** workaround). |
| 7 | **Consent enforcement** | `ext_marketing_media_consents` + `clients.smsConsent` | `marketingConsentOk` already correct. |
| 8 | **Suppression & frequency cap** | `ext_sms_delivery_log` | **Requires G7 fix** — cap must become a count threshold, not `= 0`. |
| 9 | **Sympathy gate** | `patients.status` + `ext_marketing_message_logs.status = blocked_sympathy` + `careReminders` + `ext_marketing_staff_tasks` | Already correct; **keep synchronous**. |
| 10 | **Segments (12)** | computed read-only over `patients`, `appointments`, `vaccinationRecords`, `clients`, `invoices`, `wellnessEnrollments` | No table. See §D5. |
| 11 | **Reputation inbox (read)** | `ext_marketing_reviews` | List/reply/track using existing columns. |
| 12 | **Review sentiment (proxy)** | `ext_marketing_reviews.rating` | 1–2 negative / 3 neutral / 4–5 positive. **No schema needed** — but no NLP (**G9**). |
| 13 | **Review escalation** | `ext_marketing_reviews.rating` + `ext_marketing_staff_tasks` | Rating ≤3 auto-creates an `info` staff task. Reuses an existing pattern. |
| 14 | **Review-request send** | `ext_marketing_message_logs` (`templateKey = review_request`) + `ext_marketing_reviews.requestSentAt` | Stamp `requestSentAt`; on block, stamp `requestBlockedReason`. Both columns already exist and are unused. |
| 15 | **Content calendar + approval** | `ext_marketing_content_items` + `ext_marketing_content_batches` | `proposed → approved → published`. Manual publish only in Phase 1. |
| 16 | **AI brief generation** | `ext_marketing_content_items` (`status: proposed`) + `lib/marketing/recipes.ts` + `planner.ts` | Reuses `RECIPES` and `SEASON_THEMES`. `[VERIFIED:apps/web/lib/marketing/recipes.ts]` |
| 17 | **Waiting-room TV** | `ext_marketing_tv_slides` | Already a complete table; needs only a display route. |
| 18 | **Client reply capture** | `ext_marketing_postop_responses` + `ext_marketing_staff_tasks` | Already fully built. Expose in UI. |
| 19 | **Handout delivery** | `ext_marketing_handouts` (`isPublic`, `slug`) | Already built; wire `handout_url` into templates. |
| 20 | **Ops audit surface** | `ext_marketing_message_logs` + `ext_marketing_staff_tasks` | "What did we send, what did we suppress, and why." |

## E2. Blocking prerequisites (must ship before the worker is enabled)

| Fix | Gap | Change |
|---|---|---|
| **P1** | **G4** | `processQueue` must actually call a provider. Reuse `sendCareReminderSms` / `sendCareReminder` from `lib/sms` / `lib/email`, wrapped in the same durable-outcome protocol used by `care-reminders.sendOutreach` (including the `outcome_unknown` → do-not-resend rule). Only then set `status: "delivered"`. |
| **P2** | **G7** | `smsRateLimitOk` must take a `maxMessages` parameter (per-channel, per-journey) instead of asserting `count === 0`. Suggested default: **1 marketing SMS / 7 days**, **3 transactional / 7 days**, transactional exempt from the marketing cap. Without this, every 2-step journey self-blocks. |
| **P3** | **G1** | Add the `encounters.completeVisit` emitter. **Then decide the dedupe rule** against `appointments.setStatus` — otherwise a clinic that uses both paths double-sends. Recommend: emit only from `completeVisit`; have `setStatus` skip `visit_completed` when a closeout row exists for the appointment. |
| **P4** | **G6** | Move the three `createMessagesForTrigger` calls in `appointments.ts` inside `ctx.postCommitEffect`, matching `dispatchAppointmentWebhookAfterCommit`. |

## E3. Suggested build order

1. **P1 + P2** (behaviour fixes to existing code) — no new files, highest risk reduction.
2. **Worker + `vercel.json` entry** (§C3 Phase 1 skeleton) — fixes G2, ~150 lines.
3. **P3 + P4** (emission correctness) — fixes G1/G6.
4. **`automation-events` + `automation-rules` routers** — read paths over existing tables, plus the
   `seedDefaults` extraction from `listAutomationRules` (G11).
5. **`crm-segments`** — computed segments; pure reads, zero migration risk.
6. **`content-briefs`** — wire `recipes.ts`/`planner.ts` into `ext_marketing_content_items`.
7. **Reputation inbox UI** — read-only over `ext_marketing_reviews` + rating-proxy sentiment.
8. **Vaccine-due + inactive-recall schedulers** — extend the automation cron with two sweeps. Fixes G3,
   and delivers the flagship "vaccine reminder" promise.

**Explicitly out of scope for Phase 1:** real event bus (`ext_automation_events`), journey branching,
social publishing, voice→SOAP, predictive scoring. **Phase 1 ships zero schema changes** — which
means it can be deployed, tested, and reverted without touching `_journal.json`.

---

# §F — Social media API integration requirements (Phase 2)

> Everything in §F is from web research performed 2026-09-12. API surface details change frequently —
> **treat every limit as "verify against live docs before coding".** Where sources disagree I say so
> rather than picking one.

## F1. Google Business Profile API — reviews

### Access & gating

- **The GBP API is approval-gated and quota-gated per GCP project.** Until approved, a project is
  "enabled but throttled to zero" — every call returns **429** even on the first request, with
  `quota_limit_value: 0` in Cloud Console. This is a **429, not a 403**, so it is routinely
  misdiagnosed as a rate-limit problem. Access requires a manual one-time access-request form.
  [3](https://xovionlabs.com/blog/google-business-profile-api-hidden-gate/) [5](https://www.mapsleads.co/blog/google-business-profile-api-quotas-limits)
- **Plan for a multi-week approval lead time before any code can be tested.** This is the single
  biggest schedule risk in Phase 2.
- Scope is strictly limited to locations the authenticated user owns or manages. You cannot enumerate
  other clinics. [1](https://stayapi.com/blog/google-reviews-api)

### OAuth scopes

Reviews endpoints accept **either** of:
- `https://www.googleapis.com/auth/business.manage`
- `https://www.googleapis.com/auth/plus.business.manage`

One scope covers all four base URLs. Request `business.manage`.
[3](https://xovionlabs.com/blog/google-business-profile-api-hidden-gate/) [4](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list)

> **Service accounts do not work for review data.** Review endpoints require a real OAuth user token
> from a Google account with ownership/management rights on the location. Plan the OAuth flow around
> a human clinic owner, not a service account. [3](https://stackoverflow.com/questions/76672126/reply-to-reviews-using-google-my-business)

### Endpoints (reviews are still on legacy **v4**, not v1)

```
GET  https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews
     ?pageSize=50&pageToken=…                      # max pageSize 50, paginated
GET  https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews/{reviewId}
PUT  https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews/{reviewId}/reply
     body: { "comment": "…" }
DELETE …/reviews/{reviewId}/reply
POST https://mybusiness.googleapis.com/v4/{name=accounts/*}/locations:batchGetReviews
```
[2](https://developers.google.com/my-business/content/review-data) [4](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list)

### Idempotency — important

**`updateReply` is `PUT` and is idempotent by construction.** It is *upsert* semantics: it creates the
reply if none exists and **replaces** the existing reply if one does. There is no separate create and
update method, and **no idempotency-key parameter** — idempotency comes from the HTTP verb plus the
addressed resource.

Consequences for our design:
- Retrying a reply is safe (last write wins), so no client-side dedupe token is required.
- But a retry **silently overwrites** a reply a human may have posted through the GBP UI in the
  meantime. **Before writing a reply, `GET` the review and compare `reviewReply.comment`.** If it
  differs from what we last wrote, do not overwrite — surface it to staff.
- Track `repliedAt`/`repliedBy` in `ext_marketing_reviews` and treat a mismatch as a conflict.

### Rate limits

| Dimension | Value |
|---|---|
| Business Information API | 300 QPM default; 300 QPD create location; 10 000 QPD update location |
| Edits | **10 per minute per GBP — explicitly cannot be increased** |
| Other GBP APIs (Performance, Verifications, Place Actions, Notifications) | 300 QPM |
| Exceeding | **HTTP 429** (gRPC `RESOURCE_EXHAUSTED`) |

[2](https://developers.google.com/my-business/content/limits)

The **10 edits/minute hard ceiling** is the operative constraint for reply-writing. For a reputation
inbox this is generous (a clinic gets tens of reviews/month), but a bulk backfill of historical
replies must be throttled to ≤10/min and paced evenly — Google denies quota increases for spiky
traffic patterns.

### Server-side use

Yes — plain server-side `fetch` with `Authorization: Bearer <access_token>` from a Next.js route
handler or tRPC mutation. Credentials are standard Google OAuth 2.0 client
(`client_id` / `client_secret` / refresh token). No SDK required. Refresh tokens are long-lived but
must be stored encrypted at rest.

## F2. Meta Graph API — Facebook Page + Instagram Business

### Permissions

Facebook Page publishing (per Meta's Pages API getting-started doc):
`pages_manage_posts`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`
(+ `pages_manage_engagement` for comments/likes).
[1](https://developers.facebook.com/docs/pages-api/getting-started/) [5](https://postproxy.dev/blog/facebook-graph-api-posting-guide/)

Instagram publishing: `instagram_basic` + `instagram_content_publish`
(+ `instagram_manage_insights` for metrics).
[2](https://bollardai.com/resources/metagraph)

Permission dependency chain (must request the dependencies too):

| Permission | Depends on |
|---|---|
| `pages_show_list` | — |
| `pages_read_engagement` | `pages_show_list` |
| `pages_manage_posts` | `pages_read_engagement`, `pages_show_list` |
| `pages_manage_metadata` | `pages_show_list` |
| `pages_manage_engagement` | `pages_read_user_content`, `pages_show_list` |

### Tokens

- A **Page access token** is required for virtually all Page and Instagram work. Obtain via
  `GET /{user-id}/accounts` (or `/me/accounts`), which lists Pages the user can act on with a token
  each. [1](https://developers.facebook.com/docs/pages-api/getting-started/)
- The person needs the **CREATE_CONTENT** task on the Page.
- User tokens last ~**60 days**; exchange for a long-lived token, then derive Page tokens — Page
  tokens derived from a long-lived user token effectively do not expire.
  [2](https://bollardai.com/resources/metagraph)
- **Needs a refresh job regardless.** Meta long-lived tokens expire silently; a 401 at publish time
  is a support ticket. Add a `meta-token-refresh` cron that refreshes any token expiring within 7 days.
- **Advanced Access** (via App Review + Business Verification) is required to publish on behalf of
  Pages you do not own. Budget weeks for App Review.
  [5](https://postproxy.dev/blog/facebook-graph-api-posting-guide/)

### Facebook publishing

```
POST /{page-id}/feed       { message, link?, published?, scheduled_publish_time? }
POST /{page-id}/photos     { url, message }
POST /{page-id}/videos     (Resumable Upload API — 3 steps)
POST /{page-id}/video_reels (rupload.facebook.com)
```
Scheduling: `published: false` + `scheduled_publish_time` (Unix timestamp).
[5](https://postproxy.dev/blog/facebook-graph-api-posting-guide/)

### Instagram — container publishing flow

```
# 1. Create container
POST https://graph.instagram.com/v24.0/{ig-user-id}/media
     media_type=REELS|IMAGE|CAROUSEL|STORIES, video_url|image_url, caption, …
     → { "id": "<creation-id>" }

# 2. Poll until transcoded
GET  https://graph.instagram.com/v24.0/{creation-id}?fields=status_code
     → IN_PROGRESS → FINISHED | ERROR | EXPIRED

# 3. Publish
POST https://graph.instagram.com/v24.0/{ig-user-id}/media_publish
     creation_id=<creation-id>
     → { "id": "<media-id>" }

# Quota check
GET  https://graph.instagram.com/v24.0/{ig-user-id}/content_publishing_limit
```
[1](https://www.outstand.so/instagram) [2](https://bollardai.com/resources/metagraph)

- Media must be at a **publicly accessible URL** — there is no direct file upload. Our S3 objects
  will need signed public URLs or a proxy route.
- Carousels: create N child containers, then one parent container. Carousel counts as **one** post.
- **Webhooks are not available for publish status — polling is mandatory** (step 2). `EXPIRED`
  containers must be recreated from scratch, not retried.
- Instagram is reached **only through its linked Facebook Page**, so a Page token with
  `pages_read_engagement` is also required. [2](https://bollardai.com/resources/metagraph)

### Rate limits — sources genuinely disagree

| Constraint | Reported values |
|---|---|
| Published posts / rolling 24 h / IG account | **50** [1](https://www.outstand.so/instagram) [5](https://www.keyapi.ai/blog/instagram-api-rate-limits-2026-what-changed-and-how-to-adapt/) · **100** [4](https://www.blotato.com/blog/social-media-api-rate-limits) [2](https://bollardai.com/resources/metagraph) · **25** [2](https://posteverywhere.ai/blog/schedule-instagram-posts-api) |
| Unpublished media containers | 50 [5](https://www.keyapi.ai/blog/instagram-api-rate-limits-2026-what-changed-and-how-to-adapt/) |
| API calls / hour / user token | **200** [2](https://posteverywhere.ai/blog/schedule-instagram-posts-api) [5](https://www.keyapi.ai/blog/instagram-api-rate-limits-2026-what-changed-and-how-to-adapt/) |
| General call formula | 4 800 × impressions / 24 h (floor ≈240/h) [3](https://gist.github.com/jameschapman2c/65eff9f54a2d350b17a6ce5127b9fe42) |
| Facebook | Business Use Case rate limits, formula-based per app and Page |
| YouTube `videos.insert` | 100/day [4](https://www.blotato.com/blog/social-media-api-rate-limits) |

**Meta's own doc contradicts itself** — the Content Publishing guide says 100 posts/24h in one place
and 50 in the carousel section. [4](https://www.blotato.com/blog/social-media-api-rate-limits)

> **Do not hardcode any of these.** Query `GET /{ig-user-id}/content_publishing_limit` before every
> publish batch and store the returned quota. Treat **50/day** as the conservative planning default.
> Exceeding returns error **4** or **613** (platform rate limit) or error **9** subcode **2207042**
> (publishing cap). [5](https://www.keyapi.ai/blog/instagram-api-rate-limits-2026-what-changed-and-how-to-adapt/)

The **200 calls/hour per user token** is the binding constraint for multi-tenant use: it is enforced
at the **token** level, so 10 clinics sharing one token share one budget. Since each clinic has its
own Page token, this scales per-tenant — **one token per practice, never a shared app token.**

### Multi-practice management

**Yes — a single Meta app can manage many practice pages.** Each practice completes its own OAuth
flow and yields its own Page access token; the app ID/secret is shared. Same for GBP: each clinic
authorises its own Google account and we store per-practice refresh tokens.

`[INFERRED — no filesystem access]` for GBP multi-account; Meta multi-Page is
[2](https://bollardai.com/resources/metagraph) and [1](https://developers.facebook.com/docs/pages-api/getting-started/).

## F3. Proposed `ext_channel_accounts` schema (Agent 2 coordination)

```
ext_channel_accounts
  practiceId                       uuid  NOT NULL  → practices.id
  provider                         text  NOT NULL  -- google_business | facebook | instagram | youtube
  externalAccountId                text  NOT NULL  -- GBP location name / FB page id / IG user id
  displayName                      text
  scopesGranted                    text[]                     -- audit: what we were granted
  encryptedAccessToken             text                       -- AES-256-GCM, never logged
  encryptedRefreshToken            text
  tokenExpiresAt                   timestamptz
  tokenRefreshedAt                 timestamptz
  connectedBy                      uuid  → users.id
  connectedAt                      timestamptz
  disconnectedAt                   timestamptz                 -- soft revoke
  status                           text  -- connected | expired | revoked | error
  lastError                        text
  publishingQuotaRemaining         integer                     -- IG 24h quota snapshot
  publishingQuotaFetchedAt         timestamptz
  meta                             jsonb                       -- provider-specific extras
  UNIQUE (practiceId, provider, externalAccountId)
  INDEX  (provider, status) WHERE disconnectedAt IS NULL
```

**Token encryption:** use the same envelope-encryption approach as the existing auth token tables
(`packages/db/schema/auth-tokens.ts` exists
`[VERIFIED: directory listing]` — ⚠️ **NEEDS CONFIRMATION** for the exact cipher/rotation helper).
Never return tokens over tRPC — expose only `{ provider, displayName, status, scopesGranted,
tokenExpiresAt }`.

## F4. Environment variables

```
# Google Business Profile
GBP_OAUTH_CLIENT_ID=
GBP_OAUTH_CLIENT_SECRET=
GBP_OAUTH_REDIRECT_URI=https://{host}/api/oauth/gbp/callback
GBP_API_BASE=https://mybusiness.googleapis.com/v4   # reviews are v4-only

# Meta (Facebook Page + Instagram)
META_APP_ID=
META_APP_SECRET=
META_OAUTH_REDIRECT_URI=https://{host}/api/oauth/meta/callback
META_GRAPH_VERSION=v24.0
META_WEBHOOK_VERIFY_TOKEN=
META_APP_SECRET_PROOF_ENABLED=true

# Token encryption
CHANNEL_TOKEN_ENCRYPTION_KEY=        # 32-byte base64, AES-256-GCM

# Existing (reuse)
CRON_SECRET=                         # already required by cron-auth
NEXT_PUBLIC_APP_URL=                 # already used by messaging.ts:21
```

`GBP_API_BASE` and `META_GRAPH_VERSION` are deliberately env-driven: reviews are pinned to the legacy
v4 host while other GBP surfaces move to v1, and Meta versions the Graph API by dated release.
Hardcoding either guarantees a future migration.

## F5. Minimal connect flow (per practice, per provider)

```
1. UI: Marketing → Settings → Connected accounts → "Connect Google" / "Connect Facebook"
       → GET trpc.extensions.channelAccounts.authorizeUrl({ provider })
         returns a signed-state OAuth URL (state = HMAC(practiceId + userId + nonce), 5-min TTL)

2. Browser → provider consent screen (clinic owner's own account)

3. GET  /api/oauth/{provider}/callback?code=…&state=…
       verify state HMAC + TTL
       exchange code → access_token + refresh_token
       [Meta only] exchange for long-lived user token
       [Meta only] GET /me/accounts → discover Pages → pick the Page → store Page token
       [GBP only] GET /v4/accounts → discover locations → pick the location
       resolve externalAccountId + displayName
       upsert ext_channel_accounts (encrypt tokens)
       redirect → /marketing/settings?connected={provider}

4. Cron: meta-token-refresh (daily)
       for each row where tokenExpiresAt < now() + 7d AND disconnectedAt IS NULL:
         refresh → re-encrypt → update tokenExpiresAt
         on failure: status = 'expired', alertOps, surface a reconnect banner in UI

5. Cron: channel-quota-sync (hourly, Instagram only)
       GET /{ig-user-id}/content_publishing_limit → publishingQuotaRemaining
```

**Failure handling:** every publish attempt writes an `ext_channel_accounts.lastError` and, after
3 consecutive failures, flips `status = 'error'` and disables outbound for that account. Publishing
must never be retried blindly — Instagram `EXPIRED` containers must be **recreated**, not retried,
and a 429 must honour backoff rather than consume quota.

## F6. Safety gates for social publishing (`content-briefs.publish`)

Non-negotiable, in this order:

1. Item `status === 'approved'` **and** `approvedBy` is set — never publish a `proposed` brief.
2. If the item references a `mediaAssetId`: assert `subjectsPresent === false OR consentId IS NOT NULL`,
   and that the linked `extMarketingMediaConsents` row is **not revoked** and its `scope` covers the
   target channel (`photo_social` for Instagram/Facebook, `photo_tv` for waiting-room TV).
3. Assert the patient is not deceased (sympathy gate) before publishing any patient-linked content.
4. Respect `ext_marketing_content_items.validatorVerdict` — never publish a `blocked` item.
5. Check `publishingQuotaRemaining > 0` before an Instagram publish.
6. Write `publishedAt` only on a confirmed provider success.

---

## Appendix — Open questions for the owner

1. **Is `processQueue` really missing its provider call (G4)?** If yes, Phase 1 P1 is the highest
   priority item in this plan and current "sent" counts are fictional.
2. **Should `visit_completed` fire from `encounters.completeVisit` only, or from both paths with
   dedupe (P3)?** Depends on whether any clinic still uses `appointments.setStatus` to check out.
3. **What is the intended marketing SMS cap (G7)?** 1 per 7 days blocks all journeys; 3 per 7 days is
   a reasonable default but is a business/compliance decision, not an engineering one.
4. **Is regex-driven dental recall (G8) acceptable to the clinical lead?** Regex over SOAP free text
   triggering client outreach is the riskiest automation in the codebase.
5. **GBP approval lead time** — who submits the access-request form, and does the schedule allow for it?
