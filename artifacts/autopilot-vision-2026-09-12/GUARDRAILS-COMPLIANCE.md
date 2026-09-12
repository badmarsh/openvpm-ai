# GUARDRAILS, GDPR & COMPLIANCE DESIGN — OpenVPM Autopilot Vision
> Anchor commit `23f23a3` — Agent 4 — 2026-09-12
> **Mode:** Cloud chat — no filesystem access. All file path references treated as described architecture. Claims about existing code tagged `[INFERRED — no filesystem access]`. New designs tagged `[ASPIRATIONAL]`.

> **Verification needed:** Every `[INFERRED]` claim below should be confirmed by reading the real file in the developer's local repo `C:\Users\marek\Documents\Vet\openvpm-ai` before implementation. I explicitly call out where a real read would change the answer.

---

## §A: Existing consent/suppression infrastructure audit

*Based on task description: `packages/db/schema/consents.ts`, `sms-consent-events.ts`, `communications.ts`, `ext_marketing.ts`, `care-reminders.ts`, `visit-closeouts.ts`, `apps/web/lib/communications/policy.ts`, `.agents/skills/openvpm-ai/SKILL.md §3`.*

### A1 — Clinical e-sign consent (surgery, anesthesia, hospitalization, euthanasia)

- **What it protects:** Proof that client signed a specific snapshot of a consent template; prevents later template edits from altering historic evidence; supports ŠVPS/KVL inspections.
- **Described structure:** `consent_forms` table per practice with slug/title/body/isActive, and `consent_requests` with capability token / tokenHash SHA-256, expiresAt, snapshotted title/bodyText, signaturePngBytes bytea, signatureSha256, signerAttestationVersion, documentRenderVersion, storageLeaseToken, fileId + frozen manifest (signedFileKey/checksum/size/etag). [INFERRED — no filesystem access]
- **Enforcement (assumed):** DB checks enforce status in pending/signing/signed, token XOR hash, render version enum. Router enforces confirmation envelope before finalization. [INFERRED — no filesystem access]
- **Covers automation?** **No.** Clinical only. Purpose limitation under GDPR Art 5(1)(b) means clinical consent cannot be reused for marketing or social publishing. Needs separate media consent.

> **Would change if real read differs:** If `consent_requests` already contains `scope` for marketing, then media consent might be unified. Need to verify.

### A2 — SMS consent ledger (TCPA + GDPR Art 6(1)(a))

- **What it protects:** Opt-in proof for SMS, disclosure version tracking, actor attribution, E.164 validation, prevents sending without valid consent.
- **Described structure:** `sms_consent_events` with action granted/revoked, disclosureVersion + disclosure text required on granted, null on revoked, actorType staff/client/system, provider + providerMessageId for client-initiated, E164 regex, eventKey unique, indexes on clientHistory and destinationHistory. [INFERRED — no filesystem access]
- **Client-level fast gate:** `clients.smsConsent boolean`, `smsConsentAt`, `smsConsentSource`, `smsConsentDisclosure` — fast check, durable proof in events table. [INFERRED — no filesystem access]
- **Enforcement points (inferred from task):**
  - `care-reminders.ts` lines 25-50: checks clientSmsConsent, email suppression, quiet hours, single active sender. [INFERRED — no filesystem access]
  - `lib/marketing/messaging.ts`: function `marketingConsentOk()` reads `clients.smsConsent` + latest `ext_marketing_media_consents` scope=marketing_messages not revoked. Used in `processQueue` for legalBasis=consent. [INFERRED — no filesystem access]
  - `lib/sms.ts` hard gate checks `sms_suppressions` before every send. [INFERRED — no filesystem access]
- **Covers automation?** **Partial.** Covers existing manual care-reminder SMS and new marketing automation if same function reused. Does NOT yet cover email marketing consent, push consent, or social publishing.

### A3 — Suppression lists (opt-out, bounce, complaint)

- **Described:** `sms_suppressions` practice-wide unique on (practiceId, phone), reason enum stop/manual/bounce/complaint. `email_suppressions` practiceId+email unique, reason manual/bounce/complaint/suppressed. [INFERRED — no filesystem access]
- **Enforcement:** Care reminders left join emailSuppressions on lower(trim(email)) and block. SMS hard gate in lib/sms.ts. Marketing queue checks rate limit but may not check email_suppressions for email channel — gap. [INFERRED — no filesystem access]
- **Covers automation?** Partial — SMS STOP global, email bounce for care reminders, needs extension to marketing email.

### A4 — Marketing media consents (photo/social/story/testimonial/marketing_messages)

- **Described:** `ext_marketing_media_consents` with practiceId, clientId, patientId optional, consentRequestId FK, scope enum photo_social/photo_web/photo_tv/story/testimonial/marketing_messages, evidenceType signature/sms_confirm/pdf, grantedAt, revokedAt. `ext_marketing_media_assets` has subjectsPresent boolean + consentId FK + CHECK (subjectsPresent=false OR consentId IS NOT NULL). [INFERRED — no filesystem access]
- **Enforcement:** Asset upload UI + validator, but no automatic enforcement at publishing time yet — `ext_marketing_content_items` has mediaAssetId optional, no DB-level consent check on publish. Marketing consent check for SMS uses this table as secondary after clients.smsConsent. [INFERRED — no filesystem access]
- **Covers automation?** Yes for manual media library, No for autopilot. Social autopilot must verify consentId chain for every asset with subjectsPresent=true before generating/publishing.

### A5 — Sympathy Gate (deceased patient protection) — CRITICAL

- **Described in SKILL.md §3:** Must unconditionally block automated vaccination and care reminder SMS/emails, post-discharge review requests, promotional marketing triggers; auto-dismiss open careReminders with dismissalReason "Sympathy Gate: Pacient uhynul / bol eutanazovaný."; multi-pet client protection (if all active patients deceased, block marketing without patientId); defensive queue filtering `patients.status is distinct from 'deceased'`; condolence task; discharge sympathy mode stripping recall CTA. [INFERRED — no filesystem access]
- **Described implementation:**
  - `careReminders.list` adds deceased filter when status=open.
  - `careReminders.sendOutreach` checks patientStatus===deceased → PRECONDITION_FAILED.
  - `applySympathyGate()` in `lib/marketing/messaging.ts`: blocks queued messages where legalBasis=consent OR templateKey in SYMPATHY_BLOCKED set {vaccine_due, review_request, thank_you, postop_check, marketing_blast}, auto-dismisses careReminders open→dismissed, creates condolence staff task, writes delivery log.
  - `createMessagesForTrigger` checks patient status deceased before queueing, and if no patientId checks if ALL active patients for client are deceased.
  - `processQueue` re-checks deceased at send time → status=blocked_sympathy.
  - `_safety.ts` `assertPatientNotDeceased` throws.
  - `ext_marketing_message_logs` status enum includes blocked_sympathy. [INFERRED — no filesystem access]
