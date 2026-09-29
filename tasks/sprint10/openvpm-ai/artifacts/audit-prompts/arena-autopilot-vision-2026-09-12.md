# OpenVPM AI — Autopilot Vision: Arena.ai Research Megaprompt (2026-09-12)

> **Repo root:** `C:\Users\marek\Documents\Vet\openvpm-ai`
> **Anchor commit:** `23f23a3`
> **Prior art (read FIRST before doing anything else):**
> - `artifacts/feature-map-2026-09-12/FEATURE-INDEX.md` — 430 features, 17 domains, 24 collisions
> - `artifacts/feature-map-2026-09-12/REORGANIZATION-FINDINGS.md` — 16 findings (5 High, 7 Medium, 4 Low)
> - `artifacts/feature-map-2026-09-12/domains/marketing-communications.md` — full audit of marketing, CRM, comms (3492-line router!)
> - `artifacts/feature-map-2026-09-12/domains/core-clinical.md` — visit/SOAP/treatment lifecycle
> - `artifacts/feature-map-2026-09-12/domains/scheduling-front-desk.md` — appointments, visit closeout events
> - `artifacts/feature-map-2026-09-12/domains/ai-agent.md` — existing AI tools, billing gates
> - `packages/db/schema/ext_marketing.ts` — existing marketing schema (413 lines)
> - `packages/db/schema/care-reminders.ts` — existing care reminder schema
> - `packages/db/schema/communications.ts` — existing comms schema
> - `packages/db/schema/visit-closeouts.ts` — visit closeout events (key event source)
> - `apps/web/server/routers/extensions/marketing.ts` — existing marketing router (3492 lines)
> - `apps/web/server/routers/care-reminders.ts` — existing care reminder engine (760 lines)
> - `.agents/skills/openvpm-ai/SKILL.md` — architectural constraints (READ THIS FIRST)

> **Non-negotiable architectural constraints (from SKILL.md):**
> - NEVER modify tables in `packages/db/schema/*.ts` (vanilla upstream). All new tables go into `ext_*.ts` files.
> - All new tRPC routers go under `apps/web/server/routers/extensions/` and are mounted as `trpc.extensions.*`.
> - Navigation items go into `apps/web/config/custom-nav.ts` — never hardcode into sidebar.tsx.
> - Every new i18n key must be added to BOTH `messages/sk.json` AND `messages/en.json`.
> - Sympathy gate (deceased patient) must unconditionally block ALL automated outreach.
> - Medical/clinical decisions (diagnosis, drug dose, lab result) must NEVER be auto-committed without human confirmation.
> - `pnpm db:push` for schema; never corrupt `_journal.json`.

> **Ground rules for every agent:**
> - Read the domain files listed under "Prior art" BEFORE analyzing or writing anything.
> - Tag every claim: `[VERIFIED: path:Lnn]` / `[INFERRED]` / `[ASPIRATIONAL]`
> - Do NOT fabricate file paths or function names — if you cannot find something in the code, say so explicitly.
> - Write only to the artifact output path specified in your task.
> - Produce concrete, implementable output — not generic advice.

---

## THE VISION

The owner of OpenVPM has defined the following north-star product vision:

> **"OpenVPM should automatically answer: 'What happened in the clinic today, and what safe, relevant, measurable communication action can we create from it?'"**

**Five automation pillars:**

1. **Social media autopilot** — clinic events → AI-drafted content → approval → publish to Facebook, Instagram, Google Business, YouTube Shorts, newsletter, waiting-room TV
2. **CRM automation** — event-driven client segmentation (12 segments), journey engine with frequency caps, consent enforcement, suppression
3. **Automated data entry copilot** — voice → SOAP draft, PDF/email → lab results, delivery notes → inventory, with confidence scoring and human-in-the-loop for clinical writes
4. **Reputation management** — Google/Facebook review inbox, AI reply drafts, sentiment classification, escalation, response tracking
5. **Event-driven marketing engine** — visit closed → vaccine reminder → follow-up → reactivation → review ask → treatment plan nudge

**Recommended phased rollout:**
- Phase 1: CRM segments + consent/suppression + event bus + email/SMS journeys + reputation inbox + content calendar with manual approval
- Phase 2: Social media publishing (Facebook Page API, Instagram Content Publishing API)
- Phase 3: Data entry copilot (voice → SOAP, PDF → lab, delivery note → inventory)
- Phase 4: Predictive AI (churn risk, optimal send time, appointment fill, A/B testing)

