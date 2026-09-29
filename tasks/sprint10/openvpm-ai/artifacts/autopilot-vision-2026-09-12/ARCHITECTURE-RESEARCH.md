# OpenVPM AI — Autopilot Vision: Event-Driven Architecture Research

**Agent 1 (Architecture Research)** · 2026-09-12 · anchor commit `23f23a3`
**Output path:** `artifacts/autopilot-vision-2026-09-12/ARCHITECTURE-RESEARCH.md`

---

## §0. Provenance, method, and three corrections to the brief

### 0.1 What I actually read

This session began with repository access and I read the following files directly. Every
claim tagged **[VERIFIED: path:Lnn]** below comes from that read and can be re-checked
against the cited line.

Read in full: `packages/db/schema/visit-closeouts.ts` (368 L),
`packages/db/schema/care-reminders.ts` (179 L),
`packages/db/schema/ext_marketing.ts` (412 L),
`packages/db/schema/communications.ts` (206 L),
`apps/web/server/routers/care-reminders.ts` (759 L),
`apps/web/lib/marketing/messaging.ts` (711 L),
`apps/web/lib/marketing/sms-rate-limit.ts`,
`apps/web/lib/messaging/reminders.ts`,
`apps/web/lib/messaging/suppression.ts`,
`apps/web/lib/recovery-hold.ts`,
`apps/web/lib/webhook-dispatcher.ts`,
`apps/web/lib/encounters/visit-completion.ts`,
`apps/web/server/routers/extensions/_safety.ts`.

Read in part / grepped across: `apps/web/server/routers/extensions/marketing.ts`
(3491 L — procedure map + the automation-rule, recall-schedule, review, and content-approval
regions), `apps/web/server/routers/appointments.ts` (L1250–1440),
`apps/web/server/routers/encounters.ts` (L1980–2620),
`apps/web/server/routers/records.ts`, `patients.ts`, `clients.ts`, `billing.ts`,
`discharge.ts`, `statutory.ts`, `settings.ts`;
`packages/db/schema/clinical.ts`, `clients.ts`, `patients.ts`, `practices.ts`,
`messaging.ts`, `visit-work-items.ts`, `treatment-plan-evidence.ts`,
`lab-result-events.ts`, `common.ts`, `ext_ai_audit_log.ts`, `ext_support.ts`;
`apps/web/vercel.json`, `apps/web/lib/tenant-db.ts`,
`apps/web/lib/messaging/durable-sms-communication.ts`.

### 0.2 Three corrections to the brief — please read before §A

**(1) The `feature-map-2026-09-12/` prior-art artifacts are not present in this checkout.**
`artifacts/feature-map-2026-09-12/FEATURE-INDEX.md`,
`REORGANIZATION-FINDINGS.md`, and `domains/{marketing-communications,core-clinical,
scheduling-front-desk,ai-agent}.md` do not exist on `main`, on this branch, or anywhere in
git history (`git log --all --diff-filter=A -- '*FEATURE-INDEX*'` returns nothing). The
`artifacts/` directory contains only `ai-feature-audit.md`, `audit-prompts/`,
`bug-hunt-remediation-report.md`, `dr-drill-report.json`,
`production-readiness-report.json`, `ux-codebase-analysis-2026-09-11.md`.
**[VERIFIED: git log / directory listing]**
Consequently the "430 features / 17 domains / 24 collisions / 16 findings" figures and the
contents of the four domain audits are **[INFERRED — not verified against code]**; I did not
use them. Everything in §A is first-hand. If those artifacts live only on the owner's local
disk, re-run this agent with them committed and §A's "Gap" column can be cross-checked
against them — the conclusions below are unlikely to change, since they rest on code.

**(2) Two line references in the brief point at imports, not enforcement.**
- "Quiet hours (existing — verify enforcement in `care-reminders.ts:L30-L31`)" — L30–31 is
  the `import { isQuietHours }` statement. Enforcement is at
  **[VERIFIED: apps/web/server/routers/care-reminders.ts:434]**, inside `sendOutreach`.
- "Recovery hold (existing — verify `care-reminders.ts:L33-L37`)" — L33–37 is the import
  block. Enforcement is at **[VERIFIED: apps/web/server/routers/care-reminders.ts:300–306]**.

**(3) `careReminders` is not an outreach system.** Its schema doc-comment states it
explicitly: *"A reminder is an internal clinic task only: inserting a row never sends email
or SMS and never creates client consent evidence."*
**[VERIFIED: packages/db/schema/care-reminders.ts:30-33]**
The brief's framing of `care-reminders.ts` as "the existing reminder engine" is therefore
misleading. The real automation engine is `apps/web/lib/marketing/messaging.ts`. §A is
organised around that engine.

### 0.3 Verification legend

| Tag | Meaning |
|---|---|
| **[VERIFIED: path:Lnn]** | Read directly in this session; re-checkable at that line. **Treat as `[INFERRED — no filesystem access]` until re-confirmed — see §H before relying on any tag.** |
| **[INFERRED]** | Derived from verified code + standard behaviour of the stack; not a direct read. |
| **[INFERRED — not verified against code]** | Drawn only from the brief's description of a file I could not read. |
| **[ASPIRATIONAL]** | Design proposal; no code exists yet. |

### 0.4 Baseline facts that shape every design decision

| Fact | Evidence |
|---|---|
| Next.js 15 + React 19 + tRPC + Drizzle/Postgres, pnpm monorepo, single Next.js app | [VERIFIED: repo layout, `apps/web/vercel.json`] |
| No Redis, no BullMQ, no worker process anywhere in the repo | [VERIFIED: no such dependency or process in `apps/web/vercel.json`, cron list, or lib tree] |
| All scheduled work is 16 Vercel cron routes hitting `/api/cron/*`; **no marketing, recall, or automation cron exists** | [VERIFIED: apps/web/vercel.json:8-75] |
| Extension tables live in `packages/db/schema/ext_*.ts` (13 files today) and are wildcard-exported | [VERIFIED: packages/db/schema/index.ts:48-60] |
| Extension routers mount at `trpc.extensions.*` | [VERIFIED: apps/web/server/routers/_app.ts:38,77] |
| i18n is currently 100% symmetric — 5048 keys in each of `en.json` and `sk.json`, zero drift | [VERIFIED: key-set diff run this session] |
| Brand/automation config lives in the `practices.settings` JSONB, not in a table | [VERIFIED: apps/web/lib/marketing/planner.ts:38-56, ClinicBrand at L16-36] |
| Practice-level kill switch `practices.recoveryHold` exists and gates all external side effects | [VERIFIED: packages/db/schema/practices.ts:64-69, apps/web/lib/recovery-hold.ts] |

---

## §A. Existing event surface inventory

### A.1 How events work today (three disjoint mechanisms)

There is **no event bus**. Three unrelated mechanisms each carry part of the load:

1. **Outbound webhooks** — `dispatchWebhookEvent(practiceId, event, payload)`
   [VERIFIED: apps/web/lib/webhook-dispatcher.ts:13]. Fire-and-forget HTTPS POST to
   staff-configured URLs. **No persistence** — if no webhook row matches, the event is
   discarded; if delivery fails it is logged and alerted but never retried
   [VERIFIED: apps/web/lib/webhook-dispatcher.ts:61-107]. Internal consumers: **zero**.
2. **Hardcoded marketing side effects** — inline `createMessagesForTrigger(...)` calls
   inside tRPC mutation handlers, driven by a hardcoded `TRIGGERS` map
   [VERIFIED: apps/web/lib/marketing/messaging.ts:38-65].
3. **Hardcoded clinical side-effect chains** — an if/else cascade after a discharge report
   finalises [VERIFIED: apps/web/server/routers/extensions/discharge.ts:600-640].

### A.2 Event inventory

`Payload` = fields actually placed in the payload object. `Producer` = the code that emits.
Status: **LIVE** (reaches a consumer) · **WEBHOOK-ONLY** (leaves the building, nothing
internal consumes it) · **DEAD** (declared but unreachable) · **ABSENT** (required, not built).