- **Covers automation?** **Yes, and must remain unconditional for all new pillars.** Autopilot event bus must call applySympathyGate or assertPatientNotDeceased before ANY outreach. No new automation may bypass. This is non-negotiable per task.

> **Real code read would change:** Exact set of blocked templateKeys, whether condolence task creation is transactional, whether delivery log write is intentional or side-effect. Need to verify.

### A6 — Rate limiting & quiet hours

- **Described:** `ext_sms_delivery_log` id, practiceId, clientId, source vanilla/marketing, sourceRecordId, sentAt, index on clientId+sentAt. Function `smsRateLimitOk(db, practiceId, clientId, windowDays)` counts rows since window, returns count===0. Default window 7 days from brand config. Quiet hours isQuiet() checks brand.quietHoursStart default 20 and End 8 with wrap logic; nextAllowedTime bumps to end hour; care-reminders uses isQuietHours. [INFERRED — no filesystem access]
- **Enforcement:** In createMessagesForTrigger pre-queue check and in processQueue for consent messages.
- **Covers automation?** Partial — SMS only. Email needs separate frequency cap, social needs caps. No per-template frequency yet (e.g., review ask max 1/visit).

### A7 — Communications policy

- **Described:** `apps/web/lib/communications/policy.ts` only validates subject max 255, content max 5000 (1600 for SMS). No frequency, no consent, no sympathy. [INFERRED — no filesystem access]
- **Covers automation?** No.

### A8 — Clinical AI audit ledger

- **Described:** `ext_ai_audit_log` append-only ledger for clinician confirmation of AI-generated clinical content. Fields: practiceId, actorId, actorName, entityType enum soap_note/discharge_report/imaging_analysis/treatment_plan/prescription, entityId, originalDraftHash, confirmedContentHash, wasEditedByClinician, ipAddress, confirmedAt, sequenceNumber per practice, actorRole, actionType, previousEventHash, eventHash, canonicalizationVersion, unique (practiceId, sequenceNumber). Comment rows MUST NOT be soft-deleted. [INFERRED — no filesystem access]
- **Covers automation?** Clinical AI finalization only. Does NOT cover marketing AI drafts, review reply drafts, automation decisions, suppression decisions, copilot suggestions.

### A9 — Clinical corrections (rollback)

- **Described:** `clinical_record_corrections` append-only, source row untouched. Fields: practiceId, recordType enum soap_note/vital_sign/vaccination_record/lab_result/patient_allergy, action entered_in_error, FKs to source tables, patientId, appointmentId, reason 5-1000 chars, correctedBy, operationId + operationPayloadHash required for lab. Checks enforce sourceTypeCheck, operationShapeCheck. [INFERRED — no filesystem access]
- **Covers automation?** Yes for rollback of erroneous clinical records, including AI-committed ones.

### A10 — Controlled substances

- **Described:** `controlled_substance_log` with drugName, deaSchedule, action received/administered/wasted/returned, quantity numeric 10,3, unit, patientId optional, performedBy, witnessedBy, lotNumber, notes, performedAt. [INFERRED — no filesystem access]
- **Covers automation?** No AI prefill allowed (see §F).

### A11 — Statutory registers (Slovak)

- **Described:** `ext_statutory.ts` contains `ext_withdrawal_periods` (meatWithdrawalDays, milkWithdrawalDays, safeUntil), `ext_rabies_notifications` with 3-day window, `ext_rabies_observations` with day1/5/14, `ext_carcass_disposals` with rendering plant disposal. [INFERRED — no filesystem access]
- **Covers automation?** No automation yet; copilot must NOT auto-commit.

### Summary Gap Matrix

| Mechanism | Protects against | Enforced where (described) | Covers new automation? |
|---|---|---|---|
| Clinical consent | Repudiation of clinical consent | consents.ts + discharge router | No |
| SMS consent events | SMS without opt-in | sms-consent-events.ts + clients.ts + marketingConsentOk() | Partial — SMS only |
| Email suppressions | Bounce/complaint spam | messaging.ts + care-reminders.ts | Partial — not marketing email yet |
| SMS suppressions | STOP/opt-out | messaging.ts + lib/sms.ts hard gate | Yes |
| Media consents | Photo/social without consent | ext_marketing.ts media_consents + CHECK | Partial — upload yes, autopublish no |
| Sympathy gate | Outreach to deceased | messaging.ts applySympathyGate + _safety.ts | Yes — must stay unconditional |
| Rate limit log | SMS spam | ext_sms_delivery_log + smsRateLimitOk | Partial — SMS only |
| Quiet hours | Night disturbance | isQuiet + isQuietHours | Partial — SMS only |
| AI audit log | Unattributed AI clinical write | ext_ai_audit_log chain | No — clinical only |
| Clinical corrections | Erroneous chart | clinical-corrections.ts | Yes for clinical rollback |
| Controlled substance log | Opiate audit gap | controlled-substances.ts | No AI allowed |

---

## §B: Consent architecture per communication type

### Legal basis mapping (GDPR + Slovak ePrivacy + Zákon 18/2018)

**Controller/processor assumption:** Practice is controller, OpenVPM is processor per DPA described in prior audit. All consent storage must support SAR export and revocation within 24h.