---

## AGENT 1 — ARCHITECTURE RESEARCH

You are a senior system architect specializing in event-driven SaaS platforms and veterinary practice management software.

**Your mission:** Research and design the optimal event-driven automation architecture for OpenVPM, building on the existing codebase without breaking upstream sync.

### Step 1: Audit the existing event surface

Read these files carefully:
- `packages/db/schema/visit-closeouts.ts` — what events are already emitted when a visit closes?
- `packages/db/schema/care-reminders.ts` — how are reminders triggered today?
- `packages/db/schema/ext_marketing.ts` — what marketing tables/states already exist?
- `apps/web/server/routers/care-reminders.ts` — how does the existing reminder engine work?
- `apps/web/server/routers/extensions/marketing.ts` (lines 1–200, 1300–1600) — existing automation/recall scaffolding
- `apps/web/lib/marketing/` — all files in this directory

For each existing event, list:
- Event name (what triggers it)
- Current payload (what data is available)
- Where it is consumed today
- Gap: what is NOT being consumed that the vision requires

### Step 2: Design the Event Bus

Propose a concrete event bus design:

**Constraints:**
- Must work within Next.js 15 + tRPC + Drizzle ORM stack
- No separate microservices (single Next.js app, monorepo)
- Prefer pg-based event log (since Postgres is already the DB) over Redis/BullMQ unless you can justify the dependency
- The event log must be durable (not in-memory), so events survive server restarts
- Must be compatible with the existing `ext_*.ts` schema isolation pattern

For each of these **required event types**, specify:
- Drizzle schema table name (e.g. `ext_events`)
- Event type enum values
- Minimum payload fields
- Who/what produces this event
- Who/what consumes it

Required events:
| Event | Trigger |
|---|---|
| `visit.closed` | Visit closeout completed |
| `vaccine.administered` | Vaccination recorded in SOAP |
| `vaccine.due` | Calculated from protocol, N days before due date |
| `appointment.cancelled` | Appointment marked cancelled |
| `invoice.paid` | Invoice fully paid |
| `review.received` | Google/Facebook review ingested |
| `patient.inactive` | No visit for N months (configurable) |
| `treatment_plan.incomplete` | Open treatment plan, no progress in N days |
| `patient.deceased` | Patient marked deceased or euthanized |
| `client.new` | First ever visit closed |
| `dental.postop` | Dental procedure recorded |
| `surgery.postop` | Surgery procedure recorded |
| `content.approved` | Marketing content item approved by staff |
| `review.request_eligible` | Visit closed + positive signals → ready to ask |

### Step 3: Design the Rules Engine

Propose a rules engine schema that:
- Stores trigger event type, conditions (patient species, visit type, segment tags), delay (hours/days), and action (create journey, send communication, create content brief)
- Allows practice-level overrides
- Supports dry-run mode (log what would fire without firing)
- Does NOT hardcode each workflow — practices can configure their own rules

### Step 4: Design the Journey Engine

Propose a journey engine schema that:
- Represents a client enrolled in a sequence of timed steps (e.g. day 0: welcome email, day 7: follow-up, day 30: vaccination reminder)
- Supports branching (if client books → exit journey; if no response → escalate channel)
- Tracks step completion, channel, delivered/opened/clicked status
- Enforces suppression (deceased patient gate, opt-out, cooldown, frequency cap)
- Can be paused, resumed, or cancelled per-client

### Step 5: Design the Suppression Engine

Enumerate every suppression signal that must block outreach:
- Deceased patient gate (already in SKILL.md — verify implementation in `care-reminders.ts`)
- Marketing opt-out (existing `smsSuppressions` / `emailSuppressions` — map these)
- Communication cooldown (global + per-campaign, configurable minutes/hours)
- Frequency cap (max N messages per client per 7 days)
- Quiet hours (existing — verify enforcement in `care-reminders.ts:L30-L31`)
- Sensitive period (patient recently deceased, active complaint, open incident)
- Recovery hold (existing — verify `care-reminders.ts:L33-L37`)
- Manual block (staff sets "no marketing" flag on client)
- Treatment sensitivity (client in active grief, legal dispute)

For each, state: where is it currently enforced, where is the gap, what new table/field is needed.

### Output format

Write a structured research report to:
`artifacts/autopilot-vision-2026-09-12/ARCHITECTURE-RESEARCH.md`