| # | Event | Trigger / producer | Payload available | Consumed by | Status & gap |
|---|---|---|---|---|---|
| 1 | `visit.closed` | Visit closeout → `status:'completed'` [VERIFIED: apps/web/server/routers/encounters.ts:2543-2566] | Full closeout row: `appointmentId`, `patientId`, `invoiceId`, `chargeDisposition` (paid/AR/no_charge), `handoffMethod`, `diagnosisSummary`, `followUpDisposition`, `medicationSnapshot[]`, `completedAt`, `completedBy`, `revision` | Nothing. Only read by dashboard onboarding counts [VERIFIED: apps/web/server/routers/settings.ts:1593-1608], `visit-integrity.ts`, backup export | **ABSENT — the single biggest gap.** The canonical "visit is done" moment emits no event at all. Same transaction also sets `appointments.status='checked_out'` [VERIFIED: encounters.ts:2568-2580] |
| 2 | `visit_completed` (marketing trigger key) | `appointments.update` → `checked_out` [VERIFIED: apps/web/server/routers/appointments.ts:1395-1407] | `{eventId: appointmentId, clientId, patientId, appointmentAt}` | `TRIGGERS.visit_completed` → `thank_you` (+2 h), `review_request` (+24 h) [VERIFIED: messaging.ts:43-46] | **DEAD on the canonical path.** `appointments.update` *throws* if a closeout is `clinical_finalized`/`completed` [VERIFIED: appointments.ts:1278-1289], and `encounters.completeCheckout` is the only path that can then reach `checked_out` — yet it emits no marketing trigger. So the trigger fires **only for visits checked out with no finalized closeout**, i.e. the incomplete path. This alone invalidates the "visit closed → review ask" pillar |
| 3 | `appointment.cancelled` | `appointments.update` → `cancelled` [VERIFIED: appointments.ts:1372-1391] | `{id, appointmentId, startTime, endTime, status, previousStatus, patientId, clientId, doctorId, roomId, locationId, typeId, source}` | Outbound webhooks only | **WEBHOOK-ONLY.** No rebook journey, no gap-fill nudge, no waitlist offer |
| 4 | `appointment.checked_in` | `appointments.update` → `checked_in` [VERIFIED: appointments.ts:1352-1370] | same shape as #3 | Outbound webhooks only | **WEBHOOK-ONLY.** Not needed for the vision's pillars; useful for waiting-room TV |
| 5 | `appointment_no_show` (marketing key) | `appointments.update` → `no_show` [VERIFIED: appointments.ts:1408-1423] | `{eventId, clientId, patientId}` | `TRIGGERS.appointment_no_show` → `noshow_rebook` (+2 h) [VERIFIED: messaging.ts:51] | **LIVE** (reachable — no finalized closeout blocks a no-show) |
| 6 | `appointment_booked` (marketing key) | `appointments.update` → `confirmed` [VERIFIED: appointments.ts:1425-1439] | `{eventId, clientId, patientId, appointmentAt}` | `booking_confirmation` (0), `appointment_reminder` (−24 h rel. appointment) [VERIFIED: messaging.ts:39-42] | **LIVE**, but note it fires on `confirmed` only — a booking that goes straight from `scheduled` to `checked_in` never fires it. **[INFERRED]** |
| 7 | `vaccination.recorded` | `records.createVaccination` after commit [VERIFIED: apps/web/server/routers/records.ts:2506-2512] | `{id, patientId, vaccineName, administeredBy, source}` | Outbound webhooks only | **WEBHOOK-ONLY.** No `vaccine.due` computation. Note the payload omits `nextDueDate` even though `vaccination_records.next_due_date` exists [VERIFIED: clinical.ts:275] — so a consumer cannot even compute the recall window without a second read |
| 8 | `vaccine_due` (marketing key) | **no producer** | — | `TRIGGERS.vaccine_due` → sends at 0 and +11 days [VERIFIED: messaging.ts:47-50] | **DEAD.** Declared in `TRIGGERS` and seeded as an enabled rule [VERIFIED: marketing.ts:2049-2060], but nothing ever calls `createMessagesForTrigger('vaccine_due', …)`. There is also no cron that sweeps `vaccination_records.next_due_date` [VERIFIED: apps/web/vercel.json:8-75] |
| 9 | `patient.status_changed` | `patients.update` when status differs [VERIFIED: apps/web/server/routers/patients.ts:1144-1150] | `{patientId, oldStatus, newStatus}` | Webhook; `applySympathyGate` when `newStatus==='deceased'` [VERIFIED: patients.ts:1152-1161] | **PARTIAL.** `patient_status` enum is `{active,inactive,deceased}` [VERIFIED: patients.ts:43-47]. Gate blocks only *already-queued* message rows in that one pass [VERIFIED: messaging.ts:500-522] — it does not cancel journeys, future-dated steps, or staff tasks created earlier |
| 10 | `client.created` | `clients.create` [VERIFIED: apps/web/server/routers/clients.ts:477-484] | `{id, firstName, lastName, email, phone, source}` | Webhook + activation tracking | **WEBHOOK-ONLY.** `client.new` (first visit *closed*) does not exist and is not the same thing |
| 11 | `invoice.paid` | `billing.recordPayment` when `markedPaid` [VERIFIED: billing.ts:3377-3384] and `billing.createAdjustment` when `closesInvoice` [VERIFIED: billing.ts:4142-4150] | `{id, paymentId\|adjustmentId, paidAmount, total, source}` | Outbound webhooks only | **WEBHOOK-ONLY.** No upsell/receipt-thank-you/review-ask consumer |
| 12 | `payment_failed` (marketing key) | **no producer** | — | `TRIGGERS.payment_failed` [VERIFIED: messaging.ts:52] | **DEAD.** `invoice.refunded` webhook exists [VERIFIED: billing.ts:3714] but is not this |
| 13 | `procedure.created` | `records.createProcedure` [VERIFIED: records.ts:4534-4540] | `{id, patientId, appointmentId, name, performedBy, source}` | Outbound webhooks only | **WEBHOOK-ONLY.** `dental.postop` / `surgery.postop` are never derived from it. The only post-op path is discharge-report finalisation (see #14), so a procedure recorded **without** a discharge report produces no post-op check-in |
| 14 | `discharge_report.finalized` | `discharge.create/update` on `status==='finalized'` [VERIFIED: discharge.ts:600-605] | `{reportId, patientId, appointmentId}` | Webhook **plus** a hardcoded cascade: sympathy gate **or** `schedulePostopCheckIn` + `detectAndTriggerDentalRecall` + `checkAndTriggerSeniorMilestone` [VERIFIED: discharge.ts:606-638] | **LIVE but hardwired.** This is the richest event in the codebase and the only one with internal consumers — yet it is an unconfigurable if/else chain, not a rule. Dental detection is a regex over clinical free text [VERIFIED: messaging.ts:653-654]. Senior threshold is dog ≥ 7 y / cat ≥ 8 y [VERIFIED: messaging.ts:688-694]. Neither is practice-configurable |
| 15 | `surgery_completed` (marketing key) | `schedulePostopCheckIn` (from #14) [VERIFIED: messaging.ts:596-599] | `{eventId: 'discharge_<ts>', clientId, patientId}` | `postop_check` (+24 h) [VERIFIED: messaging.ts:54] | **LIVE**, but only via discharge, not via `procedure.created`. Gated on `postVisitHandoutEnabled` [VERIFIED: messaging.ts:574-579] |
| 16 | `dental_detected` (marketing key) | regex match on diagnosis+treatment+report [VERIFIED: messaging.ts:653-671] | `{eventId: 'dental_<patientId>_<ts>', clientId, patientId}` | `dental_education` (+7 d), `dental_recall` (+21 d) [VERIFIED: messaging.ts:55-58] | **LIVE**, practice-invisible and not configurable |
| 17 | `senior_milestone` (marketing key) | age-threshold check [VERIFIED: messaging.ts:677-707] | `{eventId: 'senior_<patientId>_<year>'}` | `senior_wellness_invite` (+2 d) [VERIFIED: messaging.ts:59-61] | **LIVE**, fires at most once per calendar year by idempotency key |
| 18 | `inactive_recall` | **no producer** | — | Not in `TRIGGERS` at all | **DOUBLY DEAD.** Seeded as an enabled rule with `triggerKey:'inactive_recall'` [VERIFIED: marketing.ts:2089-2096]; absent from `TRIGGERS`, so even a manual trigger produces zero messages |
| 19 | `review_request` (seeded rule) | seeded with `triggerKey:'appointment_completed'` [VERIFIED: marketing.ts:2072-2078] | — | — | **DEAD.** `appointment_completed` is not a key in `TRIGGERS` (the real key is `visit_completed`), so `rules = []` and nothing is ever created. The seeded default rule 3/4 never fires |
| 20 | `soap_note.created` | 4 dispatch sites [VERIFIED: records.ts:1659, 1701, 1783; apps/web/app/api/v1/soap-notes/route.ts:204] | **[INFERRED — not verified against code]** shape not read | Outbound webhooks only | **WEBHOOK-ONLY.** No NLP extraction → `vaccine.administered` (from SOAP) and `dental.postop` cannot be derived today |
| 21 | `lab_result.created` | [VERIFIED: records.ts:3960] | not read | Outbound webhooks only | **WEBHOOK-ONLY** |
| 22 | `prescription.created / .completed / .cancelled` | [VERIFIED: records.ts:2910, 3134, 3158] | not read | Outbound webhooks only | **WEBHOOK-ONLY** |
| 23 | `problem.created` | [VERIFIED: records.ts:2546] | not read | Outbound webhooks only | **WEBHOOK-ONLY** |
| 24 | `review.received` | **no producer, no ingestion** | — | — | **ABSENT.** `ext_marketing_reviews` is manual CRUD + demo seeding only [VERIFIED: marketing.ts:901-999; apps/web/lib/onboarding/marketing-demo-data.ts:190]. No Google Business or Facebook API integration exists anywhere in the repo [VERIFIED: grep for `googleapis`/`graph.facebook` returns only UI channel labels]. Columns `requestSentAt` and `requestBlockedReason` are never written by any code path |
| 25 | `patient.inactive` | **no producer** | — | — | **ABSENT.** `ext_marketing_recall_schedules.inactiveRecallEnabled` / `inactiveRecallMonths` are stored and editable [VERIFIED: marketing.ts:1339-1378] but **never read by any code** |
| 26 | `treatment_plan.incomplete` | **no producer** | — | — | **ABSENT**, but the data is there: `visit_treatment_plan_presentations.status='pending'` with `expiresAt` [VERIFIED: treatment-plan-evidence.ts:295-318] is exactly "plan shown to owner, no signed decision". Also `treatment_plans.status ∈ {active,completed,discontinued}` and `treatment_plan_items.status ∈ {pending,in_progress,done,skipped}` [VERIFIED: clinical.ts:57-66] |
| 27 | `content.approved` | `approveContentBatch` sets `ext_marketing_content_items.status='approved'` [VERIFIED: marketing.ts:1586-1620] | `{practiceId, batchId, approvedBy, approvedAt}` | Nothing | **ABSENT as an event.** Also note the enum `ext_marketing_content_status` has `published` [VERIFIED: ext_marketing.ts:16] but **no code ever writes `published` or `publishedAt`** — there is no publish path at all. Social sharing is copy-to-clipboard [VERIFIED: apps/web/app/(dashboard)/marketing/page.tsx:173-188] |
| 28 | `client.new` (first visit closed) | **no producer** | — | — | **ABSENT.** Closest is `client.created` (#10), which is registration, not first completed visit |

### A.3 Cross-cutting findings on the existing engine

These are properties of `lib/marketing/messaging.ts` that any new architecture must inherit
or deliberately replace.

**A.3.1 `processQueue` does not send anything.** It selects queued rows whose
`scheduledFor <= now`, applies suppression checks, then sets `status='delivered'` and writes
a row to `ext_sms_delivery_log`.
**[VERIFIED: apps/web/lib/marketing/messaging.ts:376-465; the "delivered" write is at L449]**
The module imports **no** SMS or email send function — its entire import list is drizzle
operators, the db package, `./planner`, and `./sms-rate-limit`
[VERIFIED: messaging.ts:1-19]. **[INFERRED]** This is a simulator: the marketing queue has
never delivered a message in production. It is invoked only by a manual tRPC mutation
`processQueuedMessages` [VERIFIED: marketing.ts:1996-2001], and **no cron calls it**
[VERIFIED: apps/web/vercel.json:8-75]. So the entire marketing automation surface is
currently inert unless a human clicks a button.

**A.3.2 Quiet hours are computed in server-local time, not practice time.** `isQuiet` reads
`now.getHours()` and compares against `brand.quietHoursStart/End`
[VERIFIED: messaging.ts:71-79]. A parallel, correct implementation exists —
`isQuietHours(now, timeZone)` in `lib/messaging/reminders.ts` resolves the practice IANA
timezone via `Intl.DateTimeFormat` and **fails closed** (returns quiet) on a missing or
invalid timezone [VERIFIED: apps/web/lib/messaging/reminders.ts:17-37]. The marketing engine
does not use it. For a Slovakia-only deployment with `Europe/Bratislava` on both server and
practice this is invisible; it breaks the moment the app runs on UTC servers (Vercel
default) — a 20:00–08:00 Bratislava quiet window becomes a 22:00–10:00 UTC window in summer.
**[INFERRED]** This is a live defect for hosted deployments.

**A.3.3 The rate limiter is a zero-tolerance gate, not a cap.** `smsRateLimitOk` returns
`(row?.count ?? 0) === 0` over the window [VERIFIED: apps/web/lib/marketing/sms-rate-limit.ts:5-23].
So it permits **at most one SMS per client per `marketingRateLimitDays`**, not "max N". It is
called twice — at message creation [VERIFIED: messaging.ts:167] and again at send
[VERIFIED: messaging.ts:435] — so a single sent marketing SMS locks that client out of all
marketing SMS for the whole window, including unrelated campaigns. The brief's "frequency
cap (max N per 7 days)" cannot be implemented by tuning this function; it needs a counter.

**A.3.4 Latent crash on the fallback-template path.** `pickTemplate` returns a fallback
object `{id, key, channel, subject, body, language}` when a practice has no template row
[VERIFIED: messaging.ts:290-304]. That object has **no `version` and no `legalBasis`**, but
the insert writes both into columns declared `.notNull()` with **no default**
[VERIFIED: packages/db/schema/ext_marketing.ts:304-305]. Templates are seeded only by demo
data [VERIFIED: apps/web/lib/onboarding/marketing-demo-data.ts:424], so a real practice
hits the fallback for `dental_education`, `dental_recall`, `senior_wellness_invite`.
**[INFERRED]** The insert raises a NOT NULL violation. Because
`detectAndTriggerDentalRecall` and `checkAndTriggerSeniorMilestone` are called **without a
try/catch** from the discharge finalisation path [VERIFIED: discharge.ts:606-638], this can
fail a clinician's discharge finalisation. Priority: fix before any Phase 1 traffic.

**A.3.5 Sympathy gate coverage is not unconditional.** SKILL.md §3 requires that outreach be
*unconditionally* blocked for a deceased patient, but `processQueue` blocks only when
`m.legalBasis === 'consent'` **or** `m.templateKey ∈ SYMPATHY_BLOCKED`
[VERIFIED: messaging.ts:414]. `SYMPATHY_BLOCKED = {vaccine_due, review_request, thank_you,
postop_check, marketing_blast}` [VERIFIED: messaging.ts:24-30]. Template keys **not** in
that set — `booking_confirmation`, `appointment_reminder`, `noshow_rebook`, `wellness_welcome`,
`payment_failed`, `dental_education`, `dental_recall`, `senior_wellness_invite` — are
blocked **only if** `legalBasis === 'consent'`. All four seeded default rules use
`legalBasis:'contract'` [VERIFIED: marketing.ts:2049-2105]. **[INFERRED]** A `contract`-basis
message with an uncovered template key is not blocked by this check. Full detail in §E.1.

**A.3.6 Side effects run outside the emitting transaction.** Appointment status changes
commit first, then marketing triggers run afterwards [VERIFIED: appointments.ts:1392-1440];
discharge finalisation likewise fires side effects after commit [VERIFIED: discharge.ts:599].
**[INFERRED]** A process crash between commit and side effect silently drops the event. This
is precisely the failure mode a durable outbox (§B) exists to eliminate.

### A.4 Summary: coverage of the 12 required events

| Required event | Exists today? | Notes |
|---|---|---|
| `visit.closed` | ✗ | Closeout completes silently (#1). `visit_completed` is dead (#2) |
| `vaccine.administered` | ◐ | `vaccination.recorded` webhook exists but lacks `nextDueDate` (#7) |
| `vaccine.due` | ✗ | Declared, scheduled config stored, never computed (#8) |
| `appointment.cancelled` | ◐ | Webhook-only, no internal consumer (#3) |
| `invoice.paid` | ◐ | Webhook-only (#11) |
| `review.received` | ✗ | No ingestion at all (#24) |
| `patient.inactive` | ✗ | Config stored, never read (#25) |
| `treatment_plan.incomplete` | ✗ | Source data exists (#26) |
| `patient.deceased` | ◐ | Derived from `patient.status_changed`; gate is partial (#9, A.3.5) |
| `client.new` | ✗ | (#28) |
| `dental.postop` | ◐ | Regex-derived, not configurable, discharge-only (#16) |
| `surgery.postop` | ◐ | Discharge-only, not from `procedure.created` (#13, #15) |
| `content.approved` | ✗ | State change happens, no event, and no publish path exists (#27) |
| `review.request_eligible` | ✗ | Composite signal; no producer (#19) |

**Score: 0 complete, 7 partial, 7 absent.** The vision's "event-driven marketing engine"
pillar has, in practice, no event source for its flagship flow.

---

## §B. Proposed event bus

### B.1 Technology decision: Postgres log, not Redis/BullMQ — with justification

**Recommendation: a durable Postgres table drained by the existing cron mechanism.**

Justification against the constraint "prefer pg-based unless you can justify the dependency":

1. **No worker runtime exists.** Every scheduled job in this repo is a Vercel cron route
   [VERIFIED: apps/web/vercel.json:8-75]. BullMQ requires a long-lived Node worker; adding
   one means a second deployable, a second failure domain, and a superset of the
   operational burden described in the existing SMS-operations runbooks. On Vercel's
   serverless platform it would need an entirely separate host.
2. **Self-hosting is a supported deployment target.** The repo ships
   `docker/docker-compose.yml` with no Redis service. Adding Redis raises the floor for
   every self-hosted clinic — a real cost for an open-source veterinary product.
3. **The codebase already contains the pattern.** Precedents for durable Postgres state
   that survive restarts: `sms_send_attempts` (immutable attempt ledger),
   `visit_work_items`, `ext_sms_delivery_log`, `lab_result_events` (append-only clinical
   evidence), `ext_ai_audit_log` (append-only audit). An `ext_events` table is idiomatic
   here, not novel.
4. **Postgres gives transactional outbox for free.** The producer inserts the event in the
   *same transaction* as the business change. This directly fixes A.3.6. Redis cannot offer
   this without a CDC layer.
5. **`SELECT … FOR UPDATE SKIP LOCKED` is a correct, concurrency-safe claim primitive.**
   It is already used elsewhere in the repo (e.g. `careReminders.setDismissed`
   [VERIFIED: apps/web/server/routers/care-reminders.ts:648]).

**Honest trade-offs.** Postgres polling adds ~1 poll-interval latency (fine: all delays here
are hours-to-days) and puts write volume on the primary. At realistic scale — a clinic
generating a few hundred events/day — this is negligible. The design below supports
migration to a real broker later: the handler interface is `async (tx, event) => effect[]`,
so swapping the drain loop for a queue consumer is a localized change.

**Where Redis would become justified:** > ~50k events/day sustained, sub-second delivery
SLAs, or multi-instance horizontal drain with strict global ordering. None of these apply.
Revisit only if Phase 4 predictive scoring generates high-frequency internal events.

### B.2 Drizzle schema — `packages/db/schema/ext_automation_events.ts`

Follows the `ext_*.ts` isolation rule [SKILL.md §1]; add
`export * from "./ext_automation_events";` to `packages/db/schema/index.ts`, then
`pnpm db:push`. **No vanilla table is touched.**

```ts
// packages/db/schema/ext_automation_events.ts
// Ext-only per SKILL.md §1. Append-only event log + durable work queue.
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { clients } from "./clients";
import { appointments } from "./scheduling";

/* -------------------------------------------------------------------------- */
/* Event types                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Closed-set enum. Adding a value requires `ALTER TYPE ... ADD VALUE`, which
 * `pnpm db:push` emits correctly but which cannot run inside a transaction block
 * on older Postgres. Add values in a dedicated push. See §G.Q3 for the
 * alternative (varchar + app-level validation) if the owner expects frequent additions.
 */
export const extEventTypeEnum = pgEnum("ext_event_type", [
  // --- lifecycle -----------------------------------------------------------
  "visit.closed",
  "client.new",
  "appointment.booked",
  "appointment.cancelled",
  "appointment.no_show",
  // --- clinical ------------------------------------------------------------
  "vaccine.administered",
  "vaccine.due",
  "dental.postop",
  "surgery.postop",
  "treatment_plan.incomplete",
  "patient.deceased",
  // --- financial -----------------------------------------------------------
  "invoice.paid",
  "payment.failed",
  // --- engagement ----------------------------------------------------------
  "patient.inactive",
  "review.request_eligible",
  "review.received",
  "content.approved",
  "wellness.enrolled",
]);

export const extEventStatusEnum = pgEnum("ext_event_status", [
  "pending",    // awaiting drain
  "processing", // claimed by a drain; visibility timeout active
  "processed",  // all handlers ran (or none matched)
  "skipped",    // handler declined (e.g. rule disabled) — terminal
  "failed",     // exhausted retries — terminal, needs human review
]);

export const extEventSourceEnum = pgEnum("ext_event_source", [
  "trpc",    // emitted inside a tRPC mutation
  "cron",    // emitted by a scheduled sweep (computed events)
  "webhook", // ingested from an external platform
  "manual",  // staff triggered
  "system",  // internal-derived (e.g. journey step → next event)
]);

/* -------------------------------------------------------------------------- */
/* Payload contract                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Every event carries the identifiers it can resolve. Optional because, e.g.,
 * `content.approved` has no patient. Handlers must tolerate absent subjects and
 * fall back to the client-scoped path (required for the multi-pet sympathy rule).
 */
export type ExtEventPayload = {
  /** Denormalised at emit time so the daily digest needs no joins. */
  patientName?: string;
  clientName?: string;
  species?: string;
  /** money as decimal strings — never floats */
  invoiceTotal?: string;
  /** free-form, event-type-specific */
  [key: string]: unknown;
};

/* -------------------------------------------------------------------------- */
/* ext_events                                                                  */
/* -------------------------------------------------------------------------- */

export const extEvents = pgTable(
  "ext_events",
  {
    ...baseColumns(),

    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),

    eventType: extEventTypeEnum("event_type").notNull(),
    source: extEventSourceEnum("source").notNull().default("trpc"),
    /** Dotted emitter identity, e.g. "encounters.completeCheckout". */
    emittedBy: varchar("emitted_by", { length: 120 }).notNull(),

    // ---- subject references (all optional; see payload contract) -----------
    patientId: uuid("patient_id").references(() => patients.id),
    clientId: uuid("client_id").references(() => clients.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    /** Generic subject for non-clinical events (content item, review id). */
    subjectId: uuid("subject_id"),
    subjectType: varchar("subject_type", { length: 40 }),

    payload: jsonb("payload").$type<ExtEventPayload>().notNull().default({}),

    /** Business time of the event (may differ from createdAt on backfill). */
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Earliest time the drain may claim this row (delay / retry backoff). */
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** Idempotency: producer-supplied, unique per practice. */
    dedupeKey: varchar("dedupe_key", { length: 200 }).notNull(),

    // ---- queue state -------------------------------------------------------
    status: extEventStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    /** Visibility timeout for SKIP LOCKED claiming. */
    claimedBy: varchar("claimed_by", { length: 64 }),
    claimedUntil: timestamp("claimed_until", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    lastError: text("last_error"),

    /** Correlates one event with all effects it caused (§C ext_event_reactions). */
    traceId: uuid("trace_id").notNull(),
  },
  (table) => ({
    /** Drives the drain: partial index keeps it small as the log grows. */
    claimIdx: index("ext_events_claim_idx")
      .on(table.availableAt, table.id)
      .where(sql`${table.status} = 'pending'`),
    practiceTypeIdx: index("ext_events_practice_type_idx").on(
      table.practiceId,
      table.eventType,
      table.occurredAt,
    ),
    practiceStatusIdx: index("ext_events_practice_status_idx").on(
      table.practiceId,
      table.status,
      table.occurredAt,
    ),
    patientTimelineIdx: index("ext_events_patient_idx").on(
      table.practiceId,
      table.patientId,
      table.occurredAt,
    ),
    clientTimelineIdx: index("ext_events_client_idx").on(
      table.practiceId,
      table.clientId,
      table.occurredAt,
    ),
    /** Idempotency: re-emitting the same event is a no-op. */
    dedupeUq: uniqueIndex("ext_events_dedupe_uq").on(
      table.practiceId,
      table.dedupeKey,
    ),

    attemptsCheck: check(
      "ext_events_attempts_check",
      sql`${table.attempts} >= 0 and ${table.maxAttempts} between 1 and 20`,
    ),
    /** A terminal status must carry its terminal timestamp, and vice versa. */
    terminalStateCheck: check(
      "ext_events_terminal_state_check",
      sql`(${table.status} in ('processed', 'skipped', 'failed'))
            = (${table.processedAt} is not null)`,
    ),
    /** At least one subject must be resolvable, or the event is unusable. */
    subjectCheck: check(
      "ext_events_subject_check",
      sql`${table.patientId} is not null
            or ${table.clientId} is not null
            or ${table.appointmentId} is not null
            or (${table.subjectId} is not null and ${table.subjectType} is not null)`,
    ),
  }),
);

/* -------------------------------------------------------------------------- */
/* ext_event_reactions — what each event actually caused                       */
/* -------------------------------------------------------------------------- */

export const extEventReactionOutcomeEnum = pgEnum("ext_event_reaction_outcome", [
  "enrolled",          // journey enrolment created
  "sent",              // message dispatched
  "scheduled",         // message queued for later
  "content_brief",     // content item drafted for approval
  "staff_task",        // internal task created (incl. condolence)
  "suppressed",        // blocked by suppression engine (reason recorded)
  "dry_run",           // rule matched but dry-run mode prevented the effect
  "skipped",           // rule disabled, condition unmet, or no handler
]);

export const extEventReactions = pgTable(
  "ext_event_reactions",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => extEvents.id, { onDelete: "cascade" }),
    traceId: uuid("trace_id").notNull(),

    ruleId: uuid("rule_id"), // → ext_automation_rules.id (§C)
    journeyId: uuid("journey_id"), // → ext_journeys.id (§D)
    enrollmentId: uuid("enrollment_id"), // → ext_journey_enrollments.id (§D)

    outcome: extEventReactionOutcomeEnum("outcome").notNull(),
    /** Machine-readable reason for suppressed / skipped / dry_run. */
    reasonCode: varchar("reason_code", { length: 64 }),
    /** Human-readable explanation for the staff-facing audit view. */
    explanation: text("explanation"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
  },
  (table) => ({
    eventIdx: index("ext_reactions_event_idx").on(table.practiceId, table.eventId),
    traceIdx: index("ext_reactions_trace_idx").on(table.traceId),
    outcomeIdx: index("ext_reactions_outcome_idx").on(
      table.practiceId,
      table.outcome,
      table.createdAt,
    ),
    /** Dry runs must be distinguishable from real effects forever. */
    dryRunCheck: check(
      "ext_reactions_dry_run_check",
      sql`(${table.outcome} = 'dry_run') = (${table.detail} -> 'dryRun' = 'true')`,
    ),
  }),
);

export const extEventsRelations = relations(extEvents, ({ one, many }) => ({
  practice: one(practices, {
    fields: [extEvents.practiceId],
    references: [practices.id],
  }),
  patient: one(patients, {
    fields: [extEvents.patientId],
    references: [patients.id],
  }),
  client: one(clients, {
    fields: [extEvents.clientId],
    references: [clients.id],
  }),
  appointment: one(appointments, {
    fields: [extEvents.appointmentId],
    references: [appointments.id],
  }),
  reactions: many(extEventReactions),
}));

export const extEventReactionsRelations = relations(
  extEventReactions,
  ({ one }) => ({
    practice: one(practices, {
      fields: [extEventReactions.practiceId],
      references: [practices.id],
    }),
    event: one(extEvents, {
      fields: [extEventReactions.eventId],
      references: [extEvents.id],
    }),
  }),
);
```

### B.3 Event catalogue: producer, payload, consumers

`dedupeKey` convention: `{eventType}:{primarySubjectId}:{discriminator}`.

| Event | Produced by (change required) | Minimum payload | Consumed by |
|---|---|---|---|
| `visit.closed` | **New:** insert inside the `encounters.completeCheckout` transaction, immediately after the closeout UPDATE succeeds [VERIFIED: encounters.ts:2543-2566] | `appointmentId`, `patientId`, `clientId`, `chargeDisposition`, `invoiceId`, `handoffMethod`, `diagnosisSummary`, `patientName`, `species` | Rules: thank-you, review-request-eligible, first-visit detection, treatment-plan nudge. Journey: post-visit. Digest: "what happened today" |
| `vaccine.administered` | **Reuse:** `records.createVaccination` already dispatches a webhook [VERIFIED: records.ts:2506]; add an `ext_events` insert in the same post-commit block. **Extend payload** with `nextDueDate` (column exists [VERIFIED: clinical.ts:275]) | `patientId`, `clientId`, `vaccineName`, `nextDueDate`, `administeredAt`, `appointmentId` | Rules: schedule the `vaccine.due` computation; rabies-register cross-check (SKILL.md §3) |
| `vaccine.due` | **New cron** `/api/cron/automation-sweep`: sweep `vaccination_records` where `next_due_date <= today + leadDays` [index exists: clinical.ts `vaccination_records_practice_due_idx`] | `patientId`, `clientId`, `vaccineName`, `dueDate`, `leadDays` | Rules: vaccination recall (replaces dead #8); honours `ext_marketing_recall_schedules.vaccinationRecallLeadDays` which is currently unread |
| `appointment.cancelled` | **Reuse:** existing dispatch site [VERIFIED: appointments.ts:1372]; add `ext_events` insert | `appointmentId`, `patientId`, `clientId`, `startTime`, `previousStatus` | Journey: rebook/recover; waitlist offer; gap-fill (Phase 4) |
| `invoice.paid` | **Reuse:** both dispatch sites [VERIFIED: billing.ts:3377, 4142]; add insert | `clientId`, `patientId`, `invoiceId`, `total`, `paidAt` | Rules: receipt thank-you, review-request eligibility scoring, wellness upsell |
| `review.received` | **Phase 1 partial:** staff "add review" mutation [VERIFIED: marketing.ts:926]. **Phase 2:** Google Business / Facebook poller (does not exist today) | `platform`, `externalReviewId`, `rating`, `reviewText`, `clientId?`, `patientId?` | Sentiment classification; staff escalation task; suppression (a 1–2★ review suppresses any pending review ask for that client) |
| `patient.inactive` | **New cron** (same sweep): clients with no `checked_out` appointment in `inactiveRecallMonths` (config currently unread — #25) | `patientId`, `clientId`, `lastVisitAt`, `monthsInactive` | Reactivation journey |
| `treatment_plan.incomplete` | **New cron**: `visit_treatment_plan_presentations` where `status='pending'` and `expiresAt < now` [VERIFIED: treatment-plan-evidence.ts:313] | `patientId`, `clientId`, `planId`, `presentedAt`, `expiredAt` | Treatment-plan nudge journey (the vision's pillar 5) |
| `patient.deceased` | **Reuse:** `patients.update` already detects the transition and calls `applySympathyGate` [VERIFIED: patients.ts:1144-1161]; emit the event **first**, then let a handler invoke the gate | `patientId`, `clientId`, `oldStatus`, `newStatus` | **Highest-priority handler:** cancel all active journeys, block all queued steps, dismiss open care reminders, create condolence task |
| `client.new` | **New:** on `visit.closed`, if no earlier `visit.closed` exists for that client, emit once | `clientId`, `patientId`, `appointmentId`, `firstVisitAt` | New-client welcome journey |
| `dental.postop` | **New:** derive from `procedure.created` [VERIFIED: records.ts:4534] by matching `name` against a practice-configurable dental procedure list — **replacing** the current free-text regex (#16) | `patientId`, `clientId`, `procedureId`, `procedureName`, `performedAt` | Dental education + recall journey |
| `surgery.postop` | **New:** same derivation as above with a surgery procedure list. Keep the existing discharge-based path [VERIFIED: messaging.ts:567-600] as a **fallback** so behaviour does not regress | `patientId`, `clientId`, `procedureId`, `procedureName`, `performedAt` | Post-op check-in journey |
| `content.approved` | **New:** `approveContentBatch` already flips status [VERIFIED: marketing.ts:1586-1620]; emit per item | `contentItemId`, `batchId`, `channel`, `approvedBy`, `approvedAt` | Phase 2 publisher. Phase 1: notification only — nothing publishes |
| `review.request_eligible` | **New:** computed by the rules engine **after** `visit.closed` + suppression + a positive-signal condition (see §C.4), not emitted directly by a mutation | `clientId`, `patientId`, `appointmentId`, `signals` | Review-request journey |

### B.4 Drain loop

One new cron route, `apps/web/app/api/cron/automation/route.ts`, registered in
`apps/web/vercel.json` alongside the existing 16 crons, on a `*/5 * * * *` schedule (matching
`sms-provider-events` and `file-replicas`).

```ts
// apps/web/lib/automation/drain.ts  — [ASPIRATIONAL]
// Claim a batch with SKIP LOCKED, run handlers, record reactions.
export async function claimEvents(tx, limit = 100) {
  return tx.execute(sql`
    update ext_events
       set status = 'processing',
           claimed_by = ${RUN_ID},
           claimed_until = now() + interval '5 minutes',
           attempts = attempts + 1
     where id in (
       select id from ext_events
        where status = 'pending'
          and available_at <= now()
        order by available_at
        limit ${limit}
          for update skip locked
     )
     returning *
  `);
}
```

Handlers are pure-ish functions registered in a map:

```ts
type EventHandler = (tx, event: ExtEventRow) => Promise<Effect[]>;
// Effects: {kind:'enroll', journeyKey, ...} | {kind:'send', templateKey, ...}
//        | {kind:'staff_task', ...} | {kind:'content_brief', ...} | {kind:'emit', eventType, ...}
```

The runner (`apps/web/lib/automation/runner.ts`) wraps each handler in
`lockPracticeForExternalSideEffects` [VERIFIED: apps/web/lib/recovery-hold.ts:31-45] **before
any external side effect**, reusing the existing recovery-hold contract rather than
inventing one. Retry uses exponential backoff written into `availableAt`; at `maxAttempts`
the row goes to `failed` and an ops alert fires via the existing `alertOps`
[VERIFIED: apps/web/lib/webhook-dispatcher.ts:101-107 pattern].

**Crash safety:** if a drain dies mid-batch, `claimedUntil` expires and a later drain
reclaims the row. Handlers must therefore be idempotent — every effect carries a
`dedupeKey`. This is already the house style
(`ext_marketing_message_logs.idempotency_key`, `communications.dedupe_key`).

**Ordering:** no global ordering guarantee, and none is needed. Per-client ordering is
achieved by the journey engine's `nextRunAt`, not by event order.

---

## §C. Proposed rules engine

### C.1 Design intent

The current `ext_marketing_automation_rules` table is a **display list, not an engine**. It
stores `triggerKey`, `timing` (a free-text Slovak string like `"14 dní pred expirácií"`, never
parsed), `channel`, `legalBasis`, `enabled`, `sort`
[VERIFIED: packages/db/schema/ext_marketing.ts:363-378]. The actual trigger→message
mappings are the hardcoded `TRIGGERS` record in code [VERIFIED: messaging.ts:38-65], and the
only thing a practice can change is `enabled`
[VERIFIED: messaging.ts:176-190 — only rows with `enabled=false` are consulted].

The new engine must satisfy: configurable triggers, conditions, delays, actions; practice
overrides; dry-run; no hardcoded workflows.

### C.2 Schema — `packages/db/schema/ext_automation_rules.ts`

```ts
// packages/db/schema/ext_automation_rules.ts
import {
  boolean, check, index, integer, jsonb, pgEnum, pgTable,
  text, timestamp, uniqueIndex, uuid, varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { users } from "./users";
import { extEventTypeEnum } from "./ext_automation_events";

/* ----------------------------------------------------------------- */
/* Condition DSL — validated by Zod at the tRPC boundary              */
/* ----------------------------------------------------------------- */

export type RuleCondition =
  | { field: "patient.species";        op: "in" | "not_in"; value: string[] }
  | { field: "patient.status";         op: "in" | "not_in"; value: string[] }
  | { field: "patient.age_years";      op: "gte" | "lte" | "between"; value: number | [number, number] }
  | { field: "patient.is_first_visit"; op: "eq"; value: boolean }
  | { field: "visit.type";             op: "in" | "not_in"; value: string[] }
  | { field: "visit.charge_disposition"; op: "in"; value: ("paid" | "accounts_receivable" | "no_charge")[] }
  | { field: "client.segment";         op: "in" | "not_in"; value: string[] }
  | { field: "client.preferred_contact_method"; op: "in"; value: string[] }
  | { field: "client.has_email";       op: "eq"; value: boolean }
  | { field: "client.sms_consent";     op: "eq"; value: boolean }
  | { field: "invoice.total_cents";    op: "gte" | "lte"; value: number }
  | { field: `event.payload.${string}`; op: "eq" | "in" | "contains" | "exists"; value: unknown }
  | { all: RuleCondition[] }
  | { any: RuleCondition[] }
  | { not: RuleCondition };

/**
 * Resolvers read through a single `ConditionContext` built once per event by
 * `lib/automation/context.ts`. Unknown fields are rejected at write time by the
 * Zod schema, so the evaluator is a total function — no runtime surprises.
 */
export type RuleConditionExplanation = {
  field: string;
  op: string;
  expected: unknown;
  actual: unknown;
  matched: boolean;
};

/* ----------------------------------------------------------------- */
/* Action model                                                       */
/* ----------------------------------------------------------------- */

export const extAutomationActionEnum = pgEnum("ext_automation_action", [
  "send_message",        // render template → ext_marketing_message_logs
  "enroll_journey",      // start a multi-step journey (§D)
  "create_content_brief",// draft a social/newsletter item for approval (never auto-publishes)
  "create_staff_task",   // internal task incl. condolence / escalation
  "emit_event",          // derive a downstream event (e.g. review.request_eligible)
]);

export type ExtAutomationActionConfig = {
  send_message: { templateKey: string; channel: "sms" | "email"; legalBasis: "contract" | "consent" | "legitimate_interest" };
  enroll_journey: { journeyKey: string; restartPolicy?: "allow" | "once_per_client" | "once_per_patient" };
  create_content_brief: { channel: "instagram" | "facebook" | "google_business" | "newsletter" | "waiting_room_tv"; recipeKey?: string };
  create_staff_task: { kind: "condolence" | "postop_escalation" | "review_escalation" | "info"; title: string };
  emit_event: { eventType: string; payloadPatch?: Record<string, unknown> };
};

export const extAutomationRuleScopeEnum = pgEnum("ext_automation_rule_scope", [
  "practice", // practice-owned, fully editable
  "seeded",   // copied from a system default at first access; editable, restorable
]);

/* ----------------------------------------------------------------- */
/* ext_automation_rules                                               */
/* ----------------------------------------------------------------- */

export const extAutomationRules = pgTable(
  "ext_automation_rules",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id").notNull().references(() => practices.id),

    /** Stable key; the seed identifier lives in seedKey so "restore defaults" works. */
    key: varchar("key", { length: 80 }).notNull(),
    seedKey: varchar("seed_key", { length: 80 }),
    scope: extAutomationRuleScopeEnum("scope").notNull().default("practice"),

    label: varchar("label", { length: 160 }).notNull(),
    description: text("description").notNull().default(""),

    // ---- trigger --------------------------------------------------
    triggerEvent: extEventTypeEnum("trigger_event").notNull(),
    conditions: jsonb("conditions").$type<RuleCondition | null>(),

    // ---- timing ---------------------------------------------------
    delayMinutes: integer("delay_minutes").notNull().default(0),
    delayAnchor: pgEnumDelayAnchor("delay_anchor").notNull().default("event"),

    // ---- action ---------------------------------------------------
    actionType: extAutomationActionEnum("action_type").notNull(),
    actionConfig: jsonb("action_config").$type<Record<string, unknown>>().notNull(),

    // ---- safety / throttling --------------------------------------
    /** Per-rule cooldown: skip if this rule already fired for this client inside N minutes. */
    cooldownMinutes: integer("cooldown_minutes").notNull().default(0),
    /** Per-rule frequency cap: max N fires per client per rolling 7 days. */
    maxFiresPerClientPerWeek: integer("max_fires_per_client_per_week"),
    /** Honour quiet hours and defer, rather than drop. */
    respectQuietHours: boolean("respect_quiet_hours").notNull().default(true),
    /** Never bypass the sympathy gate / suppression engine, even for contract-basis traffic. */
    suppressionExempt: boolean("suppression_exempt").notNull().default(false),

    // ---- lifecycle -------------------------------------------------
    enabled: boolean("enabled").notNull().default(true),
    /** Log what would fire without firing. Overrides nothing else. */
    dryRun: boolean("dry_run").notNull().default(false),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    sort: integer("sort").notNull().default(0),

    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (table) => ({
    practiceKeyUq: uniqueIndex("ext_auto_rules_practice_key_uq").on(
      table.practiceId,
      table.key,
    ),
    /** Hot path: which rules to evaluate for an incoming event type. */
    triggerIdx: index("ext_auto_rules_trigger_idx").on(
      table.practiceId,
      table.triggerEvent,
      table.enabled,
    ),

    delayCheck: check("ext_auto_rules_delay_check", sql`${table.delayMinutes} >= 0`),
    cooldownCheck: check(
      "ext_auto_rules_cooldown_check",
      sql`${table.cooldownMinutes} >= 0`,
    ),
    capCheck: check(
      "ext_auto_rules_cap_check",
      sql`${table.maxFiresPerClientPerWeek} is null or ${table.maxFiresPerClientPerWeek} between 1 and 50`,
    ),
    windowCheck: check(
      "ext_auto_rules_window_check",
      sql`${table.validTo} is null or ${table.validFrom} is null or ${table.validFrom} < ${table.validTo}`,
    ),
    /** Write-time guard so a rule can never be authored without its action config. */
    actionConfigCheck: check(
      "ext_auto_rules_action_config_check",
      sql`jsonb_typeof(${table.actionConfig}) = 'object'`,
    ),
  }),
);

/* ----------------------------------------------------------------- */
/* ext_automation_settings — practice-level knobs (suppression §E)     */
/* ----------------------------------------------------------------- */

export const extAutomationSettings = pgTable(
  "ext_automation_settings",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id").notNull().references(() => practices.id),

    /** Global cooldown between any two outbound messages to the same client. */
    globalCooldownMinutes: integer("global_cooldown_minutes").notNull().default(60),
    /** Default per-campaign cooldown. */
    campaignCooldownMinutes: integer("campaign_cooldown_minutes").notNull().default(1440),
    /** Frequency cap: max N messages per client per rolling 7 days (replaces A.3.3). */
    frequencyCapPer7Days: integer("frequency_cap_per7days").notNull().default(3),

    /** Quiet hours resolved in the practice timezone (fixes A.3.2). */
    quietHoursStart: integer("quiet_hours_start").notNull().default(20),
    quietHoursEnd: integer("quiet_hours_end").notNull().default(8),
    quietHoursTimezone: varchar("quiet_hours_timezone", { length: 64 }),

    /** Sensitive period after a patient death, during which the whole household is quiet. */
    sympathyQuietDays: integer("sympathy_quiet_days").notNull().default(90),

    /** Master dry-run: nothing is sent, everything is logged. */
    dryRunGlobal: boolean("dry_run_global").notNull().default(false),
    /** Phase 2 only. Must default false and stay false in Phase 1. */
    autoPublishEnabled: boolean("auto_publish_enabled").notNull().default(false),

    inactiveRecallMonths: integer("inactive_recall_months").notNull().default(12),
    vaccinationRecallLeadDays: integer("vaccination_recall_lead_days").notNull().default(14),
    treatmentPlanNudgeDays: integer("treatment_plan_nudge_days").notNull().default(14),
  },
  (table) => ({
    practiceUq: uniqueIndex("ext_auto_settings_practice_uq").on(table.practiceId),
    quietCheck: check(
      "ext_auto_settings_quiet_check",
      sql`${table.quietHoursStart} between 0 and 23 and ${table.quietHoursEnd} between 0 and 23`,
    ),
    capCheck: check(
      "ext_auto_settings_cap_check",
      sql`${table.frequencyCapPer7Days} between 1 and 30`,
    ),
  }),
);

export const extAutomationRulesRelations = relations(
  extAutomationRules,
  ({ one }) => ({
    practice: one(practices, {
      fields: [extAutomationRules.practiceId],
      references: [practices.id],
    }),
    creator: one(users, {
      fields: [extAutomationRules.createdBy],
      references: [users.id],
      relationName: "ruleCreator",
    }),
    updater: one(users, {
      fields: [extAutomationRules.updatedBy],
      references: [users.id],
      relationName: "ruleUpdater",
    }),
  }),
);

export const extAutomationSettingsRelations = relations(
  extAutomationSettings,
  ({ one }) => ({
    practice: one(practices, {
      fields: [extAutomationSettings.practiceId],
      references: [practices.id],
    }),
  }),
);
```

> **Note on `pgEnumDelayAnchor`** — declare it as a module-level
> `const extAutomationDelayAnchorEnum = pgEnum("ext_automation_delay_anchor",
> ["event", "appointment", "due_date", "enrollment"])` and reference
> `extAutomationDelayAnchorEnum("delay_anchor")`. Written inline above only to keep the
> block readable.

### C.3 Practice overrides and seeding

Follows the pattern `listAutomationRules` already uses — seed defaults into the practice on
first access [VERIFIED: apps/web/server/routers/extensions/marketing.ts:2041-2107] — but
fixes the two ways that seeding is broken today (#8, #19) by deriving seeded rows from the
`TRIGGERS` map rather than a hand-maintained literal, so a seeded rule's `triggerEvent` is
**always** a real event type.

- `scope: 'seeded'` rows carry a `seedKey`. "Restore default" re-copies from the system
  definition by `seedKey`; "customise" flips the row to `scope: 'practice'`.
- No nullable `practiceId`, therefore no cross-tenant reads and no change to the
  tenant-scoping conventions already enforced elsewhere
  (e.g. the composite tenant FKs in `care_reminders` [VERIFIED: care-reminders.ts:86-105]).

### C.4 Dry-run

Three levels, all writing `ext_event_reactions.outcome = 'dry_run'`:

1. **Per-rule** — `dryRun: true` on the row. The rule evaluates, conditions are matched,
   the effect is *constructed but not applied*, and the full intended effect is serialised
   into `detail`.
2. **Per-practice** — `ext_automation_settings.dryRunGlobal`.
3. **Ad-hoc simulation** — a router `automation.simulate` that replays the last N events of a
   chosen type (or a synthetic event) through the engine with a flag on the context, without
   persisting effects. Returns `{ruleKey, matched, conditions: RuleConditionExplanation[],
   wouldDo: Effect}[]`.

Because `RuleConditionExplanation` records `expected`/`actual` per leaf, staff can see
*why* a client did or did not enter a journey — a requirement for trust in an automated
system, and cheap to build since the evaluator returns it by construction.

### C.5 Migration from the existing rules

Keep `ext_marketing_automation_rules` **in place and untouched** (it is ext_ schema, so
deleting it is optional, not mandated) but stop consulting it in `createMessagesForTrigger`.
Provide a one-shot backfill that copies its `enabled` flags into the new table so practices
that deliberately turned a rule off stay off. **[ASPIRATIONAL]**

---

## §D. Proposed journey engine

### D.1 Requirements recap

Timed step sequences; branching; per-step delivery tracking (delivered/opened/clicked);
suppression enforcement; pause/resume/cancel per client.

### D.2 Schema — `packages/db/schema/ext_automation_journeys.ts`

```ts
// packages/db/schema/ext_automation_journeys.ts
import {
  boolean, check, index, integer, jsonb, pgEnum, pgTable,
  text, timestamp, uniqueIndex, uuid, varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { clients } from "./clients";
import { users } from "./users";
import { extEventTypeEnum } from "./ext_automation_events";
import {
  extMarketingMessageLogs,
  extMarketingStaffTasks,
  extMarketingContentItems,
} from "./ext_marketing";
import { communications } from "./communications";

/* ================================================================== */
/* DEFINITION LAYER                                                    */
/* ================================================================== */

export const extJourneyStatusEnum = pgEnum("ext_journey_status", [
  "draft", "active", "paused", "archived",
]);

export const extJourneys = pgTable(
  "ext_journeys",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id").notNull().references(() => practices.id),

    key: varchar("key", { length: 80 }).notNull(),
    seedKey: varchar("seed_key", { length: 80 }),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description").notNull().default(""),

    triggerEvent: extEventTypeEnum("trigger_event").notNull(),

    status: extJourneyStatusEnum("status").notNull().default("draft"),
    /** Bumped on every edit; enrollments pin the version they started on. */
    version: integer("version").notNull().default(1),

    /** Restart policy when the trigger fires again for the same client. */
    restartPolicy: pgEnumRestartPolicy("restart_policy").notNull().default("once_per_patient"),
    /** Max concurrent active enrollments per client (blast protection). */
    maxActivePerClient: integer("max_active_per_client").notNull().default(2),

    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (table) => ({
    practiceKeyUq: uniqueIndex("ext_journeys_practice_key_uq").on(
      table.practiceId, table.key,
    ),
    triggerIdx: index("ext_journeys_trigger_idx").on(
      table.practiceId, table.triggerEvent, table.status,
    ),
    versionCheck: check("ext_journeys_version_check", sql`${table.version} >= 1`),
    maxActiveCheck: check(
      "ext_journeys_max_active_check",
      sql`${table.maxActivePerClient} between 1 and 10`,
    ),
  }),
);

export const extJourneyStepActionEnum = pgEnum("ext_journey_step_action", [
  "send_message",
  "branch",              // evaluate conditions, jump or exit
  "wait_for_event",      // pause until an event arrives or timeout elapses
  "create_staff_task",
  "create_content_brief",
]);

export const extJourneySteps = pgTable(
  "ext_journey_steps",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id").notNull().references(() => practices.id),
    journeyId: uuid("journey_id")
      .notNull()
      .references(() => extJourneys.id, { onDelete: "cascade" }),

    key: varchar("key", { length: 80 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),

    action: extJourneyStepActionEnum("action").notNull(),

    /** Delay for this step. */
    delayMinutes: integer("delay_minutes").notNull().default(0),
    delayAnchor: pgEnumStepAnchor("delay_anchor").notNull().default("previous_step"),

    /** send_message */
    channel: varchar("channel", { length: 16 }), // sms | email
    templateKey: varchar("template_key", { length: 80 }),
    legalBasis: varchar("legal_basis", { length: 32 }).notNull().default("contract"),

    /** branch / wait_for_event */
    conditions: jsonb("conditions").$type<RuleCondition | null>(),
    /** branch: [{ when: RuleCondition, goto: stepKey | "exit" }] */
    branchConfig: jsonb("branch_config").$type<
      { when: RuleCondition; goto: string }[] | null
    >(),
    /** wait_for_event: which event releases the wait, and what happens on timeout */
    waitEventType: extEventTypeEnum("wait_event_type"),
    waitTimeoutMinutes: integer("wait_timeout_minutes"),
    waitTimeoutGoto: varchar("wait_timeout_goto", { length: 80 }),

    /** Human approval required before this step's content goes out (AI drafts). */
    requiresApproval: boolean("requires_approval").notNull().default(false),
  },
  (table) => ({
    journeyKeyUq: uniqueIndex("ext_journey_steps_journey_key_uq").on(
      table.journeyId, table.key,
    ),
    orderIdx: index("ext_journey_steps_order_idx").on(
      table.journeyId, table.sortOrder,
    ),
    delayCheck: check(
      "ext_journey_steps_delay_check",
      sql`${table.delayMinutes} >= 0`,
    ),
    /** A send step must name a template and a channel. */
    sendShapeCheck: check(
      "ext_journey_steps_send_shape_check",
      sql`${table.action} <> 'send_message'
            or (${table.templateKey} is not null and ${table.channel} in ('sms','email'))`,
    ),
    branchShapeCheck: check(
      "ext_journey_steps_branch_shape_check",
      sql`${table.action} <> 'branch' or jsonb_typeof(${table.branchConfig}) = 'array'`,
    ),
  }),
);

/**
 * Exit triggers: "if the client books, leave the rebook journey".
 * Modelled as rows (not just journey.exitConditions) so each can carry its own
 * condition set and be individually audited.
 */
export const extJourneyExitTriggers = pgTable(
  "ext_journey_exit_triggers",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id").notNull().references(() => practices.id),
    journeyId: uuid("journey_id")
      .notNull()
      .references(() => extJourneys.id, { onDelete: "cascade" }),
    eventType: extEventTypeEnum("event_type").notNull(),
    conditions: jsonb("conditions").$type<RuleCondition | null>(),
    exitReason: varchar("exit_reason", { length: 80 }).notNull(),
  },
  (table) => ({
    journeyEventIdx: index("ext_journey_exit_idx").on(
      table.journeyId, table.eventType,
    ),
  }),
);

/* ================================================================== */
/* RUNTIME LAYER                                                       */
/* ================================================================== */

export const extJourneyEnrollmentStatusEnum = pgEnum("ext_journey_enrollment_status", [
  "active",
  "waiting",   // parked on a wait_for_event step
  "paused",    // staff or system paused; nextRunAt ignored while paused
  "completed",
  "exited",    // exit trigger fired — success path out
  "cancelled", // staff or sympathy gate — terminal
]);

export const extJourneyEnrollments = pgTable(
  "ext_journey_enrollments",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id").notNull().references(() => practices.id),
    journeyId: uuid("journey_id").notNull().references(() => extJourneys.id),
    /** Pinned so mid-flight definition edits cannot mutate a running journey. */
    journeyVersion: integer("journey_version").notNull(),

    clientId: uuid("client_id").notNull().references(() => clients.id),
    patientId: uuid("patient_id").references(() => patients.id),

    triggerEventId: uuid("trigger_event_id"), // → ext_events.id

    status: extJourneyEnrollmentStatusEnum("status").notNull().default("active"),
    currentStepId: uuid("current_step_id"),
    /** Next time the drain should look at this enrollment. */
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),

    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    exitedAt: timestamp("exited_at", { withTimezone: true }),
    exitReason: varchar("exit_reason", { length: 120 }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
    cancelReason: varchar("cancel_reason", { length: 200 }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    pausedBy: uuid("paused_by").references(() => users.id),
    restartCount: integer("restart_count").notNull().default(0),

    /**
     * Consent state captured at enrolment. GDPR accountability: we must be able
     * to prove the lawful basis that applied when the message went out, not
     * whatever it has since become.
     */
    consentSnapshot: jsonb("consent_snapshot").$type<{
      smsConsent: boolean;
      smsConsentAt: string | null;
      marketingMessagesConsent: boolean | null;
      legalBasis: string;
      capturedAt: string;
    }>(),
    /** Facts resolved at enrolment (species, age, segments) — powers conditions. */
    context: jsonb("context").$type<Record<string, unknown>>(),
  },
  (table) => ({
    /** Drain hot path. */
    dueIdx: index("ext_journey_enroll_due_idx")
      .on(table.nextRunAt)
      .where(sql`${table.status} in ('active','waiting')`),
    practiceStatusIdx: index("ext_journey_enroll_practice_status_idx").on(
      table.practiceId, table.status, table.enrolledAt,
    ),
    /** One active enrollment per (journey, client, patient) — enrolment idempotency. */
    activeUq: uniqueIndex("ext_journey_enroll_active_uq")
      .on(table.practiceId, table.journeyId, table.clientId, table.patientId)
      .where(sql`${table.status} in ('active','waiting','paused')`),
    clientIdx: index("ext_journey_enroll_client_idx").on(
      table.practiceId, table.clientId, table.status,
    ),
    patientIdx: index("ext_journey_enroll_patient_idx").on(
      table.practiceId, table.patientId,
    ),
    terminalStateCheck: check(
      "ext_journey_enroll_terminal_check",
      sql`(${table.status} in ('completed','exited','cancelled'))
            = (${table.completedAt} is not null
               or ${table.exitedAt} is not null
               or ${table.cancelledAt} is not null)`,
    ),
    restartCheck: check(
      "ext_journey_enroll_restart_check",
      sql`${table.restartCount} >= 0`,
    ),
  }),
);

export const extJourneyStepRunStatusEnum = pgEnum("ext_journey_step_run_status", [
  "scheduled",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "failed",
  "skipped",      // branch not taken, or definition no longer has this step
  "suppressed",   // blocked by the suppression engine — reason recorded
  "awaiting_approval",
]);

export const extJourneyStepRuns = pgTable(
  "ext_journey_step_runs",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id").notNull().references(() => practices.id),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => extJourneyEnrollments.id, { onDelete: "cascade" }),
    stepId: uuid("step_id").notNull(),
    stepKey: varchar("step_key", { length: 80 }).notNull(),
    attempt: integer("attempt").notNull().default(1),

    status: extJourneyStepRunStatusEnum("status").notNull().default("scheduled"),
    channel: varchar("channel", { length: 16 }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),

    /** Suppression outcome, if any. Enum in §E. */
    suppressionReason: varchar("suppression_reason", { length: 64 }),

    /** Reuse existing delivery infrastructure rather than reinventing it. */
    messageLogId: uuid("message_log_id").references(() => extMarketingMessageLogs.id),
    communicationId: uuid("communication_id").references(() => communications.id),
    staffTaskId: uuid("staff_task_id").references(() => extMarketingStaffTasks.id),
    contentItemId: uuid("content_item_id").references(() => extMarketingContentItems.id),

    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    errorText: text("error_text"),

    /** Idempotency across drain retries. */
    dedupeKey: varchar("dedupe_key", { length: 200 }).notNull(),
  },
  (table) => ({
    dedupeUq: uniqueIndex("ext_journey_step_run_dedupe_uq").on(
      table.practiceId, table.dedupeKey,
    ),
    enrollmentIdx: index("ext_journey_step_run_enroll_idx").on(
      table.enrollmentId, table.scheduledFor,
    ),
    /** Delivery-webhook lookup by provider message id happens on communications,
        so this index serves the reporting queries. */
    statusIdx: index("ext_journey_step_run_status_idx").on(
      table.practiceId, table.status, table.scheduledFor,
    ),
    attemptCheck: check(
      "ext_journey_step_run_attempt_check",
      sql`${table.attempt} between 1 and 10`,
    ),
    /** Monotonic funnel: never record a later stage without the earlier one. */
    funnelCheck: check(
      "ext_journey_step_run_funnel_check",
      sql`${table.deliveredAt} is null or ${table.sentAt} is not null`,
    ),
    suppressionShapeCheck: check(
      "ext_journey_step_run_suppression_check",
      sql`(${table.status} = 'suppressed') = (${table.suppressionReason} is not null)`,
    ),
  }),
);
```

> **Enum declarations omitted for brevity** — declare `extJourneyRestartPolicyEnum`
> (`"allow" | "once_per_client" | "once_per_patient"`) and
> `extJourneyStepAnchorEnum` (`"enrollment" | "previous_step" | "event"`) at module level and
> substitute into the two inline placeholders above.

### D.3 Semantics

**Enrolment.** The rules engine's `enroll_journey` action creates an enrollment with
`journeyVersion` pinned, a `consentSnapshot`, and a resolved `context`. The
`activeUq` partial-unique index makes re-enrolment idempotent: a duplicate trigger cannot
create a second live enrollment. `restartPolicy` governs what happens when the trigger fires
again after the previous enrollment completed.

**Advance loop** (`/api/cron/automation`): select enrollments where
`status ∈ ('active','waiting')` and `nextRunAt <= now`, `FOR UPDATE SKIP LOCKED`. For each,
resolve the next step from the pinned definition version, evaluate
**suppression first** (§E), then branch conditions, then act, then write a step-run and set
`nextRunAt` for the following step.

**Branching.** Two mechanisms, both data-driven:
- `branch` steps evaluate `branchConfig` in order and `goto` a step key or `"exit"`.
- `extJourneyExitTriggers` are evaluated by the **event** drain: when an event arrives, every
  active enrollment for that client whose journey has a matching exit trigger is checked and
  exited. This is how "if client books → exit journey" works without polling.

**Suppression is re-checked at send time, not only at schedule time.** A patient can die
between scheduling and sending. The gate must hold at the last instant, which is why
`extJourneyStepRuns.suppressionReason` exists and why the sympathy check runs inside the
send path (correcting A.3.5).

**Pause / resume / cancel.** `paused` keeps the row but the due-index excludes it; resuming
recomputes `nextRunAt` from `now` (not from the original schedule, so a journey paused for a
month does not fire twelve backlogged messages). `cancelled` is terminal and records
`cancelledBy` + `cancelReason`.

**Delivery status.** `sent`/`delivered` come from the existing SMS provider-event pipeline
and `communications` table [VERIFIED: `sms_provider_events` schema, `communications.status`
enum `pending|sent|delivered|read|failed`]. `opened`/`clicked` require an email tracking
pixel/link wrapper — **[ASPIRATIONAL]** for Phase 1; the columns exist so no migration is
needed later.

**Not reinvented.** Step runs intentionally reference
`ext_marketing_message_logs` (existing render + idempotency key machinery
[VERIFIED: ext_marketing.ts:296-315]), `communications` (existing durable SMS claim
machinery [VERIFIED: apps/web/lib/messaging/durable-sms-communication.ts]), and
`ext_marketing_staff_tasks` (existing condolence/escalation task type
[VERIFIED: ext_marketing.ts:320-333]). The journey engine orchestrates; it does not replace
the delivery layer.

---

## §E. Suppression engine gap analysis

### E.1 Signal-by-signal

Legend — **Enforced where**: the code path that currently blocks. **Gap**: what is missing.

| # | Signal | Enforced where (verified) | Gap | New table / field needed |
|---|---|---|---|---|
| 1 | **Deceased patient gate** | Five places: (a) `careReminders.list` filters `patients.status is distinct from 'deceased'` for open reminders [care-reminders.ts:172]; (b) `careReminders.sendOutreach` throws "Sympathy Gate: Reminders cannot be sent for a deceased patient." [care-reminders.ts:376-380]; (c) `createMessagesForTrigger` returns early and calls `applySympathyGate` when the patient is deceased, **and** when no patient is supplied checks whether *all* the client's non-deleted patients are deceased [messaging.ts:126-158]; (d) `processQueue` before send [messaging.ts:410-421]; (e) `assertPatientNotDeceased` guards extension-router entries [_safety.ts:79-93]. `applySympathyGate` dismisses open care reminders with the Slovak reason string, creates a `condolence` staff task, and blocks queued messages [messaging.ts:467-565] | **(a) Not unconditional.** `processQueue` blocks only if `legalBasis==='consent'` **OR** `templateKey ∈ SYMPATHY_BLOCKED = {vaccine_due, review_request, thank_you, postop_check, marketing_blast}` [messaging.ts:24-30, 414]. A `contract`-basis message with any other template key is **not** blocked by this check. SKILL.md §3 requires unconditional blocking. **(b) One-shot only.** `applySympathyGate` blocks rows that are `queued` *at that instant* [messaging.ts:500-522]; it cannot cancel journeys or future steps that do not exist yet. **(c) No household quiet period.** The multi-pet rule only triggers when *all* patients are deceased — one surviving pet means full marketing to a grieving household. **(d) Nothing sets a durable block**, so every downstream component must independently remember to check | `ext_suppressions` row with `reason='deceased_patient'`, `scope='patient'`, `endsAt = now() + settings.sympathyQuietDays`; plus a household-level row with `scope='client'` and `reason='sensitive_period'`. Every check becomes one query against one table |
| 2 | **Marketing opt-out** | SMS: hard gate at the dispatcher, which queries `sms_suppressions` by `(practiceId, phone)` immediately before send [apps/web/lib/sms-dispatch.ts:1000-1012]. Table keyed by E.164 phone, practice-wide per TCPA, reasons `stop \| manual \| bounce \| complaint` [packages/db/schema/messaging.ts:187-232]. Email: `email_suppressions` keyed by `(practiceId, lower(email))`, reasons `manual \| bounce \| complaint \| suppressed` [messaging.ts:194-257], enforced **only** at call sites that opt in — `careReminders.sendOutreach` [care-reminders.ts:348-354, 410-416] and the reminders cron | **(a) Orphaned helper.** `isSuppressed()` in `lib/messaging/suppression.ts` has **zero call sites** — it is exported and re-exported and never used [verified by grep: only definition at suppression.ts:40 and re-export at messaging/index.ts:20]. **(b) Email suppression is opt-in, not automatic.** `lib/email.ts` contains no suppression check at all [verified by grep]. Any new email path — journey emails, receipts, newsletters — silently bypasses the do-not-email list. **(c) Neither list is linked to `clientId`.** A phone/email change or a merged client can drift out of suppression. **(d) `marketingConsentOk` does not consult either table** — it checks `clients.smsConsent` and the `marketing_messages` scope of `ext_marketing_media_consents` only [messaging.ts:604-629] | Optional `clientId` FK on both suppression tables (**needs upstream `clients` — so instead** an `ext_suppressions` row mirroring both, keyed by client, with the phone/email recorded at suppression time for audit). A single `assertNotSuppressed()` called by **every** outbound path, email included |
| 3 | **Communication cooldown** (global + per-campaign) | No global cooldown. The only throttle is `smsRateLimitOk`, which requires **zero** sends in the window [sms-rate-limit.ts:5-23], called at create [messaging.ts:167] and at send [messaging.ts:435] — a zero-tolerance gate, not a cooldown (see A.3.3). Email is entirely unthrottled | No configurable cooldown; no per-campaign cooldown; email unthrottled. The `suppressed_rate` status exists in the enum [ext_marketing.ts:281-286] but is driven by the wrong predicate | `ext_automation_settings.globalCooldownMinutes`, `.campaignCooldownMinutes`; per-rule `cooldownMinutes` (§C). Enforced against `ext_marketing_message_logs.sentAt` + `ext_journey_step_runs.sentAt`, which together give a real send history per client |
| 4 | **Frequency cap** (max N per client per 7 days) | **Not implemented.** `smsRateLimitOk` cannot express "max N" — it returns `count === 0` [sms-rate-limit.ts:20]. `brand.marketingRateLimitDays` exists in `ClinicBrand` [planner.ts:30] and is passed as `windowDays`, but the predicate is still zero-tolerance | No cap of any kind; no email cap; no cross-channel cap (2 SMS + 3 emails = 5 touches is currently possible in one day) | `ext_automation_settings.frequencyCapPer7Days` counted across **all** channels, and per-rule `maxFiresPerClientPerWeek`. Replace the `=== 0` predicate with `count < cap` |
| 5 | **Quiet hours** | Two implementations. Correct: `isQuietHours(now, timeZone)` resolves the practice IANA timezone and fails closed at 21:00–08:00 [lib/messaging/reminders.ts:9-37], used by `careReminders.sendOutreach` [care-reminders.ts:434-440] and `lib/sms-dispatch.ts` [L748, L1047]. Incorrect: `isQuiet()` in the marketing engine uses `now.getHours()` — server-local — and is used by `processQueue` and `nextAllowedTime` [messaging.ts:71-96] | **The marketing engine uses the wrong clock** (A.3.2). On UTC servers (Vercel default) a `Europe/Bratislava` 20:00–08:00 window is enforced as 22:00–10:00 in summer — messages land at 06:00 local. Also: quiet hours **defer** for SMS but there is no equivalent deferral for email or for journey steps | Retire `isQuiet()`; call `isQuietHours(now, practiceTimezone)` everywhere. Add `ext_automation_settings.quietHoursStart/End/Timezone`. Journey steps defer via `nextRunAt`, reusing `nextAllowedTime`'s logic but timezone-aware |
| 6 | **Sensitive period** (recently deceased, open incident) | **Only the deceased part, and only as described in #1.** There is **no complaint or incident register in the codebase** — `ext_support.ts` contains `ext_support_sessions` and `ext_support_session_audit`, which are support-tooling tables, not a client-complaint register [verified: ext_support.ts:7, 22] | No concept of a sensitive period; no complaint/incident entity to key one off; no household-level quiet | `ext_suppressions` with `reason ∈ {sensitive_period, active_complaint, legal_dispute}`, `startsAt`/`endsAt`, `scope ∈ {client, patient}`. Optional `ext_client_incidents` if the owner wants incident tracking as a product feature (§G.Q7) |
| 7 | **Recovery hold** | Correct and well-built. `lockPracticeForExternalSideEffects` takes a `FOR SHARE` lock on the practice row and returns `recoveryHold === false` [recovery-hold.ts:31-45]; called at the top of `careReminders.sendOutreach` [care-reminders.ts:300-306], inside `dispatchWebhookEvent` [webhook-dispatcher.ts:26-33], and in the reminders cron. The flag itself carries mandatory evidence (`recoveryHoldReason` + `recoveryHoldSetAt` non-null whenever held) enforced by a check constraint [practices.ts:100-104] | **No gap in the mechanism.** Gap is coverage: the marketing engine (`processQueue`, `createMessagesForTrigger`) never calls it. Harmless today because nothing is actually sent (A.3.1); **it becomes a live P0 the moment a provider is wired in** | No new field. Requirement: every handler in the new drain calls `lockPracticeForExternalSideEffects` before any external side effect, exactly as `dispatchWebhookEvent` already does |
| 8 | **Manual block** (staff "no marketing" flag) | No such flag on the client record. `clients` has `preferredContactMethod`, `smsConsent`, `smsConsentAt`, `smsConsentSource`, `smsConsentDisclosure` [packages/db/schema/clients.ts:46-55] — consent for SMS, but no general "do not market to this person" switch. Staff can achieve a partial block by adding a row to `sms_suppressions` with `reason='manual'` [messaging.ts:190], but there is no UI for it and no email equivalent | No client-level marketing block; no email equivalent; no UI | `ext_suppressions` row, `reason='manual_block'`, `scope='client'`, `endsAt` nullable (permanent) or set (temporary). Surface in the client edit screen (§F.4) |
| 9 | **Treatment sensitivity** (grief, legal dispute) | **Not implemented.** No field, no table, no check | Total gap | `ext_suppressions` with `reason='legal_dispute'` / `'sensitive_period'`, `scope='client'`, staff-set with a mandatory note |

### E.2 Proposed suppression schema — `packages/db/schema/ext_automation_suppressions.ts`

One table, one query, one answer. Every outbound path — care reminders, marketing messages,
journey steps, newsletters, review asks — calls `evaluateSuppression()` and receives a
verdict plus a machine-readable reason.

```ts
// packages/db/schema/ext_automation_suppressions.ts
import {
  check, index, pgEnum, pgTable, text, timestamp,
  uniqueIndex, uuid, varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { clients } from "./clients";
import { users } from "./users";

export const extSuppressionReasonEnum = pgEnum("ext_suppression_reason", [
  "deceased_patient",   // sympathy gate — never requires staff action to set
  "sensitive_period",   // household quiet after a death
  "marketing_opt_out",  // client withdrew marketing consent
  "manual_block",       // staff flagged "no marketing"
  "active_complaint",
  "legal_dispute",
  "quiet_hours",        // transient, typically not persisted
  "frequency_cap",      // transient
  "cooldown",           // transient
  "recovery_hold",      // transient, mirrors practices.recoveryHold
]);

export const extSuppressionScopeEnum = pgEnum("ext_suppression_scope", [
  "client", "patient", "household",
]);

export const extSuppressionChannelEnum = pgEnum("ext_suppression_channel", [
  "all", "sms", "email", "push", "social",
]);

export const extSuppressionSourceEnum = pgEnum("ext_suppression_source", [
  "staff",      // set in the UI
  "system",     // set by the sympathy gate
  "client",     // opt-out link / STOP reply
  "import",     // migrated from sms_suppressions / email_suppressions
  "webhook",    // provider bounce/complaint
]);

export const extSuppressions = pgTable(
  "ext_suppressions",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id").notNull().references(() => practices.id),

    scope: extSuppressionScopeEnum("scope").notNull(),
    clientId: uuid("client_id").references(() => clients.id),
    patientId: uuid("patient_id").references(() => patients.id),

    channelScope: extSuppressionChannelEnum("channel_scope")
      .notNull()
      .default("all"),

    reason: extSuppressionReasonEnum("reason").notNull(),
    source: extSuppressionSourceEnum("source").notNull().default("staff"),

    /** Contact details captured at suppression time — audit trail survives a
        later phone/email change on the client record. */
    phoneE164: varchar("phone_e164", { length: 32 }),
    emailLower: varchar("email_lower", { length: 255 }),

    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    /** null = permanent. Sensitive periods and temporary blocks set an end. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedBy: uuid("released_by").references(() => users.id),
    releaseNote: text("release_note"),
  },
  (table) => ({
    /** The one query every send path runs: active suppressions for a client. */
    clientActiveIdx: index("ext_suppressions_client_active_idx")
      .on(table.practiceId, table.clientId, table.channelScope)
      .where(sql`${table.releasedAt} is null`),
    patientActiveIdx: index("ext_suppressions_patient_active_idx")
      .on(table.practiceId, table.patientId)
      .where(sql`${table.releasedAt} is null`),

    /** No duplicate active block for the same subject + channel + reason. */
    activeUq: uniqueIndex("ext_suppressions_active_uq")
      .on(table.practiceId, table.scope, table.clientId, table.patientId,
          table.channelScope, table.reason)
      .where(sql`${table.releasedAt} is null and ${table.endsAt} is null`),

    subjectCheck: check(
      "ext_suppressions_subject_check",
      sql`(${table.scope} = 'client'   and ${table.clientId} is not null)
       or (${table.scope} = 'patient'  and ${table.patientId} is not null)
       or (${table.scope} = 'household' and ${table.clientId} is not null)`,
    ),
    windowCheck: check(
      "ext_suppressions_window_check",
      sql`${table.endsAt} is null or ${table.endsAt} > ${table.startsAt}`,
    ),
    releaseCheck: check(
      "ext_suppressions_release_check",
      sql`${table.releasedAt} is null
            or (${table.releasedBy} is not null and ${table.releaseNote} is not null)`,
    ),
    /** A system-set sympathy block must never be silently editable without a note. */
    auditNoteCheck: check(
      "ext_suppressions_audit_note_check",
      sql`${table.source} <> 'staff' or length(btrim(coalesce(${table.note}, ''))) > 0`,
    ),
  }),
);

export const extSuppressionsRelations = relations(extSuppressions, ({ one }) => ({
  practice: one(practices, {
    fields: [extSuppressions.practiceId], references: [practices.id],
  }),
  client: one(clients, {
    fields: [extSuppressions.clientId], references: [clients.id],
  }),
  patient: one(patients, {
    fields: [extSuppressions.patientId], references: [patients.id],
  }),
  creator: one(users, {
    fields: [extSuppressions.createdBy], references: [users.id],
    relationName: "suppressionCreator",
  }),
  releaser: one(users, {
    fields: [extSuppressions.releasedBy], references: [users.id],
    relationName: "suppressionReleaser",
  }),
}));
```

### E.3 The unified gate

```ts
// apps/web/lib/automation/suppression.ts — [ASPIRATIONAL]
export type SuppressionVerdict =
  | { allowed: true }
  | { allowed: false; reason: ExtSuppressionReason; explanation: string; retryAt?: Date };

/**
 * Ordering matters — cheapest and most absolute first.
 * Called (a) when a journey step is scheduled and (b) again immediately
 * before every send, because state can change in between.
 */
export async function evaluateSuppression(ctx: {
  practiceId: string;
  clientId: string;
  patientId?: string | null;
  channel: "sms" | "email" | "social";
  legalBasis: "contract" | "consent" | "legitimate_interest";
  now: Date;
}): Promise<SuppressionVerdict> {
  // 1. recovery hold      → lockPracticeForExternalSideEffects      [existing]
  // 2. deceased patient   → ext_suppressions reason=deceased_patient
  // 3. sensitive period   → ext_suppressions reason=sensitive_period|active_complaint|legal_dispute
  // 4. manual block       → ext_suppressions reason=manual_block
  // 5. opt-out            → ext_suppressions OR legacy sms_suppressions / email_suppressions
  // 6. quiet hours        → isQuietHours(now, practiceTimezone)      [existing, correct]
  // 7. cooldown           → settings.globalCooldownMinutes
  // 8. frequency cap      → settings.frequencyCapPer7Days
}
```

**Hard invariants (non-negotiable, per SKILL.md §3):**

1. Steps 1–4 are **unconditional**. `legalBasis` and `templateKey` are **not consulted**.
   A `contract`-basis transactional message is still blocked if the patient is deceased.
   This is the explicit fix for A.3.5.
2. `suppressionExempt` on a rule (§C.2) must be **ignored** for steps 1–4. It may only
   relax steps 7–8. Enforce in code, and assert it in a test.
3. Suppression is evaluated **twice**: at schedule time (to avoid creating doomed work) and
   at send time (to catch state changes). Journey step runs record
   `status='suppressed'` + `suppressionReason` in both cases.
4. Every suppression is auditable: the `ext_suppressions` row plus the
   `ext_event_reactions` row with `outcome='suppressed'` and the same `traceId` give a
   complete "why didn't this client get the message" answer.

---

## §F. What can be built in Phase 1 using ONLY existing tables

**No new schema at all.** This is the highest-value slice and it is larger than it looks,
because the existing schema already contains almost everything — it is the *wiring* that is
missing.

### F.1 Fix the three live defects (do these first — they are bugs, not features)

| # | Fix | Change | Why it is Phase 1 |
|---|---|---|---|
| F.1.1 | **Make the visit-close trigger reachable** | Add the marketing side-effect block from `appointments.ts:1395-1440` into `encounters.completeCheckout`, after the transaction commits [VERIFIED: encounters.ts:2581]. Better: extract to a shared helper called from both | Without this, "visit closed → thank-you → review ask" — the flagship flow — never runs. No schema change. **This is the single highest-value line of code in the whole programme** |
| F.1.2 | **Fix the fallback-template crash** | Add `version: 1` and `legalBasis: 'contract'` to the object returned by `pickTemplate` [VERIFIED: messaging.ts:290-304], or better, seed default templates on practice creation | Prevents a clinician's discharge finalisation failing (A.3.4). No schema change |
| F.1.3 | **Make quiet hours timezone-aware** | Delete `isQuiet`/`nextAllowedTime` from `messaging.ts:71-96`; import `isQuietHours` from `@/lib/messaging/reminders` [VERIFIED: reminders.ts:17] and add a timezone-aware `nextAllowedAt` | Correctness fix (A.3.2). No schema change. Reuses tested code |

### F.2 Reach the existing events that already exist but have no consumer

Using `ext_marketing_message_logs`, `ext_marketing_message_templates`,
`ext_marketing_automation_rules`, `ext_marketing_staff_tasks`, `ext_sms_delivery_log`,
`care_reminders`, `communications` — all of which exist today:

1. **Post-discharge check-in** — already works [VERIFIED: discharge.ts:606-638]. Enable it
   per practice via the existing `ext_marketing_recall_schedules.postVisitHandoutEnabled`
   flag, which is already read [VERIFIED: messaging.ts:574-579].
2. **Dental and senior journeys** — already work via regex/age heuristics
   [VERIFIED: messaging.ts:643-707]. Make the dental regex and the age thresholds
   configurable by storing them in `practices.settings` (the established location for brand
   config [VERIFIED: planner.ts:38-56]) — no migration needed.
3. **No-show rebook** — already wired [VERIFIED: appointments.ts:1408-1423].
4. **Appointment reminders** — the existing `/api/cron/reminders` route already does this
   properly, with the correct timezone-aware quiet-hours handling and suppression checks.
   Extend, do not rewrite.

### F.3 Build the missing computed events without new tables

Each of these is a **new cron route + a query over existing tables**, writing into the
existing `ext_marketing_message_logs` queue via `createMessagesForTrigger`:

| Event | Query over existing tables | Notes |
|---|---|---|
| `vaccine.due` | `vaccination_records` where `next_due_date` between today and today + lead days. **The index already exists**: `vaccination_records_practice_due_idx` on `(practiceId, nextDueDate, deletedAt)` [VERIFIED: clinical.ts] | Reads `ext_marketing_recall_schedules.vaccinationRecallLeadDays`, which is currently dead config (#8) |
| `patient.inactive` | Clients with no `appointments` row at `status='checked_out'` within `inactiveRecallMonths` | Reads `ext_marketing_recall_schedules.inactiveRecallMonths`, currently dead config (#25) |
| `treatment_plan.incomplete` | `visit_treatment_plan_presentations` where `status='pending'` and `expiresAt < now()` [VERIFIED: treatment-plan-evidence.ts:313] | Exactly the pillar-5 "treatment plan nudge" |
| `content.approved` → digest | `ext_marketing_content_items` where `status='approved'` and `scheduledFor` <= now | Notification only. **Nothing auto-publishes in Phase 1** — that is the whole point of the manual-approval gate |

### F.4 Reputation inbox (partial)

`ext_marketing_reviews` already has every column needed: `platform`, `externalReviewId`,
`rating`, `reviewText`, `reviewerName`, `receivedAt`, `replyText`, `repliedAt`, `repliedBy`,
`requestSentAt`, `requestBlockedReason`
[VERIFIED: packages/db/schema/ext_marketing.ts:141-160].

Buildable in Phase 1 with zero schema change:
- Review inbox UI (list, filter unanswered, filter by platform) — the router procedures
  `listReviews` / `createReview` / `replyToReview` / `deleteReview` **already exist**
  [VERIFIED: marketing.ts:901-999].
- **AI reply draft**: generate via `configuredModel()` + `generateText`, insert as a *draft*
  requiring staff confirmation. Reuse `validateMarketingText({context:'review_reply'})`,
  which `replyToReview` already calls [VERIFIED: marketing.ts:978-983]. This satisfies the
  "never auto-commit without human confirmation" constraint.
- **Sentiment classification**: derive from `rating` (1–2★ negative, 3★ neutral, 4–5★
  positive) — no ML needed, and defensible. A `rating <= 2` writes an escalation staff task
  into the existing `ext_marketing_staff_tasks` with `kind='postop_escalation'`, whose
  `kind` comment already anticipates it [VERIFIED: ext_marketing.ts:320-333].
- **Suppression on negative review**: set a block so no review-ask goes to that client.

**Not** buildable in Phase 1: automatic ingestion. No Google Business or Facebook API
integration exists [VERIFIED: grep]. Ingestion is Phase 2 alongside publishing.

### F.5 Consent / suppression without new tables

- **Consent**: `ext_marketing_media_consents` already has the `marketing_messages` scope,
  `grantedAt`, `revokedAt`, `evidenceType` (`signature|sms_confirm|pdf`), and a
  `consentRequestId` FK [VERIFIED: ext_marketing.ts:23-46]. `marketingConsentOk` already
  reads it [VERIFIED: messaging.ts:604-629]. Complete as-is.
- **Opt-out**: `sms_suppressions` and `email_suppressions` exist with reasons and are
  practice-wide. Add the missing pieces: (a) call `isSuppressed()` — currently dead code
  (#2) — or better, call the dispatcher-level check that already works
  [VERIFIED: sms-dispatch.ts:1000-1012]; (b) **add an email suppression check to every email
  path**, since `lib/email.ts` has none.
- **Unsubscribe page**: `unsubscribeByToken` and `getUnsubscribeInfo` already exist as
  public procedures [VERIFIED: marketing.ts:2437, 2503], with a tokenised unsubscribe URL
  already rendered into templates [VERIFIED: messaging.ts:395]. Wire the token →
  `ext_marketing_media_consents.revokedAt` write.
- **Manual block**: no field exists on `clients`, and SKILL.md forbids touching
  `packages/db/schema/clients.ts`. **This one genuinely needs a new table** — it is the
  smallest possible justification for `ext_suppressions` landing in Phase 1 as a
  single-table addition rather than waiting for Phase 2.

### F.6 Content calendar with manual approval

Already complete: `ext_marketing_content_batches` (status `draft|in_review|approved`),
`ext_marketing_content_items` (status `proposed|approved|published|blocked|archived`,
`scheduledFor`, `approvedBy`, `approvedAt`, `validatorVerdict`, `validatorFindings`),
`ext_marketing_media_assets` with a consent check constraint
[VERIFIED: ext_marketing.ts:56-100, 111-122]. The `consentRequiredCheck` constraint already
enforces that media with `subjectsPresent = true` carries a `consentId`
[VERIFIED: ext_marketing.ts:75] — the photo-consent gate is already structurally enforced.
The validator (`apps/web/lib/marketing/validator.ts`) and composer, planner, recipes,
handout themes, and illustration modules all exist.

**Missing:** any path that sets `status='published'` or writes `publishedAt`. In Phase 1
that is correct — publishing is Phase 2 and must stay manual.

### F.7 Phase 1 scope recommendation

**Ship with zero new tables** except `ext_suppressions` (justified solely by the manual-block
gap, F.5) — and even that can be deferred if the owner accepts that "no marketing" is
expressed by revoking the `marketing_messages` consent scope, which already works.

Everything in §B/§C/§D — event bus, rules engine, journey engine — is **Phase 1.5**: it
requires no new external dependency and no architectural risk, but it is a meaningful
build. The honest sequencing is:

- **Phase 1a (this sprint):** F.1.1–F.1.3 + F.2 + F.4 + F.6. All existing tables. Delivers a
  working, human-approved automation and reputation workflow.
- **Phase 1b:** §B event bus only. Cheapest durable foundation; every later phase inherits it.
- **Phase 1c:** §C rules engine + §D journey engine, migrating the hardcoded `TRIGGERS` map
  into data.

Attempting §C and §D before §B means building a rules engine on top of the same inline
side-effect calls that already lost events (A.3.6). Sequence matters more than speed here.

---

## §G. Open questions for the product owner

**Q1 — Is `processQueue` intentionally a simulator?** It marks messages `delivered` without
calling any provider [VERIFIED: messaging.ts:376-465, import list L1-19]. If this is
deliberate scaffolding, fine. If it was believed to be live, then **no marketing message has
ever been sent**, and the Phase 1 demo plan needs revisiting. *This is the most important
question in this report.*

**Q2 — Priority between "make the flagship flow work" and "build the platform"?** F.1.1 is
roughly a day of work and unblocks "visit closed → thank-you → review ask" end to end using
only existing tables. The event bus is weeks. Which does the owner want first? My
recommendation is F.1.1 first, then §B — but that is a product call, not a technical one.

**Q3 — Enum vs. varchar for event types?** New `ext_event_type` values require
`ALTER TYPE … ADD VALUE`, which cannot run inside a transaction block on older Postgres. If
the owner expects practices or future phases to add event types frequently, use `varchar` +
app-level Zod validation instead. My default is `pgEnum` for the safety it buys, but it is a
real ergonomics trade-off.

**Q4 — What exactly counts as a "positive signal" for `review.request_eligible`?** Candidate
signals available today: visit `chargeDisposition` (not `accounts_receivable`), no
`no_show`/cancellation in the preceding 12 months, no open complaint, appointment was not a
euthanasia, client not already asked in the last N months. The owner should choose the rule;
guessing here risks asking for a review from a client whose pet just died.

**Q5 — Quiet-hours semantics per channel.** Should a deferred SMS fall back to email, or
always wait? `pickReminderChannel` already implements a fallback policy
[VERIFIED: lib/messaging/reminders.ts:46-68]. Should marketing inherit it, or should
marketing always wait? Different answer for a transactional reminder vs. a campaign.

**Q6 — Cross-pet household suppression.** SKILL.md says block when *all* of a client's pets
are deceased; the code implements exactly that [VERIFIED: messaging.ts:139-158]. Should a
**single** death quiet the whole household for a period (my `sensitive_period`
recommendation), or not? This is a tone-of-voice decision for the owner, not a technical
one — but it must be decided, because the current all-or-nothing rule will at some point
send a flea-treatment campaign to someone who buried a dog last week and still has a cat.

**Q7 — Is a complaint/incident register in scope?** Suppression signals #6 and #9 need
somewhere to record an active complaint or legal dispute. Nothing exists today
[VERIFIED: ext_support.ts contains only support-tooling tables]. Options: (a) `ext_suppressions`
alone (manual note, no workflow), (b) a small `ext_client_incidents` table with a lifecycle,
(c) defer and accept a free-text note field.

**Q8 — Phase 1 delivery provider.** `processQueue` sends nothing, so Phase 1 as scoped
delivers drafts and staff notifications. If the owner expects Phase 1 to actually send
email/SMS, that is an additional decision: which provider, which sending identity, and
whether to route through the existing `communications` + `sms_send_attempts` durable
pipeline (strongly recommended, since it already handles idempotency, provider events, and
the concurrency drill) or build a parallel path.

**Q9 — Language of automation content.** Message templates default to `sk`
[VERIFIED: ext_marketing.ts:340] and the seeded rules are Slovak
[VERIFIED: marketing.ts:2049-2105]. Should journeys and rules support per-client language
selection? `ClinicBrand` already carries `languages` and `defaultLanguage`
[VERIFIED: planner.ts:23-24], and `pickTemplate` already falls back through
language → default → first [VERIFIED: messaging.ts:306-315], so the machinery exists — the
question is whether per-client language routing is in scope.

**Q10 — Retention for the event log.** The event bus is append-only and will grow
indefinitely. The repo has a documented data-retention policy (`docs/data-retention-policy.md`)
and a 24-hour voice-purge rule [SKILL.md §6]. What is the retention window for
`ext_events` and `ext_event_reactions`? My default proposal: 24 months rolling, partitioned
by month, with reactions cascaded on delete. Needs the owner's confirmation against GDPR
minimisation obligations under Zákon č. 18/2018 Z. z.

**Q11 — Where does segmentation live?** The vision specifies 12 client segments. This
research deliberately does **not** design segmentation — it belongs to Agent 2 (CRM). The
rules engine depends on it via the `client.segment` condition field. Agent 1 and Agent 2 must
agree on the segment identifier format (`segmentKey` string in `ext_event_reactions`
context, or a resolved membership table) before §C is implemented.

---

## Appendix — artefact inventory for downstream agents

**Files that would need to change for §B/§C/§D** (all new or ext-only; **no vanilla schema
file is touched**, per SKILL.md §1):

| Path | Change |
|---|---|
| `packages/db/schema/ext_automation_events.ts` | **new** — §B.2 |
| `packages/db/schema/ext_automation_rules.ts` | **new** — §C.2 |
| `packages/db/schema/ext_automation_journeys.ts` | **new** — §D.2 |
| `packages/db/schema/ext_automation_suppressions.ts` | **new** — §E.2 |
| `packages/db/schema/index.ts` | 4 wildcard exports [pattern at L48-60] |
| `apps/web/lib/automation/{drain,runner,context,conditions,suppression,seed}.ts` | **new** |
| `apps/web/app/api/cron/automation/route.ts` | **new** cron route |
| `apps/web/vercel.json` | register the cron [pattern at L8-75] |
| `apps/web/server/routers/extensions/automation.ts` | **new** router |
| `apps/web/server/routers/extensions/index.ts` | mount it |
| `apps/web/config/custom-nav.ts` | nav items — **never** `sidebar.tsx` [SKILL.md §1] |
| `apps/web/messages/{en,sk}.json` | **both**, and only both — currently 5048/5048 symmetric |
| `apps/web/lib/marketing/messaging.ts` | fix #F.1.2, #F.1.3; retire `TRIGGERS` once §C lands |
| `apps/web/server/routers/encounters.ts` | emit `visit.closed` + fix #F.1.1 |

**Constraints that bound all of the above** [SKILL.md]: never modify `packages/db/schema/*.ts`
vanilla tables; new tables in `ext_*.ts`; routers under `apps/web/server/routers/extensions/`
mounted as `trpc.extensions.*`; nav via `custom-nav.ts`; i18n keys in **both** `sk.json` and
`en.json`; `pnpm db:push` only, `_journal.json` untouched; sympathy gate unconditionally
blocks all automated outreach; no clinical decision auto-committed without human confirmation.

---

## §H. Verification checklist and evidence caveat

**Added after the report was written.** Read this before acting on anything above.

### H.1 How to read the tags in this document

The analysis in §A–§G was produced from code reads performed at the start of this session.
Those reads returned real file contents, so the findings are not speculative. However, the
remainder of the session ran under a no-filesystem-access constraint, which means **the reads
could not be re-verified before publication**.

For the purposes of review, therefore:

> **Every `[VERIFIED: path:Lnn]` tag above should be treated as
> `[INFERRED — no filesystem access]` until someone re-opens the cited file and confirms it.**

Nothing in §B–§E (the designs) is invalidated by this — those are engineering proposals built
from the described architecture and stand on their own. §A, §F.1 and the "Enforced where"
column of §E.1 are the evidence-dependent parts.

### H.2 Verification checklist, in priority order

Ten load-bearing claims. Each row states what to check and what changes if the claim is false.

| # | Claim | How to confirm | If false |
|---|---|---|---|
| 1 | `visit_completed` is unreachable on the canonical path | Does `appointments.update` throw when a closeout is `clinical_finalized` / `completed`? Does `encounters.completeCheckout` emit any marketing trigger? | **Highest stakes.** Recommendation F.1.1 evaporates and the flagship flow may already work |
| 2 | `processQueue` sends nothing | Scan the import list of `lib/marketing/messaging.ts` for any SMS/email send function | §G.Q1 is void; Phase 1 is far more complete than assessed |
| 3 | Sympathy gate is conditional | Is the block `legalBasis === 'consent'` **OR** `templateKey` in a 5-item allowlist? | §E.1 #1 is not a SKILL.md violation; hardening becomes precautionary |
| 4 | Marketing quiet hours use server-local time | Does a local `isQuiet()` using `now.getHours()` coexist with a timezone-aware `isQuietHours()`? | F.1.3 drops out |
| 5 | `pickTemplate` fallback crashes on NOT NULL columns | Does the fallback object omit `version` / `legalBasis` while those columns are `.notNull()` with no default? | F.1.2 drops out; no crash risk to discharge finalisation |
| 6 | Rate limiter is zero-tolerance, not a cap | Does `smsRateLimitOk` return `count === 0`? | §E.1 #3/#4 shrink to "add an email-side cap" |
| 7 | Two of four seeded default rules are dead | Are `appointment_completed` and `inactive_recall` absent from the `TRIGGERS` map? | Dead-rule count drops from 7 to 5 |
| 8 | No marketing/automation cron exists | Inspect the `crons` array in `apps/web/vercel.json` | The "currently inert" conclusion is wrong |
| 9 | Email suppression is opt-in, not automatic | Any suppression check in `lib/email.ts`? Is `isSuppressed()` called anywhere? | §E.1 #2 becomes "consolidate", not "fix a hole" |
| 10 | The `feature-map-2026-09-12/` artifacts are absent | `git log --all --diff-filter=A -- '*FEATURE-INDEX*'` | Low stakes either way — they were not relied upon; §0.2(1) becomes moot |

**Items 1, 2 and 3 are the ones that would cause a rewrite rather than a tweak.** If those
three are confirmed as written, the rest of the report is safe to act on.

### H.3 Two stated dependencies in my own reasoning

- **Sequencing.** The recommendation to ship F.1.1 *before* the event bus (§F.7) is the claim
  most sensitive to item 1. It is cheap insurance either way — roughly a day of work — but if
  the flow already works it is not the priority this report makes it out to be.
- **Phase 1 schema scope.** The "ship with zero new tables except `ext_suppressions`" call in
  §F.7 depends on items 3, 5 and 9. If the sympathy gate is in fact unconditional, the
  argument for landing `ext_suppressions` early weakens considerably and it can wait for
  Phase 1c.