| Communication type | Legal basis (GDPR) | Slovak law note | Required consent signal | Maps to existing table/field (inferred) | Missing? | Suppression signal that blocks | Audit trail requirement |
|---|---|---|---|---|---|---|---|
| **Service communication (vaccination reminder, post-op follow-up, appointment reminder)** | Art 6(1)(b) contract + Art 6(1)(f) legitimate interest + Art 6(1)(c) where statutory (rabies) | Zákon 39/2007 §19 vet must inform owner; ePrivacy exempts service messages necessary for contracted service | No marketing consent needed, but: valid contact + not suppressed + not deceased + within quiet hours | `clients.smsConsent` for SMS, `clients.email` + no `email_suppressions` for email, `patients.status != deceased` | **Missing:** explicit service opt-out flag separate from marketing; currently service uses same smsConsent flag which is marketing-oriented | `sms_suppressions.reason=stop`, `email_suppressions`, `ext_marketing_message_logs.status=blocked_sympathy`, careReminders dismissed by sympathy gate, quiet hours | `ext_automation_audit_log` entry with channel, recipient, contentHash, templateKey, legalBasis=contract, triggerKey, idempotencyKey |
| **Marketing communication (wellness campaign, reactivation, dental recall, senior invite)** | Art 6(1)(a) consent | ePrivacy Art 13 requires prior consent for electronic marketing; Zákon 18/2018 §14 | Explicit marketing opt-in: `clients.smsConsent=true` AND latest `ext_marketing_media_consents.scope=marketing_messages` not revoked | `ext_marketing_media_consents.scope=marketing_messages` + `clients.smsConsent` | **Missing:** email marketing consent separate from SMS; portal push consent; double opt-in proof for email | `sms_suppressions`, `email_suppressions`, `ext_marketing_media_consents.revokedAt`, `smsRateLimitOk` false → suppressed_rate, isQuiet → suppressed_quiet, blocked_sympathy, frequency cap (new) | Same + consent version, disclosure text hash, marketing segment IDs |
| **Social media content (patient photo, story, testimonial)** | Art 6(1)(a) consent + Art 9(2)(a) if health data visible | Zákon 18/2018 explicit consent for identifiable image; if clinical data in caption → special category | Written or SMS-confirmed media consent: scope=photo_social/photo_web/photo_tv/story/testimonial, evidenceType signature/sms_confirm/pdf, not revoked, linked to specific patient if identifiable | `ext_marketing_media_consents` + `ext_marketing_media_assets.consentId` + CHECK | **Missing:** expiration/renewal date for media consent; minor owner consent; blur detection not enforced at DB | `revokedAt not null`, subjectsPresent=true AND consentId null → block, validatorVerdict=blocked | Audit: assetId, consentId, consentScope, evidenceType, model, promptHash, outputHash, reviewer decision, published URL hash |
| **Review request (Google/Facebook)** | Art 6(1)(f) legitimate interest (post-transaction) | Must not be marketing; max 1 per visit; no incentive; must include opt-out | No consent needed, but frequency limit max 1/visit + not deceased + not suppressed | `ext_marketing_reviews.requestSentAt`, `ext_marketing_recall_schedules.postVisitReviewEnabled`, SYMPATHY_BLOCKED includes review_request | **Missing:** dedup per appointmentId, explicit review request suppression list | `blocked_sympathy`, `suppressed_rate`, already sent for same appointmentId, `sms_suppressions` | Audit: appointmentId, requestSentAt, blockedReason, legalBasis=legitimate_interest |
| **Reputation reply (public response)** | Art 6(1)(f) legitimate interest | GDPR: no patient data in reply (anonymization required); vet ethics: no disclosing diagnosis without consent | No patient data in reply; if review mentions treatment → requires legal check + manager approval; must check media consent if patient identifiable | `ext_marketing_reviews.replyText`, `repliedAt`, `repliedBy` | **Missing:** PII scanner before publish, anonymization validator, approval queue link | validatorVerdict=blocked if PII detected, approval rejected | Audit: draft hash, published text hash, model, prompt, reviewer, approver, PII scan result, platform |
| **AI-drafted content published publicly (Facebook, Instagram, Google Business, YouTube Shorts, newsletter, waiting-room TV)** | Art 6(1)(a) for identifiable content; Art 6(1)(f) for generic educational | If patient photo/story → media consent required; if clinical claim → vet approval | `ext_marketing_media_consents` must be checked for any asset with subjectsPresent; generic content needs no consent but needs approval if clinical claim | `ext_marketing_content_items.status` proposed/approved/published/blocked/archived, validatorVerdict, approvedBy | **Missing:** link to ext_approval_queue, model/prompt audit, content hash chain | status=blocked, validatorVerdict=blocked, consentId null when required, approval_queue.decision=rejected | Full AI audit ledger entry per §C |

### Detailed consent check pseudocode per type (to implement in `lib/autopilot/consent-gate.ts` [ASPIRATIONAL])

```ts
// Service (vaccination reminder) — Art 6(1)(b)/(f)
function canSendService(practiceId, clientId, patientId?, channel) {
  if (patientId) assertPatientNotDeceased(db, patientId) // described in _safety.ts
  if (channel==='sms' && smsSuppressions has phone) return {ok:false, reason:'suppressed_stop'}
  if (channel==='email' && emailSuppressions has email) return {ok:false, reason:'suppressed_bounce'}
  if (isQuiet(now, brand)) return {ok:false, reason:'suppressed_quiet'}
  return {ok:true, legalBasis:'contract'}
}

// Marketing — Art 6(1)(a)
async function canSendMarketing(practiceId, clientId, channel) {
  if (!clients.smsConsent) return {ok:false, reason:'suppressed_no_consent'}
  const latest = await getLatestMediaConsent(practiceId, clientId, 'marketing_messages')
  if (latest?.revokedAt) return {ok:false, reason:'revoked'}
  if (!smsRateLimitOk(...)) return {ok:false, reason:'suppressed_rate'}
  return {ok:true, legalBasis:'consent', consentId: latest?.id}
}

// Social media content — Art 6(1)(a) + media consent
function canPublishSocial(asset) {
  if (asset.subjectsPresent && !asset.consentId) return {ok:false, reason:'consent_required'}
  const consent = getConsent(asset.consentId)
  if (consent.revokedAt) return {ok:false, reason:'revoked'}
  if (!['photo_social','story','testimonial'].includes(consent.scope)) return {ok:false, reason:'scope_mismatch'}
  return {ok:true, legalBasis:'consent'}
}
```

### Consent revocation & SAR export

- **Revocation SLA:** Must take effect within 24h; implement `revokeMarketingConsent` that sets `revokedAt=now()`, inserts `sms_suppression` if phone, `email_suppression` if email, and updates `ext_marketing_message_logs` where status=queued and legalBasis=consent and clientId=... set status=suppressed_no_consent. [ASPIRATIONAL]
- **SAR export:** New `ext_automation_audit_log` must be queryable by clientId and include all messages, content hashes, consent IDs, model info. Existing `sms_consent_events` already supports history via clientHistoryIdx. `ext_marketing_media_consents` needs history export. [INFERRED — no filesystem access]
- **Double opt-in for email marketing:** Add `ext_email_double_opt_in` table with tokenHash, expiresAt, confirmedAt. [ASPIRATIONAL]

---

## §C: AI audit ledger design

### What `ext_ai_audit_log` already captures (described)

- Entity types: soap_note, discharge_report, imaging_analysis, treatment_plan, prescription
- Actor, hashes (originalDraftHash, confirmedContentHash), wasEditedByClinician, ipAddress, confirmedAt
- Chain integrity: sequenceNumber per practice, previousEventHash, eventHash, canonicalizationVersion, actorRole, actionType
- Unique constraint on (practiceId, sequenceNumber) enforces monotonicity
- Append-only by policy (deletedAt inherited but must never be set) [INFERRED — no filesystem access]

**Gaps:** No coverage for automated messages, AI content items, review replies, suppression decisions, copilot suggestions.

### New table: `ext_automation_audit_log` [ASPIRATIONAL — goes in `packages/db/schema/ext_automation.ts` per Skill §1]