Include:
- §A: Existing event surface inventory (table format)
- §B: Proposed event bus schema (Drizzle table definition in code block)
- §C: Proposed rules engine schema
- §D: Proposed journey engine schema
- §E: Suppression engine gap analysis
- §F: What can be built in Phase 1 using ONLY existing tables (no new schema)
- §G: Open questions for the product owner

---

## AGENT 2 — SCHEMA DESIGN

You are a senior database engineer specializing in PostgreSQL, Drizzle ORM, and event-driven SaaS platforms.

**Your mission:** Design the complete Drizzle ORM schema for all new tables required by the automation vision. Your schema must be production-ready, follow all existing conventions, and be zero-conflict with upstream.

### Step 1: Study existing schema conventions

Read these files to understand naming and pattern conventions:
- `packages/db/schema/common.ts` — base columns pattern
- `packages/db/schema/ext_marketing.ts` — full file — this is your primary reference for ext_ conventions
- `packages/db/schema/care-reminders.ts` — how enums and indexes are structured
- `packages/db/schema/communications.ts` — how channel/status enums work
- `packages/db/schema/ext_ai_audit_log.ts` — AI audit log pattern

### Step 2: Design these new tables

For each table, write production-ready Drizzle schema code following the exact conventions in ext_marketing.ts:

#### 2A. `ext_automation_events` — the event log (event bus)
- Durable, append-only event log
- Fields: id, practiceId, eventType (pgEnum), patientId (nullable FK), clientId (nullable FK), appointmentId (nullable FK), visitId (nullable FK), payload (jsonb), processedAt, failedAt, failureReason, retryCount
- Index: practiceId + eventType + processedAt (for processing queue queries)
- Index: practiceId + clientId (for per-client history)
- Event type enum values: all 14 events from Agent 1 + extensibility for future

#### 2B. `ext_automation_rules` — the rules engine
- Fields: id, practiceId, name, description, isActive, triggerEventType, conditionJson (jsonb — species filter, visit type filter, segment filter), delayHours, actionType (pgEnum: create_journey, send_communication, create_content_brief, create_task), actionConfig (jsonb), priority, createdBy
- Action type enum: `create_journey`, `send_communication`, `create_task`, `create_content_brief`

#### 2C. `ext_automation_journeys` — journey definitions (templates)
- Fields: id, practiceId, name, description, triggerEventType, isActive, steps (jsonb — ordered array of step definitions), version, createdBy

#### 2D. `ext_automation_enrollments` — per-client journey instances
- Fields: id, practiceId, journeyId (FK → ext_automation_journeys), clientId (FK → clients), patientId (nullable FK → patients), triggerEventId (FK → ext_automation_events), enrolledAt, exitedAt, exitReason, currentStepIndex, status (pgEnum: active, completed, exited, paused, failed)
- Index: practiceId + clientId + status (to find active journeys per client)
- Index: practiceId + journeyId + status

#### 2E. `ext_automation_step_executions` — individual step results
- Fields: id, practiceId, enrollmentId (FK), stepIndex, scheduledAt, executedAt, skippedAt, skipReason, channelUsed (reuse extMarketingChannelEnum), communicationId (nullable FK → communications), contentItemId (nullable FK → extMarketingContentItems), status (pgEnum: scheduled, executing, done, skipped, failed), failureReason

#### 2F. `ext_crm_segments` — named client segments
- Fields: id, practiceId, name (text), segmentKey (text, unique per practice — e.g. "inactive_6mo", "post_surgery"), description, isSystem (boolean — system segments cannot be deleted), conditionSql (text — the Drizzle WHERE condition template), lastRefreshedAt

#### 2G. `ext_crm_segment_memberships` — which clients are in which segment
- Fields: id, practiceId, segmentId (FK → ext_crm_segments), clientId (FK → clients), enrolledAt, expiresAt, enrollmentReason, triggerEventId (nullable FK → ext_automation_events), isManuallyExcluded, excludedBy, excludedAt

#### 2H. `ext_reputation_reviews` — unified review inbox (extends extMarketingReviews)
**NOTE:** Check if `extMarketingReviews` (in ext_marketing.ts:L126-L147) already covers the needed fields. If yes, propose adding missing columns via ALTER rather than a new table. Fields to check for: sentimentScore, sentimentLabel, topic, severity, escalationStatus, escalatedTo, escalatedAt, internalTicketId, responseApprovedBy, responseApprovedAt, responsePublishedAt, responseChannel, isAutoPilotEligible.

#### 2I. `ext_content_pillars` — content calendar pillar library
- Fields: id, practiceId, pillarKey (text — e.g. "vaccination", "dental", "parasite_seasonal"), title, description, species (text array), seasonMonths (int array — 1-12), isActive, sortOrder

#### 2J. `ext_content_briefs` — AI-generated content brief queue
- Fields: id, practiceId, pillarId (nullable FK → ext_content_pillars), triggerEventId (nullable FK → ext_automation_events), briefText (text — the instruction for content generation), targetChannels (text array), targetAudience (text), clinicalClaims (jsonb — any clinical assertions that need vet approval), brandVoiceOverride (text), status (pgEnum: pending, generating, review, approved, rejected, archived), generatedBy (text — model name), generatedAt, reviewedBy (FK → users), reviewedAt, contentItemId (nullable FK → extMarketingContentItems — once content is generated)

#### 2K. `ext_automation_suppression_log` — audit trail of every suppression decision
- Fields: id, practiceId, clientId (FK → clients), patientId (nullable FK → patients), suppressionReason (pgEnum: deceased_patient, opt_out, frequency_cap, quiet_hours, recovery_hold, manual_block, cooldown, sensitivity_period), blockedAction (text — what was blocked), blockedAt, enrollmentId (nullable FK → ext_automation_enrollments), ruleId (nullable FK → ext_automation_rules)

### Step 3: Write the index.ts export additions

Show the exact lines to add to `packages/db/schema/index.ts` for all new tables.

### Step 4: Write migration safety notes

For each table, note:
- Any FK dependencies (what must exist first)
- Index strategy rationale
- Whether `pnpm db:push` is sufficient or a manual migration is needed

### Output format

Write to:
`artifacts/autopilot-vision-2026-09-12/SCHEMA-DESIGN.md`

Include:
- §A: Complete Drizzle schema code for all 11 tables (or 10, if ext_reputation_reviews merges with extMarketingReviews)
- §B: index.ts additions
- §C: Migration order and safety notes
- §D: What existing columns in ext_marketing.ts can serve double-duty without schema changes

---

## AGENT 3 — EVENT ENGINE & JOURNEYS IMPLEMENTATION PLAN

You are a senior TypeScript/Next.js/tRPC engineer specializing in event-driven automation systems.

**Your mission:** Design the concrete implementation plan for the event bus, rules engine, and journey engine — as tRPC routers and background workers within the existing Next.js monorepo.

### Step 1: Understand the existing automation scaffolding

Read:
- `apps/web/server/routers/extensions/marketing.ts` — lines 1300–1600 (recall schedules, automations section)
- `apps/web/server/routers/care-reminders.ts` — full file (this is the closest existing "journey" pattern)
- `apps/web/lib/marketing/` — all files (especially `planner.ts`, `recipes.ts`, `messaging.ts`)
- `apps/web/lib/communications/` — `policy.ts` (frequency/suppression logic)
- `packages/db/schema/care-reminders.ts` — understand what fields already exist

For each, identify: what automation logic already exists, what is hardcoded vs configurable, what can be reused.

### Step 2: Design the event emission layer

For each of these existing code paths, identify the exact line(s) where an event should be emitted:

| Trigger | File to search | Search term |
|---|---|---|
| Visit closed | `apps/web/server/routers/` | `closeout`, `visitCloseout`, `closed` |
| Vaccine administered | `apps/web/server/routers/` | `vaccination`, `vaccine` |
| Invoice paid | `apps/web/server/routers/` | `invoice`, `markPaid` |
| Appointment cancelled | `apps/web/server/routers/` | `cancelAppointment`, `cancelled` |
| Patient deceased | `apps/web/server/routers/` | `deceased`, `euthanasia` |

For each, specify:
- Exact file path and line number (search the codebase)
- What data is available at that point for the event payload
- Whether the emit should be synchronous (inline) or async (post-commit hook)
- Risk level: what breaks if the emit fails?

### Step 3: Design the event processor

Propose a concrete event processing architecture:

**Option A: pg-based polling worker** — a Next.js API route `/api/automation/process` called by a cron (Vercel Cron or self-hosted). Polls `ext_automation_events WHERE processedAt IS NULL ORDER BY createdAt LIMIT 100`. Processes each event, runs matching rules, creates/advances journey enrollments.