```ts
// packages/db/schema/ext_automation.ts — NEW FILE, exported via index.ts wildcard
import { pgTable, pgEnum, uuid, text, timestamp, jsonb, index, uniqueIndex, integer, boolean } from "drizzle-orm/pg-core";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { users } from "./users";
import { clients } from "./clients";
import { patients } from "./patients";

export const automationAuditEventTypeEnum = pgEnum("automation_audit_event_type", [
  "message_queued", "message_sent", "message_delivered", "message_failed",
  "message_suppressed",
  "message_blocked_sympathy",
  "content_drafted", "content_validated", "content_approved", "content_rejected", "content_published", "content_blocked",
  "review_received", "review_reply_drafted", "review_reply_approved", "review_reply_published", "review_reply_blocked_pii",
  "approval_requested", "approval_decided",
  "copilot_suggestion", "copilot_confirmed", "copilot_correction",
  "segmentation_run", "journey_step_entered", "consent_checked", "suppression_checked"
]);

export const automationAuditChannelEnum = pgEnum("automation_audit_channel", [
  "sms", "email", "facebook", "instagram", "google_business", "youtube_shorts", "newsletter", "tv", "internal_task", "portal"
]);

export const extAutomationEvents = pgTable("ext_automation_events", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  eventKey: text("event_key").notNull(), // visit_closed, vaccine_due, review_received
  sourceType: text("source_type").notNull(), // visit_closeout, appointment, lab_result, manual
  sourceId: uuid("source_id"),
  clientId: uuid("client_id").references(() => clients.id),
  patientId: uuid("patient_id").references(() => patients.id),
  payload: jsonb("payload").notNull().default({}),
}, (t)=>({
  practiceIdx: index("ext_auto_events_practice_idx").on(t.practiceId, t.createdAt),
  clientIdx: index("ext_auto_events_client_idx").on(t.practiceId, t.clientId),
  sourceIdx: index("ext_auto_events_source_idx").on(t.sourceType, t.sourceId),
}));

export const extAutomationAuditLog = pgTable("ext_automation_audit_log", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  automationEventId: uuid("automation_event_id").references(() => extAutomationEvents.id),
  eventType: automationAuditEventTypeEnum("event_type").notNull(),
  channel: automationAuditChannelEnum("channel"),
  actorId: uuid("actor_id").references(() => users.id),
  actorType: text("actor_type").notNull().default("system"),
  actorName: text("actor_name"),
  recipientClientId: uuid("recipient_client_id").references(() => clients.id),
  recipientPatientId: uuid("recipient_patient_id").references(() => patients.id),
  recipientContact: text("recipient_contact"), // hashed phone/email for SAR without PII leak
  contentHash: text("content_hash"),
  contentPreview: text("content_preview"), // first 200 chars, PII-redacted
  promptHash: text("prompt_hash"),
  outputHash: text("output_hash"),
  model: text("model"),
  journeyKey: text("journey_key"),
  journeyStep: text("journey_step"),
  templateKey: text("template_key"),
  templateVersion: integer("template_version"),
  suppressionReason: text("suppression_reason"),
  suppressionRule: text("suppression_rule"),
  legalBasis: text("legal_basis"),
  consentId: uuid("consent_id"),
  consentScope: text("consent_scope"),
  decision: text("decision"),
  decisionReason: text("decision_reason"),
  reviewerId: uuid("reviewer_id").references(() => users.id),
  fieldName: text("field_name"),
  aiValue: text("ai_value"),
  humanConfirmedValue: text("human_confirmed_value"),
  confidenceScore: integer("confidence_score"),
  wasEdited: boolean("was_edited").default(false),
  deltaHash: text("delta_hash"),
  sequenceNumber: integer("sequence_number"),
  previousEventHash: text("previous_event_hash"),
  eventHash: text("event_hash"),
  canonicalizationVersion: integer("canonicalization_version").default(1),
  ipAddress: text("ip_address"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, (t)=>({
  practiceSeqUq: uniqueIndex("ext_auto_audit_practice_seq_uq").on(t.practiceId, t.sequenceNumber),
  practiceIdx: index("ext_auto_audit_practice_idx").on(t.practiceId, t.occurredAt),
  clientIdx: index("ext_auto_audit_client_idx").on(t.practiceId, t.recipientClientId, t.occurredAt),
  eventTypeIdx: index("ext_auto_audit_event_type_idx").on(t.practiceId, t.eventType, t.occurredAt),
  automationEventIdx: index("ext_auto_audit_auto_event_idx").on(t.automationEventId),
}));
```

### Ledger requirements

- **Append-only:** No UPDATE, no DELETE, no soft-delete. `deletedAt` must never be set. Enforce via application check + DB trigger rejecting UPDATE/DELETE. [ASPIRATIONAL]
- **Linked to automation event:** Every automated action must have `automationEventId` pointing to `ext_automation_events` row that triggered it (visit closed → vaccine reminder). For manual actions, sourceType=manual.
- **Hash chain:** Reuse `computeAutomationAuditEventHash()` similar to `computeAiAuditEventHash()` in `lib/ai/audit-chain.ts` (described in task). Include practiceId, sequenceNumber, previousEventHash, eventType, contentHash, actorId, occurredAt. [INFERRED — no filesystem access]
- **Exportable for SAR:** Query by `recipientClientId` returns all messages sent to that client with contentPreview (redacted), legalBasis, consentId, suppression decisions. Must support GDPR Article 15. Implement `trpc.extensions.compliance.exportClientData`.
- **Retention:** Audit logs retained 10 years per Slovak accounting + GDPR accountability (described in docs/enterprise-trust/DATA_SOVEREIGNTY_AND_RETENTION.md). Voice audio separate 24h purge per SKILL.md. [INFERRED — no filesystem access]

---

## §D: Approval gate matrix and ext_approval_queue schema

### Approval matrix

| Action | Auto-allowed | Requires staff approval | Requires manager/vet approval | Risk | Legal basis |
|---|---|---|---|---|---|
| Send vaccination reminder (SMS/email) | Yes (if consent OK, not deceased, not suppressed) | No | No | Low | contract |
| Send post-op follow-up | Yes (if consent OK) | No | No | Low | contract |
| Post social media content (low risk, positive, no clinical claim, no identifiable patient) | Yes (if generic) | No | No | Low | legitimate_interest |
| Post social media content (clinical claim) | No | No | Yes — vet must approve + validator | High | consent if identifiable |
| Reply to positive review (no patient data) | Yes (if no patient data, PII scan pass) | No | No | Low | legitimate_interest |
| Reply to negative review | No | Yes — staff | No (but manager if mentions treatment) | Medium | legitimate_interest |
| Reply to review mentioning specific treatment/diagnosis | No | No | Yes — legal check + manager | High | legitimate_interest + anonymization |
| Create AI content brief (internal) | Yes | No | No | Low | — |
| Publish content brief as post | No | Yes if low risk, else vet | Yes if clinical claim or patient photo | Medium/High | consent check |
| Send reactivation campaign | No | Yes — front_desk or admin | No | Medium | consent |
| Write SOAP draft from voice | Yes (draft) | No | Yes — vet must confirm before chart | High | clinical gate |
| Commit lab result to patient record | No | No | Yes — vet only, with confirmation envelope | Critical | clinical gate + confirmation protocol |
| Write drug dose to prescription | No | No | Yes — vet only, with expectedRevision | Critical | clinical gate |
| Send communication to deceased patient | **BLOCKED** — unconditional | — | — | — | sympathy gate |
| Send marketing to opted-out client | **BLOCKED** — unconditional | — | — | — | consent gate |

### Risk levels