**Option B: pg LISTEN/NOTIFY** — emit events via pg `NOTIFY`, Next.js server registers a `LISTEN` handler. Requires persistent DB connection, more complex in serverless.

**Option C: Vercel Queue / external queue** — BullMQ with Redis, or Inngest. Requires new infrastructure dependency.

For each option:
- List pros and cons in the OpenVPM context (Next.js 15, Vercel/self-hosted, single DB)
- Recommend one option with justification
- Show the skeleton implementation (~30 lines of TypeScript pseudocode)

### Step 4: Design the tRPC router structure

Design the tRPC router file structure for the automation layer:

```
apps/web/server/routers/extensions/
  automation-events.ts     — emit, list, retry
  automation-rules.ts      — CRUD for practice rules
  automation-journeys.ts   — CRUD for journey templates
  automation-enrollments.ts — enroll, exit, pause, history per client
  crm-segments.ts          — list segments, membership, refresh
  content-briefs.ts        — list, generate, approve/reject briefs
```

For each router file, list the mutations/queries it should expose (names + brief description). Follow existing router conventions from `care-reminders.ts`.

### Step 5: Phase 1 implementation plan (no new schema)

**Critical constraint:** Phase 1 must be buildable using ONLY existing tables (before the schema in Agent 2 is deployed). Show what subset of the journey/automation vision can be delivered using only:
- `careReminders` table (already exists)
- `extMarketingRecallSchedules` table (already exists)
- `extMarketingContentItems` / `extMarketingContentBatches` (already exist)
- `communications` table (already exists)
- `extMarketingReviews` table (already exists)

List each Phase 1 feature and map it to the existing table it will use.

### Step 6: Google Business Profile & Meta API integration design

Research and document the API integration requirements:

**Google Business Profile API:**
- Which OAuth scopes are required to read/respond to reviews?
- What is the review list endpoint? Rate limits?
- What is the reply endpoint? Is it idempotent?
- Can it be called from a Next.js API route server-side? What credentials format?

**Meta Graph API (Facebook Page + Instagram Business):**
- Which permissions are required for Facebook Page publishing?
- Instagram Content Publishing API flow: container creation → publish. What media types are supported?
- Are there rate limits for publishing? (Instagram: 50 posts/day per account)
- Can a single app manage multiple practice pages? (Yes — page access tokens)

For each API, propose:
- Environment variables needed
- Where credentials should be stored in the DB (new `ext_channel_accounts` table?)
- The minimal OAuth flow for a practice to connect their accounts

### Output format

Write to:
`artifacts/autopilot-vision-2026-09-12/EVENT-ENGINE-PLAN.md`

Include:
- §A: Existing automation scaffolding inventory
- §B: Event emission points (table: trigger, file, line, payload, risk)
- §C: Event processor architecture recommendation + skeleton code
- §D: tRPC router structure with endpoint list
- §E: Phase 1 plan (existing tables only)
- §F: Social media API integration requirements

---

## AGENT 4 — GUARDRAILS, GDPR & COMPLIANCE DESIGN

You are a senior engineer and legal-technical advisor specializing in GDPR, medical data privacy, and veterinary software compliance in Slovakia/EU.

**Your mission:** Design the complete guardrail, consent, and compliance layer for the automation vision. Every automated action must be auditable, reversible, and legally defensible.

### Step 1: Audit existing consent and suppression infrastructure

Read:
- `packages/db/schema/consents.ts` — full file
- `packages/db/schema/sms-consent-events.ts` — full file
- `packages/db/schema/communications.ts` — suppression-related fields
- `apps/web/lib/communications/policy.ts` — existing frequency/suppression logic
- `apps/web/server/routers/care-reminders.ts` lines 25–50 — existing gate checks
- `.agents/skills/openvpm-ai/SKILL.md` — §3 Clinical & Safety Gates

For each existing consent/suppression mechanism, document:
- What it protects against
- Where it is enforced (file + line)
- Whether it covers the new automation layer or only the existing manual outreach

### Step 2: Design the consent architecture for the automation layer

The vision separates these communication types — each needs its own consent basis:

| Communication type | Legal basis under GDPR/Slovak law | Required consent signal |
|---|---|---|
| Service communication (vaccination reminder) | Legitimate interest (Article 6(1)(f)) | No marketing consent needed, but opt-out must be honored |
| Marketing communication (wellness campaign) | Consent (Article 6(1)(a)) | Explicit marketing opt-in required |
| Social media content (patient photo) | Consent (Article 6(1)(a)) | Written or SMS-confirmed media consent |
| Review request | Legitimate interest (post-transaction) | No consent needed, but frequency limit (max 1/visit) |
| Reputation reply (public) | Legitimate interest | No patient data in reply (anonymization required) |
| AI-drafted content published publicly | Consent for any identifiable content | extMarketingMediaConsents must be checked |

For each communication type:
- Define the consent check that must pass before sending
- Map it to an existing table/field (or flag as missing)
- Define the suppression signal that blocks it
- Define the audit trail requirement

### Step 3: Design the AI audit ledger for automation outputs

The vision requires: "Audit every AI output — who, what, when, on what data, with what model."

Read `packages/db/schema/ext_ai_audit_log.ts` — what does it already capture?

Design additions or a new `ext_automation_audit_log` table that captures:
- Every automated message sent (channel, recipient, content hash, journey step)
- Every AI-generated content item (model, prompt hash, output hash, reviewer, decision)
- Every review reply (draft, approval, publish timestamp, approver)
- Every suppression decision (what was blocked, why, by which rule)
- Every data entry copilot suggestion (field, AI value, human-confirmed value, delta)

The ledger must be:
- Append-only (no updates, no deletes)
- Linked to the relevant `ext_automation_events` entry
- Exportable for GDPR Subject Access Requests

### Step 4: Design the human-in-the-loop approval gates

For each action type, specify the required approval level:

| Action | Auto-allowed | Requires staff approval | Requires manager/vet approval |
|---|---|---|---|
| Send vaccination reminder (SMS/email) | Yes (if consent OK) | | |
| Send post-op follow-up | Yes (if consent OK) | | |
| Post social media content (low risk, positive) | | Yes | |
| Post social media content (clinical claim) | | | Yes |
| Reply to positive review | Yes (if no patient data) | | |
| Reply to negative review | | | Yes |
| Reply to review mentioning a specific treatment | | | Yes (legal check) |
| Create AI content brief | Yes | | |
| Publish content brief as post | | Yes | |
| Send reactivation campaign | | Yes | |
| Write SOAP draft from voice | | Yes (vet must confirm) | |
| Commit lab result to patient record | | | Yes (vet only) |
| Write drug dose to prescription | | | Yes (vet only) |
| Send communication to deceased patient | BLOCKED | | |
| Send marketing to opted-out client | BLOCKED | | |

Design the `ext_approval_queue` table and `approvals` tRPC router that:
- Stores pending items with action type, risk level, payload preview, deadline
- Notifies the right role (via existing communications or internal task system)
- Records the decision (approved/rejected + reason)
- Times out items after N hours and either auto-rejects or escalates

### Step 5: Design the data entry copilot guardrails

The voice → SOAP, PDF → lab result, delivery note → inventory flows require strict guardrails.

Design:
- The confidence scoring system: what makes a field "high confidence" vs "requires review"?
- The field-level lock: which fields can NEVER be auto-committed (drug dose, withdrawal period, euthanasia, diagnosis, controlled substance)?
- The diff UI spec: what must be shown to the vet before they confirm an AI-drafted SOAP note?
- The rollback mechanism: if a vet approves a draft and then finds an error, how do they create a `clinical-correction` (the table for this exists at `packages/db/schema/clinical-corrections.ts` — read it)?

### Step 6: Slovak veterinary law compliance checklist

Check the vision against Slovak law requirements (from SKILL.md §3 and statutory-compliance.md):

- **Zákon 39/2007 Z. z.** (Veterinary Act): Does automated data entry into the Treatment Diary (Kniha ošetrení) require a vet's digital signature? What constitutes a "record" under this law?
- **Zákon 139/1998 Z. z.** (Controlled Substances): Can ANY field in the controlled substances register be pre-filled by AI? What is the penalty for incorrect records?
- **GDPR Article 22**: Does automated segmentation/profiling of clients based on their pet's health status constitute "automated decision-making with significant effects"? If so, what rights does the client have?
- **GDPR Article 9**: Are pet health diagnoses "data concerning health" under Article 9 (special category data)? If yes, what is the legal basis for using them for marketing segmentation?
- **ePrivacy Directive**: Does the "vaccination reminder" qualify as a service message (exempt from consent) or a marketing message (requires consent)? How should the system classify this?

### Output format