- **Low:** Generic educational content, service reminders, no PII, no clinical claim.
- **Medium:** Marketing campaigns, review replies, brand voice, reactivation.
- **High:** Clinical claims, patient stories, treatment mentions, SOAP drafts.
- **Critical:** Drug dose, withdrawal period, euthanasia, diagnosis, controlled substance, lab result commit.

### New table: `ext_approval_queue` [ASPIRATIONAL — in `ext_automation.ts`]

```ts
export const approvalActionTypeEnum = pgEnum("approval_action_type", [
  "send_vaccination_reminder",
  "send_postop_followup",
  "publish_social_content",
  "publish_social_content_clinical_claim",
  "reply_review_positive",
  "reply_review_negative",
  "reply_review_treatment_mention",
  "create_content_brief",
  "publish_content_brief",
  "send_reactivation_campaign",
  "write_soap_draft",
  "commit_lab_result",
  "write_drug_dose",
  "publish_newsletter",
  "publish_tv_slide"
]);

export const approvalRiskLevelEnum = pgEnum("approval_risk_level", ["low","medium","high","critical"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending","approved","rejected","expired","escalated"]);
export const approvalDecisionEnum = pgEnum("approval_decision", ["approved","rejected"]);

export const extApprovalQueue = pgTable("ext_approval_queue", {
  ...baseColumns(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  automationEventId: uuid("automation_event_id").references(() => extAutomationEvents.id),
  actionType: approvalActionTypeEnum("action_type").notNull(),
  riskLevel: approvalRiskLevelEnum("risk_level").notNull(),
  status: approvalStatusEnum("status").notNull().default("pending"),
  title: text("title").notNull(),
  payloadPreview: text("payload_preview").notNull(),
  payload: jsonb("payload").notNull(),
  payloadHash: text("payload_hash").notNull(),
  requiredRole: text("required_role").notNull(),
  assignedTo: uuid("assigned_to").references(() => users.id),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  deadlineAt: timestamp("deadline_at", { withTimezone: true }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedBy: uuid("decided_by").references(() => users.id),
  decision: approvalDecisionEnum("decision"),
  decisionReason: text("decision_reason"),
  escalatedFromId: uuid("escalated_from_id").references(() => extApprovalQueue.id),
  escalationLevel: integer("escalation_level").notNull().default(0),
  contentItemId: uuid("content_item_id").references(() => extMarketingContentItems.id),
  reviewId: uuid("review_id").references(() => extMarketingReviews.id),
  messageLogId: uuid("message_log_id").references(() => extMarketingMessageLogs.id),
  clientId: uuid("client_id").references(() => clients.id),
  patientId: uuid("patient_id").references(() => patients.id),
}, (t)=>({
  practiceStatusIdx: index("ext_approval_practice_status_idx").on(t.practiceId, t.status, t.deadlineAt),
  assignedIdx: index("ext_approval_assigned_idx").on(t.assignedTo, t.status),
  riskIdx: index("ext_approval_risk_idx").on(t.practiceId, t.riskLevel, t.status),
  deadlineIdx: index("ext_approval_deadline_idx").on(t.deadlineAt),
}));
```

### Approval queue logic [ASPIRATIONAL]

- **Creation:** Any autopilot action requiring approval inserts row with status=pending, deadlineAt = now + TTL (Low: 24h, Medium: 12h, High: 4h, Critical: 1h). TTL configurable per practice in `ext_automation_settings`.
- **Notification:** On insert, create `ext_marketing_staff_tasks` with kind=approval + link to approval UI. Also push via existing notifications router if available (described path `apps/web/server/routers/notifications.ts`).
- **Decision:** Staff calls `trpc.extensions.approvals.decide` with approvalId, decision, reason, expectedRevision. On approve, proceed to publish/send and write audit log entry approval_decided + content_published. On reject, write content_rejected audit and optionally create follow-up task.
- **Timeout:** Cron `api/cron/approval-timeout` hourly: if deadlineAt < now AND status=pending, then Low/Medium auto-reject with reason expired (safe default), High/Critical escalate — set status=escalated, create new row with escalationLevel+1, requiredRole=admin/veterinarian, deadlineAt=now+2h. Notify manager.
- **Idempotency:** Use payloadHash + actionType + clientId unique partial index to prevent duplicates.

### tRPC router `approvals` [ASPIRATIONAL — `apps/web/server/routers/extensions/approvals.ts`]

- Mount as `trpc.extensions.approvals.*` per Skill §1 (described constraint: all new routers under extensions, mounted as trpc.extensions.*).
- Navigation item goes into `apps/web/config/custom-nav.ts` (described constraint: never hardcode into sidebar.tsx).
- i18n keys must be added to BOTH `messages/sk.json` AND `messages/en.json` per described constraint.

---

## §E: Data entry copilot guardrail design

### Scope (described)

- **Voice → SOAP:** `voice_dictations` table stores audioFileKey, rawTranscript, subjective/objective/assessment/plan, status enum RECORDING/TRANSCRIBING/FORMATTING/COMPLETED/FAILED, audioDeletedAt, scheduledDeleteAt (GDPR 24h). [INFERRED — no filesystem access]
- **PDF/email → lab results:** `ext_lab_import` tables — not fully described but inferred.
- **Delivery notes → inventory:** No existing schema found for inventory autopilot; would need new ext_inventory_transactions. [INFERRED — no filesystem access]

All three require strict guardrails per task spec and Skill §3: medical/clinical decisions must NEVER be auto-committed without human confirmation.

### Confidence scoring system [ASPIRATIONAL]

Define per-field confidence 0-100:

| Signal | High confidence (≥90) boost | Low confidence (<70) penalty |
|---|---|---|
| **Voice → SOAP** | Clear audio SNR >20dB, language detected sk/en >0.9, transcript contains known medical terms, SOAP sections match expected headings, no drug dose mentioned, no negation uncertainty | Background noise, overlapping speakers, drug name low ASR confidence, dose ambiguous units, mention euthanasia/deceased, controlled substance name, withdrawal period, conflicting vitals |
| **PDF → lab** | PDF text extraction >0.95, lab name matches known panel, reference ranges present, value within plausible range, units match LOINC, patient ID matches chart via microchip/name/DOB | Scanned OCR <0.8, handwritten, value outside 3-sigma, missing units, multiple patients, patient mismatch, critical value |
| **Delivery note → inventory** | Vendor matches known supplier, SKU/barcode matches existing inventory, quantity integer, lot number valid, expiry future | Unknown vendor, SKU not found, fractional quantity for countable items, expiry past, controlled substance |

**Scoring formula:**

```ts
confidence = clamp(0,100,
  baseModelConfidence * 0.5 +
  extractionConfidence * 0.3 +
  dictionaryMatchScore * 0.1 +
  crossCheckScore * 0.1
  - penaltyForHighRiskKeywords
)
```

- High ≥85: Pre-filled in UI, but still requires vet confirmation for clinical writes (never auto-commit).
- Medium 70-84: Pre-filled yellow warning, requires explicit checkbox per field.
- Low <70: Red, requires manual entry, AI value shown as suggestion only.

Store confidence per field in `ext_automation_audit_log.confidenceScore` + `fieldName`.

### Field-level lock: NEVER auto-commit [ASPIRATIONAL, based on described compliance]

Critical fields that must always require vet confirmation and must never be auto-committed, even if confidence=100:

- Drug dose, route, frequency, duration (prescription)
- Withdrawal period (ochranná lehota) — meatWithdrawalDays, milkWithdrawalDays
- Euthanasia — reason, medicationUsed, doseAdministered
- Diagnosis — assessment section that creates new problem list entry
- Controlled substance — any field in `controlled_substance_log` — drugName, quantity, action, lotNumber
- Lab result interpretation — abnormal flag, clinical notes
- Allergy — new `patient_allergy`
- Vaccination — vaccine name, batch, expiry (affects rabies register + RVPS notification)

Enforce via `requireConfirmationEnvelopeId` + `requireExpectedRevision` for all clinical writes (described in `_safety.ts`). UI must not have auto-save for these.

### Diff UI spec: what must be shown before vet confirms AI-drafted SOAP [ASPIRATIONAL]

**Screen:** `/patients/[id]/soap/[draftId]/review` — side-by-side diff.

1. **Header:** Patient name, species, age, weight, allergies, last visit summary, audio duration, model used, confidence overall.
2. **Original transcript:** Raw transcript (collapsible) + audio player (if not yet purged, with GDPR notice "Audio will be deleted in X hours").
3. **Field-by-field diff:** Left existing chart value or empty, Middle AI draft value with confidence badge green/yellow/red + source snippet highlighting, Right editable field for vet to correct. Show originalDraftHash vs confirmedContentHash preview, wasEditedByClinician indicator.
4. **High-risk highlights:** Any field containing drug dose, controlled substance, euthanasia, withdrawal period highlighted red with icon "Requires vet confirmation — never auto-committed".
5. **Cross-checks:** Drug dose vs weight calculation, allergy conflict block, withdrawal warning if food-producing animal (bovine, porcine, ovine, equine, poultry, companion).
6. **Confirmation envelope:** Call prepareConfirmation mutation to get confirmationId bound to actor/practice/entity/revision/content hash. UI shows "Review content and call prepareConfirmation first".
7. **Finalize button:** Disabled until all critical fields manually checked. On click, call finalize with confirmationId + expectedRevision.
8. **Audit preview:** Show what will be written to ext_ai_audit_log and ext_automation_audit_log.

PDF → lab diff UI similar: PDF thumbnail, extracted values table with confidence, patient match confidence, reference ranges, delta vs previous labs, require vet signature.

### Rollback mechanism using `clinical_record_corrections` [INFERRED — no filesystem access]

- Table `clinical_record_corrections` append-only, source row untouched, reason 5-1000 chars, correctedBy, operationId + operationPayloadHash required for lab.
- Flow for copilot error after approval:
  1. Vet discovers error in committed SOAP/lab/vaccination.
  2. UI "Mark as entered in error" → requires reason min 5 chars.
  3. Insert correction row with recordType, soapNoteId/labResultId/etc., action=entered_in_error, patientId, appointmentId, reason, correctedBy, correctedByName, operationId + operationPayloadHash for lab.
  4. Original row remains, but queries filter out corrected records via LEFT JOIN where correction null.
  5. Write audit log entry copilot_correction in ext_automation_audit_log with deltaHash, fieldName, aiValue vs humanConfirmedValue.
  6. If correction due to AI error, also link via operationId.
- For inventory/delivery note errors: Need similar correction table `ext_inventory_corrections` [ASPIRATIONAL].
- For marketing content errors after publish: Use `ext_marketing_content_items.status=archived` + unpublish via API.

### Voice GDPR purge [INFERRED — no filesystem access]

- `voice_dictations.audioFileKey` in S3, `scheduledDeleteAt = now+24h`, `audioDeletedAt` timestamp when purged.
- Cron `api/cron/voice-audio-retention` hourly deletes expired audio.
- Transcription and SOAP remain as clinical record; raw audio deletion does NOT delete audit logs.
- Autopilot must not retain audio beyond 24h in any cache or log.

> **Real code read would change:** Actual column names for audio deletion, whether retention is in `ext_voice.ts` or separate `retention.ts`, whether cron exists. Need to verify.

---

## §F: Slovak veterinary law compliance checklist with actionable verdicts

### F1 — Zákon 39/2007 Z. z. (Veterinary Act): Treatment Diary (Kniha ošetrení) + Rabies Register + Euthanasia Register

**Questions:** Does automated data entry into Treatment Diary require vet's digital signature? What constitutes a "record"?

**Findings (described):** `ext_withdrawal_periods` tracks meat/milk withdrawal, safeUntil — part of Kniha ošetrení for food-producing animals. `ext_rabies_notifications` with rvpsNotifiedAt, status pending/submitted/confirmed, 3-day notification window. `ext_rabies_observations` with day1/5/14 exams. `ext_carcass_disposals` with euthanasiaDate, reason, weightKg, medicationUsed, doseAdministered, veterinarianName, renderingPlant, disposalDocumentNumber, clientConsentSigned. [INFERRED — no filesystem access]

**Verdict [INFERRED — no filesystem access, legal counsel must confirm]:**

- Automated data entry into Treatment Diary is ALLOWED for draft creation, but FINALIZATION requires vet's digital attestation (confirmation envelope) + KVL number. System must NOT auto-commit treatment rows; must require requireConfirmationEnvelopeId + vet role + KVL number stored.
- What constitutes a "record": Per §19-29 of 39/2007, record must be immutable, timestamped, attributable to licensed vet (name + KVL), with animal identification (microchip), drug batch, withdrawal. Therefore ext_ai_audit_log chain integrity is suitable, but need to add vetKvlNumber to treatment and euthanasia tables.
- **Actionable:**
  - Add veterinarianKvlNumber column to ext_withdrawal_periods, ext_carcass_disposals, microchipRegistrations (already has vetKvlNumber per described).
  - Enforce in approvals router: actionType commit_lab_result or write_drug_dose for food-producing species must check targetAnimalType != companion → require withdrawal fields + vet signature.
  - Implement 3-day RVPS notification cron that checks ext_rabies_notifications.status=pending and createdAt > 3 days → escalate to admin task (legal breach).
  - For euthanasia, require clientConsentSigned=true before allowing disposal record; AI must never pre-fill dose.

> **Real read would change:** Actual column names in ext_statutory.ts, whether KVL number already stored, whether RVPS notification is manual or automated.

### F2 — Zákon 139/1998 Z. z. (Controlled Substances / Omamné a psychotropné látky)

**Questions:** Can ANY field in controlled substances register be pre-filled by AI? What is penalty?

**Findings (described):** controlled_substance_log with drugName, deaSchedule, action received/administered/wasted/returned, quantity numeric 10,3, unit, patientId, performedBy, witnessedBy, lotNumber, notes, performedAt. [INFERRED — no filesystem access]