Write to:
`artifacts/autopilot-vision-2026-09-12/GUARDRAILS-COMPLIANCE.md`

Include:
- §A: Existing consent/suppression infrastructure audit
- §B: Consent architecture per communication type (table format)
- §C: AI audit ledger design
- §D: Approval gate matrix and ext_approval_queue schema
- §E: Data entry copilot guardrail design
- §F: Slovak law compliance checklist with actionable verdicts

---

## AGENT 5 — ROADMAP & COST-BENEFIT ANALYSIS

You are a senior product manager and technical strategist specializing in B2B SaaS for healthcare/veterinary practices.

**Your mission:** Produce a prioritized, realistic roadmap for implementing the automation vision, with effort estimates, risk assessment, success metrics, and a cost-benefit analysis.

### Step 1: Audit current automation maturity

Read:
- `artifacts/feature-map-2026-09-12/FEATURE-INDEX.md` — what is already built?
- `artifacts/feature-map-2026-09-12/domains/marketing-communications.md` — full feature table
- `apps/web/server/routers/extensions/marketing.ts` lines 1300–1600 — existing automation features
- `packages/db/schema/ext_marketing.ts` — `extMarketingRecallSchedules` table

For each of the 5 vision pillars, assess:
- What percentage is already built (use the existing feature tables as source)
- What is the gap
- Effort to close the gap (S/M/L/XL)

### Step 2: Produce a phased roadmap

Map every feature from the vision to a phase, with:
- Phase (1–4)
- Feature name
- Effort (days of senior dev time)
- Dependencies (what must be built first)
- Risk (Low/Medium/High)
- Quick win? (can be shipped independently without the full platform)

Use this structure:

**Phase 1 — Foundation (target: 6–8 weeks)**
- CRM segment computation from existing data (no new schema)
- Consent & suppression center UI
- Event bus (ext_automation_events table + basic emitters on visit close, vaccine, invoice paid)
- Email/SMS journey engine (5 built-in journeys: welcome, post-visit follow-up, vaccination reminder, post-op check-in, reactivation)
- Reputation inbox (unify extMarketingReviews with AI reply drafts)
- Content calendar with manual approval only
- Dashboard: delivered, replied, booked, opted-out

**Phase 2 — Social Autopilot (target: +4–6 weeks after Phase 1)**
- Google Business Profile API integration
- Facebook Page API (read reviews + publish posts)
- Instagram Content Publishing API
- Content brief → AI text + image generation (existing Alibaba Wanx + Qwen already integrated)
- Brand voice per practice
- UTM tracking + attribution layer