**Verdict [INFERRED — legal counsel must confirm]:**

- **NO field in controlled substances register may be pre-filled by AI.** Even drug name suggestion is high risk. Copilot must be disabled for any UI that writes to controlled_substance_log.
- Penalty: Slovak law requires strict register with dual signature, batch traceability, monthly reporting to ŠUKL. Discrepancy is criminal offense under §135+ Penal Code, fines up to €10k and loss of license, plus criminal liability.
- **Actionable:**
  - Add check in voice_dictations processing: if transcript contains controlled substance keywords (list from distinct drugName), set confidence=0 and flag manual only, do NOT pre-fill.
  - UI: When chart shows controlled substance administration, hide AI suggestion panel.
  - Audit: Any attempt to use AI to write to this table must be logged as blocked in ext_automation_audit_log with reason controlled_substance_ai_blocked.
  - Add DB trigger or app check rejecting inserts where performedBy not veterinarian role and witnessedBy null for administered/wasted.

### F3 — GDPR Article 22: Automated decision-making with significant effects (profiling)

**Question:** Does automated segmentation/profiling of clients based on pet's health status constitute automated decision-making with significant effects?

**Analysis [INFERRED — legal interpretation, not verified against real code]:**

- Segmentation examples from vision: 12 segments (senior dog owner, dental disease, inactive client, high-value client). Journey engine uses health status (dental tartar → dental recall).
- Article 22(1): Right not to be subject to decision based solely on automated processing, including profiling, which produces legal effects or similarly significantly affects them.
- Pet health segmentation alone is NOT typically "significant" unless it involves special category data or leads to exclusion from services, price discrimination, or distress.
- If segmentation uses pet health diagnosis to infer owner health or uses special category data (see F4), then Article 22 + Article 9 apply.

**Verdict:**

- Low-risk segmentation (species, age, last visit date, location) → NOT Article 22 significant, but still requires transparency and opt-out.
- High-risk segmentation (dog with cancer → owner distressed → target with expensive oncology campaign, or aggressive breed → deny insurance) → COULD be significant + Article 9, requires explicit consent + human review.
- **Actionable [ASPIRATIONAL]:**
  - Implement ext_client_segments table with segmentKey, reasonCodes, confidence, generatedAt, model, humanReviewed boolean.
  - For any segment using diagnosis, lab result, treatment history, require consentScope=marketing_messages AND disclosure in privacy notice.
  - Provide opt-out per segment: ext_segment_opt_outs table clientId + segmentKey.
  - Add right to object handling: clients.profilingOptOut boolean and exclude from AI segmentation.
  - Log every segmentation run in ext_automation_audit_log with eventType=segmentation_run.

> **Real code read would change:** Whether segmentation already exists, what data points used, whether 12 segments defined.

### F4 — GDPR Article 9: Are pet health diagnoses "data concerning health" (special category)?

**Question:** Are pet health diagnoses special category data under Article 9?

**Analysis [INFERRED — legal interpretation]:**

- Article 9(1) special categories: "data concerning health" of natural person. Pet health is NOT human health, so strictly not special category. However EDPB and Slovak DPA have nuanced views: pet health data can indirectly reveal owner health (zoonosis, allergies, mental health via pet's behavioral diagnosis). Pet health data combined with owner data is personal data, but not necessarily special category unless it reveals owner health.
- Slovak Zákon 18/2018 §16 mirrors GDPR Article 9, plus genetic and biometric. Pet health not listed.

**Verdict:**

- Pet health diagnoses are NOT special category under Article 9 per se, but must be treated as HIGH-SENSITIVITY personal data due to indirect health inference risk and veterinary ethics.
- **Actionable:**
  - Do NOT use pet health diagnoses for marketing segmentation without explicit marketing consent (ext_marketing_media_consents.scope=marketing_messages not revoked). Even though not Article 9, best practice.
  - If diagnosis used, pseudonymize: segment key should not contain diagnosis text, only hashed. Audit log must record legalBasis=consent.
  - Add privacy notice clause.
  - For social media: If post mentions specific diagnosis (e.g., "Today we treated parvovirus"), that's clinical claim + potentially identifiable → requires vet approval + anonymization (no patient name, no owner name, no photo without consent).
  - Implement PII scanner that flags any AI content containing diagnosis terms from blocklist → route to vet approval.

### F5 — ePrivacy Directive (2002/58/EC) + Slovak transposition (Zákon 452/2021 Z. z.): Vaccination reminder service vs marketing

**Question:** Does "vaccination reminder" qualify as service message (exempt from consent) or marketing message (requires consent)? How should system classify?

**Analysis [INFERRED]:**

- ePrivacy Art 13 requires prior consent for unsolicited communications for direct marketing via email/SMS. Service messages necessary for performance of contract or to inform about service are exempt if not promotional.
- Vaccination reminder: Service argument — vet has contractual duty to inform owner about preventive care; vaccination is statutory (rabies) and medical necessity; reminder is part of aftercare, not promotion. Marketing argument — if reminder includes promotional language ("Book now and get 10% off"), it becomes marketing.
- Post-op follow-up: Clearly service.
- Reactivation ("We miss you"): Marketing.

**Verdict:**

- Vaccination reminder = SERVICE message (exempt from marketing consent) IF content purely informational: "Vaccination for [pet] expires on [date]. Please schedule." No promotional upsell, no discount, no cross-sell, sent within reasonable time (14 days before expiry + one follow-up), includes opt-out for service reminders, legalBasis=contract + legitimate_interest + statutory for rabies. If content includes marketing, reclassify as marketing and require consent.
- **Actionable classification in code [ASPIRATIONAL]:**
  ```ts
  enum MessageLegalBasis {
    contract = "contract", // service, no marketing consent needed, but respect service opt-out + suppressions
    legitimate_interest = "legitimate_interest", // review request, reputation reply
    consent = "consent", // wellness campaign, reactivation, dental recall if not directly related to recent diagnosis
  }
  // In ext_marketing_message_templates.legalBasis
  // For vaccine_due template: legalBasis=contract, validator must ensure no marketing keywords
  // For dental_recall triggered by SOAP detection: legalBasis=consent (upsell)
  ```
  - Implement validator validateMarketingText that checks if legalBasis=contract but body contains promotional keywords (discount, %, free, offer) → block or reclassify.
  - Add ext_service_opt_outs table for clients who opt out of service reminders (must be honored even though not legally required, but good practice).
  - For rabies: always service, even without any consent, but still respect sympathy gate and suppressions.

### Overall compliance checklist summary

| Requirement | Status (inferred) | Action |
|---|---|---|
| Sympathy gate unconditional block | ✅ Implemented per description | Must be enforced in all new autopilot handlers; add integration test |
| Medical decisions never auto-commit | ✅ Enforced via confirmation envelope per description | Extend to inventory, withdrawal, euthanasia; add field-level locks |
| Voice audio 24h purge | ✅ Implemented per description | Ensure autopilot does not cache audio; audit S3 retention |
| SMS consent ledger | ✅ Partial | Add email consent, double opt-in, service opt-out |
| Suppression lists | ✅ Partial | Extend to email marketing, add service opt-out |
| Media consents | ✅ Partial | Add expiration, renewal, automatic PII scan |
| AI audit ledger | ✅ Clinical only | Create ext_automation_audit_log + ext_automation_events + chain |
| Approval queue | ❌ Missing per description | Create ext_approval_queue + router + cron + UI |
| Clinical corrections rollback | ✅ Implemented | Extend to inventory corrections |
| Controlled substances AI block | ❌ Missing explicit block per description | Add AI blocklist + DB trigger + audit |
| Treatment diary vet signature | ❌ Missing KVL field per description | Add vetKvlNumber columns + confirmation envelope |
| RVPS 3-day notification | ✅ Table exists per description | Add cron escalation |
| GDPR SAR export | ❌ Missing unified export | Build compliance.exportClientData joining all consent + audit tables |
| Article 22 profiling transparency | ❌ Missing | Add segment reason codes, opt-out, human review flag |
| Article 9 pet health handling | ⚠️ Ambiguous | Treat as high-sensitivity, require marketing consent |
| ePrivacy service vs marketing | ⚠️ Needs classification | Implement legalBasis validator + service opt-out |

---

## Implementation roadmap (phased, per vision)

### Phase 1 (must-have for autopilot MVP)

- [ ] Create `packages/db/schema/ext_automation.ts` with ext_automation_events, ext_automation_audit_log, ext_approval_queue, ext_service_opt_outs, ext_client_segments, ext_segment_opt_outs [ASPIRATIONAL]
- [ ] Implement `lib/autopilot/consent-gate.ts` with canSendService, canSendMarketing, canPublishSocial using existing tables [ASPIRATIONAL]
- [ ] Extend processQueue to check email_suppressions for email channel + service opt-out
- [ ] Implement approval queue router `extensions/approvals.ts` + cron approval-timeout + staff tasks integration
- [ ] Add compliance router with exportClientData for SAR
- [ ] Add navigation item in custom-nav.ts for approval queue + audit log viewer
- [ ] Add i18n keys to messages/en.json and messages/sk.json
- [ ] Add PII scanner for review replies + social content before publish
- [ ] Write tests: sympathy gate blocks all new event types, consent gate blocks when revoked, rate limit, quiet hours

### Phase 2 (social publishing)

- [ ] Enforce media consent chain at publish time: ext_marketing_content_items publish mutation must verify mediaAssetId.consentId valid + not revoked
- [ ] Add validatorVerdict check: if clinical claim detected → require vet approval
- [ ] Add ext_automation_audit_log entries for content_drafted/published/blocked

### Phase 3 (data entry copilot)

- [ ] Implement confidence scoring per field, store in audit log
- [ ] Implement field-level locks for critical fields
- [ ] Build diff UI with confirmation envelope flow
- [ ] Ensure clinical_record_corrections rollback works for AI-committed records
- [ ] Add controlled substance AI blocklist

### Phase 4 (predictive AI)

- [ ] Implement segmentation with reason codes + human review flag
- [ ] Add profiling opt-out + Article 22 transparency
- [ ] Add A/B testing with consent

---

## Assumptions that need confirmation against real code

1. `packages/db/schema/ext_marketing.ts` actually contains `ext_marketing_media_consents`, `ext_marketing_media_assets` with CHECK, `ext_marketing_message_logs` with status blocked_sympathy, `ext_sms_delivery_log`, `ext_marketing_content_items` with validatorVerdict, `ext_marketing_reviews`. If names differ, schema design must adapt.
2. `lib/marketing/messaging.ts` actually implements `applySympathyGate`, `createMessagesForTrigger`, `processQueue`, `marketingConsentOk`, `smsRateLimitOk`, `isQuiet`, `SYMPATHY_BLOCKED` set. If not, sympathy enforcement points change.
3. `apps/web/server/routers/extensions/_safety.ts` actually exports `assertPatientNotDeceased`, `requireConfirmationEnvelopeId`, `requireExpectedRevision`. If not, clinical gate enforcement location changes.
4. `packages/db/schema/ext_statutory.ts` / `ext_crsz.ts` actually contain withdrawal periods, rabies notifications, carcass disposals. If not, statutory compliance tables need creation.
5. `packages/db/schema/ext_voice.ts` actually has audioFileKey, scheduledDeleteAt, audioDeletedAt and 24h purge cron exists.
6. `apps/web/lib/communications/policy.ts` is minimal (subject/content length only) — if it already has frequency logic, §A7 changes.
7. Existing `ext_ai_audit_log` chain integrity implementation exists in `lib/ai/audit-chain.ts` — need to verify to reuse for new audit log.
8. Whether `clients` table already has profilingOptOut or service opt-out — if exists, F3/F5 actions simpler.

If any assumption is wrong, the consent architecture and audit ledger foreign keys must be updated to match real column names.

---

## References (described paths — not verified via filesystem)

- `.agents/skills/openvpm-ai/SKILL.md` — architectural constraints, sympathy gate, GDPR 24h purge, ext_* isolation, extensions router mounting, custom-nav, i18n symmetry
- `packages/db/schema/consents.ts` — clinical consent forms + requests
- `packages/db/schema/sms-consent-events.ts` — SMS consent ledger
- `packages/db/schema/communications.ts` — communications table, audit_log
- `packages/db/schema/messaging.ts` — sms_suppressions, email_suppressions
- `packages/db/schema/clients.ts` — smsConsent boolean + source
- `packages/db/schema/patients.ts` — status enum active/inactive/deceased
- `packages/db/schema/ext_marketing.ts` — media consents, content items, message logs with blocked_sympathy, sms_delivery_log, recall schedules
- `packages/db/schema/ext_ai_audit_log.ts` — AI audit ledger with chain integrity
- `packages/db/schema/clinical-corrections.ts` — append-only corrections
- `packages/db/schema/controlled-substances.ts` — controlled substance log
- `packages/db/schema/ext_statutory.ts` / `ext_crsz.ts` — withdrawal periods, rabies notifications, carcass disposals
- `packages/db/schema/ext_voice.ts` — voice dictations with 24h purge
- `apps/web/lib/communications/policy.ts` — subject/content length checks
- `apps/web/lib/marketing/messaging.ts` — sympathy gate, rate limit, consent check, processQueue
- `apps/web/lib/marketing/sms-rate-limit.ts` — unified rate limit
- `apps/web/server/routers/care-reminders.ts` — sympathy gate + suppression checks
- `apps/web/server/routers/extensions/_safety.ts` — assertPatientNotDeceased, requireConfirmationEnvelopeId
- `apps/web/server/routers/extensions/marketing.ts` — marketing router with sympathy blocked stats
- `docs/enterprise-trust/DPA_SLOVAKIA.md` — DPA, controller/processor
- `docs/enterprise-trust/DATA_SOVEREIGNTY_AND_RETENTION.md` — 10y audit retention, 24h audio