**Phase 3 — Data Entry Copilot (target: +6–8 weeks after Phase 2)**
- Voice → SOAP draft (existing ext_voice.ts + voice router — what's missing?)
- PDF/email attachment → lab result draft
- Delivery note → inventory receipt (existing parser exists per Finding #13 — it just needs wiring)
- Confidence scoring UI
- Approval queue for AI-drafted clinical fields

**Phase 4 — Predictive AI (target: +8–12 weeks after Phase 3)**
- Churn risk score per client (ML model or heuristic)
- Optimal send time prediction
- Appointment fill prediction → local campaign trigger
- A/B testing for message subjects and CTAs
- Revenue attribution per campaign

### Step 3: Effort estimate per agent task

For the work proposed by Agents 1–4, estimate implementation effort:

| Task | Estimated dev days | Risk | Prerequisite |
|---|---|---|---|
| ext_automation_events schema + migration | 0.5 | Low | — |
| Event emitter integration (5 trigger points) | 2 | Medium | schema |
| Event processor (cron + pg polling) | 3 | Medium | schema |
| Rules engine CRUD + matching logic | 4 | Medium | event processor |
| Journey engine (enrollments + step execution) | 6 | High | rules engine |
| CRM segment computation (12 segments) | 3 | Low | existing schema |
| Suppression engine (all gates unified) | 2 | Low | existing tables |
| Reputation inbox UI + AI reply | 2 | Low | extMarketingReviews |
| Content brief generation | 1 | Low | existing AI router |
| Approval queue (schema + UI) | 3 | Medium | — |
| Google Business Profile integration | 3 | Medium | OAuth setup |
| Meta Graph API integration | 4 | High | App review required |
| Voice → SOAP draft wiring | 2 | Medium | ext_voice.ts |
| PDF → lab result draft | 4 | High | PDF parsing |
| Delivery note integration | 1 | Low | existing parser |

### Step 4: Success metrics framework

For each pillar, define 3–5 measurable KPIs that OpenVPM should track from day 1:

**Social autopilot:**
- Content items published per month (target: ≥8/month per practice)
- % of content items approved without edits (target: >60%)
- Engagement rate vs industry benchmark (veterinary: ~3–5%)
- Appointments booked via UTM-tracked social link

**CRM automation:**
- % of clients in at least one active journey (target: >80%)
- Reactivated clients per month (clients returning after 6+ months)
- Vaccination recall conversion rate (reminder sent → appointment booked, target: >30%)
- Opt-out rate (target: <2% per campaign)

**Data entry copilot:**
- Minutes saved per visit (target: 5–10 min)
- % of AI-suggested fields accepted without edit (target: >70%)
- % of fields requiring human correction after AI suggestion (target: <15%)
- Zero errors in controlled substance register

**Reputation management:**
- % of reviews with a response within 24h (target: >90%)
- Average response time (target: <4h)
- Google rating trend over 90 days
- Number of escalations to manager per month

**Marketing automation:**
- Revenue attributed to automated campaigns (vs. no-automation baseline)
- Cost per reactivated client
- Treatment plan completion rate (with vs. without automated nudge)
- Unsubscribe rate per journey type

### Step 5: Risk register

Identify the top 10 risks for this implementation:

For each risk:
- Risk description
- Probability (Low/Medium/High)
- Impact (Low/Medium/High)
- Mitigation strategy
- Owner (Dev / Product / Legal / Vet)

Key risks to cover:
1. Meta App Review delays (Facebook/Instagram publishing requires Meta approval)
2. GDPR Article 9 exposure (health data used for segmentation)
3. AI-generated clinical content published without vet review
4. Suppression engine failure (deceased patient receives marketing)
5. Over-messaging → client churn (frequency cap not enforced)
6. Slovak ŠVPS SR compliance for automated SOAP data entry
7. Upstream OpenVPM merge conflicts with new ext_ tables
8. AI model availability (Alibaba Wanx downtime → content pipeline stalls)
9. Data quality (low-quality visit data → low-quality event payloads → wrong journeys triggered)
10. Vet adoption resistance (perceived threat to their clinical judgment)

### Output format

Write to:
`artifacts/autopilot-vision-2026-09-12/ROADMAP-COSTBENEFIT.md`

Include:
- §A: Current automation maturity assessment (per pillar)
- §B: Phased roadmap table
- §C: Effort estimate table (all Agent 1–4 tasks)
- §D: Success metrics framework (per pillar, with targets)
- §E: Risk register (top 10)
- §F: Strategic recommendation: what to build FIRST for maximum immediate value with minimum risk

---

## ORCHESTRATION NOTES

These 5 agents can run **in parallel** — they produce only research artifacts, no code changes.

**Output directory:** `artifacts/autopilot-vision-2026-09-12/` (create this directory)

**Agents do NOT:**
- Modify any file in `apps/`, `packages/`, `docs/`, `README.md`, `ROADMAP.md`, or `CLAUDE.md`
- Write any production code (this is a research and design phase)
- Fabricate file paths or line numbers — use `[INFERRED]` for anything not directly verifiable

**Agents DO:**
- Read as much of the codebase as needed to ground their analysis
- Produce concrete, actionable designs — not generic advice
- Cross-reference each other's work where relevant (e.g. Agent 2 schema feeds Agent 3 router design)
- Flag contradictions or gaps in the vision with clear `[OPEN QUESTION]` markers

**After all 5 agents complete**, the product owner will review and approve the combined research, then a separate implementation megaprompt will be issued for Agent 1–4 style coding tasks.

---

## SELF-CHECK (for each agent before finalizing)

- [ ] Did you read ALL the prior art files listed at the top AND the domain files for your area?
- [ ] Did you tag every claim as `[VERIFIED: path:Lnn]`, `[INFERRED]`, or `[ASPIRATIONAL]`?
- [ ] Did you NOT modify any production source files?
- [ ] Did you write only to `artifacts/autopilot-vision-2026-09-12/` (your assigned output file)?
- [ ] Did you flag every `[OPEN QUESTION]` that requires product owner input?
- [ ] Does your output contain CONCRETE specs (table names, field names, enum values, line numbers) — not generic descriptions?
- [ ] Did you respect the non-negotiable architectural constraints from SKILL.md?
