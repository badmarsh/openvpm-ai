# OpenVPM AI — Autopilot Vision: Roadmap & Cost-Benefit Analysis

**Artifact:** Agent 5 output · **Date:** 2026-09-12 · **Anchor commit:** `23f23a3` (branch `arena/01a09595-openvpm-ai`)
**Vision:** *"OpenVPM should automatically answer: 'What happened in the clinic today, and what safe, relevant, measurable communication action can we create from it?'"*

---

## 🔎 Session environment & verification status (Agent 5, 2026-09-12)

**How this audit was performed:** this session ran inside a real cloned checkout of
`badmarsh/openvpm-ai` at `/home/user/openvpm-ai`, branch `arena/01a09595-openvpm-ai`,
commit `23f23a31d2b89183056ff75143bebbbc5c636ca5` (verified via `git rev-parse HEAD` at
write time). Every `[VERIFIED: path:Lnn]` tag below comes from an actual read of that checkout —
e.g. `apps/web/server/routers/extensions/marketing.ts` (3,491 lines), `apps/web/lib/marketing/messaging.ts`
(710 lines), `packages/db/schema/ext_marketing.ts` (412 lines) — **not** from the megaprompt's
file-path descriptions and not from inference. Percentages in §A and the adjusted estimates in §C
are computed from those reads.

**If this artifact is reused in a context where the repository cannot be read — or against the
developer's local tree, which may differ from commit `23f23a3` — the following are the claims a
fresh code read would most change (re-confirmation checklist):**

1. **§A maturity percentages** (Social ~45%, CRM ~35%, Copilot ~65%, Reputation ~35%, Event engine ~45%).
   Recompute against the local tree if it contains automation/marketing commits after `23f23a3`.
2. **The feature-map prior-art files** (`artifacts/feature-map-2026-09-12/*`: FEATURE-INDEX.md,
   REORGANIZATION-FINDINGS.md, domain audits) were absent from this checkout. If they exist in the
   local tree, cross-check §A and §C against the 430-feature index and reconcile the reported
   24 collisions before trusting my from-code recomputation.
3. **§C adjusted estimates** (journey engine 6→8d, rules engine 4→3d, voice wiring 2→1.5d,
   PDF→lab 4→5d) assume exactly the audited code state. Any event-bus or journey scaffolding added
   since would lower them; regressions would raise them.
4. **The highest-impact finding — "marketing message delivery is simulated"** — rests on reading
   `processQueue` at `apps/web/lib/marketing/messaging.ts:L376-464` and seeing status transitions
   with no SMS/email provider call. Re-verify before budgeting the Phase 1 send adapter (task 1.5),
   because if a send path exists elsewhere, the Phase 1 critical path shrinks materially.
5. **Trigger-emitter inventory** (3 points in `appointments.ts`, 3 in `discharge.ts`, condolence in
   `messaging.ts`) — re-check for additional emitters in billing/statutory/wellness routers.
6. Cron infra counts (18 route folders under `app/api/cron/*`, 16 registered in `vercel.json`) —
   cosmetic, affects no estimate.

All estimates that would NOT change with a code read (effort sizing methodology, KPI targets,
risk register, cost model) are tagged `[INFERRED]` / `[ASPIRATIONAL]` in-line.

---

## ⚠️ Method note: prior-art artifacts missing from this checkout

The megaprompt lists five prior-art files under `artifacts/feature-map-2026-09-12/`
(`FEATURE-INDEX.md`, `REORGANIZATION-FINDINGS.md`, `domains/marketing-communications.md`,
`domains/core-clinical.md`, `domains/scheduling-front-desk.md`, `domains/ai-agent.md`).
**None of these files exist in the checkout audited for this artifact** (commit `23f23a3`; the
`artifacts/` directory contains only `ai-feature-audit.md`, `audit-prompts/`,
`bug-hunt-remediation-report.md`, `dr-drill-report.json`, `production-readiness-report.json`,
`ux-codebase-analysis-2026-09-11.md`, and `git log --all` shows no commits touching
`artifacts/feature-map*`). They may well exist in the developer's local tree — they were simply
not in the state I could read.

**Consequence:** all maturity percentages in §A are computed by me from a primary-source audit of
the actual schema and routers (listed under *Sources*), not from the Agents 1–4 tables. Where the
megaprompt's claims could be checked against code, I did so and tagged the result.

**Tagging convention (enforced throughout):**
- `[VERIFIED: path:Lnn]` — read directly in code at the cited line (file-level when line not known).
- `[INFERRED]` — engineering deduction from verified facts.
- `[ASPIRATIONAL]` — target, estimate, or assumption not yet provable from code.

**Sources audited (all under repo root):**
`packages/db/schema/ext_marketing.ts` (412 ln), `ext_voice.ts`, `ext_lab_import.ts`, `care-reminders.ts`, `communications.ts`, `visit-closeouts.ts`, `consents.ts`, `clients.ts`; `apps/web/server/routers/extensions/marketing.ts` (3491 ln), `voice.ts`, `lab-import.ts`, `discharge.ts`; `apps/web/server/routers/appointments.ts`, `care-reminders.ts`, `notifications.ts`; `apps/web/server/vaccination-recalls.ts`; `apps/web/lib/marketing/messaging.ts` (710 ln), `planner.ts`, `validator.ts`, `sms-rate-limit.ts`; `apps/web/lib/inventory/wholesaler-import.ts`; `apps/web/lib/billing/ai-access.ts`, `usage.ts`; `apps/web/config/custom-nav.ts`; `apps/web/vercel.json` + `apps/web/app/api/cron/*`; `ROADMAP.md`; `artifacts/ai-feature-audit.md`; i18n dictionaries (2154 keys each, 0 drift — verified by script).

---

## §A. Current automation maturity assessment (per pillar)

### A1. Social media autopilot — **~45% built** (content engine ≈ 80%, publishing ≈ 5%, attribution 0%)

**Already built `[VERIFIED]`:**
| Capability | Evidence |
|---|---|
| Weekly content planner + batches | `createContentBatch`/`getWeeklyPlan`/`approveContentBatch` [VERIFIED: marketing.ts:L1562-1621]; `generateWeeklyBatch` in `lib/marketing/planner.ts` |
| AI multichannel copywriting (IG/FB/SMS/email) with Slovak template fallback | `generatePost` [VERIFIED: marketing.ts:L196] |
| AI image generation (Alibaba Wanx) + deterministic illustration fallback | `generateImageForPost`/`generateImage` [VERIFIED: marketing.ts:L372, L666] |
| AI video generation (Alibaba Wan, submit + poll) | `submitVideo`/`pollVideo` [VERIFIED: marketing.ts:L692, L716] |
| Media library with GDPR consent linkage (photo/social/web/TV/story/testimonial/marketing) | `extMarketingMediaAssets` + `listMediaAssets` [VERIFIED: marketing.ts:L2773] |
| KVL SR marketing validator (blocks Rx drug names, price claims, client names) + auto-fix | `validateContent`/`autoFixContentItem` [VERIFIED: marketing.ts:L644, L1692] |
| Approval workflow `proposed → approved → published` with vet-only approval | `createContentItem`/`approveContentItem` [VERIFIED: marketing.ts:L457, L512]; channel enum incl. `instagram, facebook, google_business, sms, email` [VERIFIED: ext_marketing.ts:L12] |
| Waiting-room TV slides + public endpoint | `listTvSlides`… `getPublicTvSlides` [VERIFIED: marketing.ts:L731-807, L2739] |
| Public handouts, clinic website (own site, not 3rd-party), brand kit | `getPublicWebsiteData` [VERIFIED: marketing.ts:L3311]; `getBrandInfo` L3090 |
| Competitor/market intelligence snapshots | `runCompetitorAnalysis` [VERIFIED: marketing.ts:L3169] |
| ŠVPS SR bulletin → educational social post | `createPostFromBulletin` [VERIFIED: marketing.ts:L3425] |

**Gap:** (1) **No publishing connectors exist** — there is no Facebook Graph / Instagram Content Publishing / Google Business Profile API client anywhere in `apps/web` (grep for `graph.facebook`, `mybusiness` etc. returns nothing but demo data) `[VERIFIED]`. The `published` status is set only by local approval, never by a platform API. (2) **YouTube Shorts** is not even in the channel enum `[VERIFIED: ext_marketing.ts:L12]`. (3) No **newsletter sending** adapter (marketing message delivery is simulated — see A5). (4) No **UTM/attribution** layer. (5) Brand voice exists per-practice via `getBrand` `[VERIFIED: planner.ts]`, but not a formal per-practice style system.
**Effort to close gap: M–L** (integration work is bounded; calendar risk from Meta App Review is the real cost — see §E-1).

### A2. CRM automation (segments, journeys, consent, suppression) — **~35% built**

**Already built `[VERIFIED]`:**
| Capability | Evidence |
|---|---|
| Automation rules CRUD + toggle + 4 seeded SK defaults (vaccine_due, postop_check, review_request, inactive_recall) | `listAutomationRules`/`upsertAutomationRule`/`toggleAutomationRule` [VERIFIED: marketing.ts:L2034-2183] |
| One-shot trigger engine with 9 trigger keys + offsets (booking confirm, reminders, thank-you, review ask, vaccine due ×2, no-show rebook, payment failed, post-op, wellness, dental ×2, senior) | `TRIGGERS` [VERIFIED: messaging.ts:L38-72] |
| Message templates with versioning, legal basis (`contract`/`consent`), per-practice overrides, i18n | `extMarketingMessageTemplates` + `upsertMessageTemplate` [VERIFIED: marketing.ts:L1905-1994] |
| Message log with rich suppression states (`suppressed_quiet|rate|no_consent`, `blocked_sympathy`) + idempotency keys | `extMarketingMessageLogs` [VERIFIED: ext_marketing.ts]; `createMessagesForTrigger` [VERIFIED: messaging.ts:L101] |
| Sympathy gate (deceased → block + dismiss care reminders + condolence task) | `applySympathyGate` [VERIFIED: messaging.ts:L467-565]; `SYMPATHY_BLOCKED` L24 |
| SMS frequency cap + quiet hours + unified cross-source delivery log | `smsRateLimitOk`, `isQuiet`/`nextAllowedTime` [VERIFIED: messaging.ts:L71-99]; `extSmsDeliveryLog` |
| Unsubscribe token flow (base64 token, public route, revokes consent + suppresses queued) | `getUnsubscribeInfo`/`unsubscribeByToken` [VERIFIED: marketing.ts:L2437-2570] |
| Media consent registry + revocation cascades (archives proposed items using revoked assets) | `revokeMediaConsent` [VERIFIED: marketing.ts:L2665-2737] |
| Post-op check-in loop with public response endpoint + staff escalation tasks | `submitPostopResponse` [VERIFIED: marketing.ts:L2185] |
| Vanilla-side suppression tables (`smsSuppressions`, `emailSuppressions`) used by the vanilla recall engine | [VERIFIED: vaccination-recalls.ts imports, L6-13] |

**Gap:** (1) **Segments: zero built.** No segment computation, table, or UI exists (grep for `segment` finds only unrelated hits) `[VERIFIED]`. The "12 segments" concept exists only in the vision `[ASPIRATIONAL]`. (2) **Journey engine: zero built.** The current engine is stateless one-shot trigger→message mapping with offsets; there is no enrollment table, no step sequencing, no exit conditions, no journey-level frequency cap `[VERIFIED: messaging.ts:L38-72]`. (3) **Consent/suppression is fragmented across 4+ systems** (vanilla `clients.smsConsent`, `smsSuppressions`/`emailSuppressions`, `extMarketingMediaConsents`, unsubscribe tokens) with no unified "why was this client suppressed" view `[INFERRED]`. (4) `inactive_recall` rule is seeded but **no engine executes it** — `inactiveRecallMonths` is only stored, never queried for candidates `[VERIFIED]` (grep shows only config CRUD + demo data). (5) `payment_failed` trigger has a rule but **no emitter anywhere** (dead code) `[VERIFIED]` (grep for `payment_failed` outside TRIGGERS returns nothing).
**Effort to close gap: L** (journey engine is the single largest build item in the program).

### A3. Data entry copilot — **~65% built**

**Already built `[VERIFIED]`:**
| Capability | Evidence |
|---|---|
| Voice → STT → SOAP draft in one call, with GDPR 24h audio purge (`scheduledDeleteAt`) + purge cron | `uploadAndProcess` [VERIFIED: voice.ts:L58]; `voiceDictations.scheduledDeleteAt` [VERIFIED: ext_voice.ts]; `/api/cron/voice-audio-retention` [VERIFIED: vercel.json:L14] |
| **Human-in-the-loop is already enforced**: AI SOAP saves as editable draft; only `clinicianConfirmed: true` finalizes, through shared SOAP lifecycle + clinician-confirmation envelope with content hashing | `prepareConfirmation`/`saveAsSoapNote` [VERIFIED: voice.ts:L530-612] |
| Voice → billable items extraction → invoice creation | `extractBillableItems`/`createBillFromExtractedItems` [VERIFIED: voice.ts:L901, L945] |
| In-house analyzer lab parsing (IDEXX, Fuji Dri-Chem, Mindray, Labtechnik, Inlab, Quickseal, generic CSV, manual) with report attach/assign/review flow | `parseFile`/`saveReport`/`assignReport`/`reviewReport` [VERIFIED: lab-import.ts:L22-255]; `analyzerTypeEnum` [VERIFIED: ext_lab_import.ts] |
| Delivery-note parsers for **8 wholesalers** (Cymedica, Pharmos, Samohýl, Henry Schein, Biopharm, Komvet, SG-Vet XML, Sanvet) | `parseWholesalerDeliveryNote` [VERIFIED: wholesaler-import.ts:L80-523] |

**Gap:** (1) **No confidence scoring** anywhere (grep `confidence` → only agent tools) `[VERIFIED]`. (2) **No unified AI approval queue** for drafted clinical fields `[VERIFIED]`. (3) **Delivery-note parser is not wired to any router/UI** — `parseWholesalerDeliveryNote` is referenced only by its own tests `[VERIFIED]`. This corroborates the megaprompt's Finding #13 claim ("parser exists — just needs wiring"), though I cannot read the finding itself. (4) **PDF/email → lab result ingestion absent** (parsers handle analyzer export files, not PDFs or inbound email; the Laboklin HL7/IMAP fetcher is already planned in `ROADMAP.md` v0.7 `[VERIFIED: ROADMAP.md]`). (5) ŠVPS SR requirements for automated record entry (treatment diary, withdrawal periods) are supported by vanilla registers, but auto-drafting into them has no compliance review flow yet `[INFERRED]`.
**Effort to close gap: M** (voice path is nearly done; the remaining work is confidence + queue + PDF pipeline).

### A4. Reputation management — **~35% built**

**Already built `[VERIFIED]`:** `extMarketingReviews` table (platform google/facebook, rating, reply fields, request_sent/blocked fields) [VERIFIED: ext_marketing.ts:L126]; review CRUD + `unansweredOnly` filter [VERIFIED: marketing.ts:L901-970]; AI reply generation with tone selection + GDPR prompt rules + fallback templates [VERIFIED: marketing.ts:L1002]; reply validator (review_reply context) [VERIFIED: marketing.ts:L972]; seed/demo reviews; manual staff-task escalation for post-op concerns [VERIFIED: marketing.ts:L2185].

**Gap:** (1) **No live ingestion** from Google/Facebook (reviews are manual or seeded) `[VERIFIED]`. (2) No **sentiment classification** or auto-prioritization. (3) No **response-time SLA tracking** (fields exist but no analytics). (4) No **reply posting** back to the platform. (5) No rating trend dashboard.
**Effort to close gap: M** (UI is done; OAuth + APIs + classification is the work).

### A5. Event-driven marketing engine — **~45% built**

**Already built `[VERIFIED]`:** event-triggered messaging at 3 verified emitters — appointment status transitions (`visit_completed`, `appointment_no_show`, `appointment_booked`) [VERIFIED: appointments.ts:L1394-1434]; discharge flow (`surgery_completed`, `dental_detected`, `senior_milestone`) [VERIFIED: discharge.ts:L619-634]; condolence flow [VERIFIED: messaging.ts:L467]. Idempotent message creation (`idempotencyKey` unique) [VERIFIED: messaging.ts:L203]. A **separate vanilla vaccination-recall engine** with candidate computation, dedupe keys, suppressions, and quiet hours [VERIFIED: vaccination-recalls.ts]. Recall schedule config (vaccination lead days, review delay, inactive months) [VERIFIED: marketing.ts:L1330-1369].

**Gap:** (1) **No event bus** — events fire inline and disappear; no `ext_automation_events` table exists `[VERIFIED]`; no replay, no audit trail, no cross-engine consumption. (2) **No invoice-paid or visit-closeout emitters** — the ideal event source `visitCloseouts.completedAt` [VERIFIED: visit-closeouts.ts:L195] is not consumed; the current `visit_completed` trigger fires on appointment `checked_out` before closeout exists `[INFERRED]`. (3) **Marketing message delivery is simulated** — `processQueue` transitions rows to `delivered` but calls no SMS/email provider `[VERIFIED: messaging.ts:L376-464]` (the vanilla engine does real sends via `@/lib/sms`). This is the single most important blocker to CRM-automation value. (4) Two parallel recall/reminder engines (vanilla + marketing) with overlapping concerns (vaccine reminders exist in both) `[VERIFIED]`. (5) No treatment-plan nudge, no reactivation executor.
**Effort to close gap: M–L** (bus + emitters + processor + send adapter).

**Pillar summary:**

| Pillar | % built | Gap | Effort to close |
|---|---|---|---|
| 1 Social autopilot | ~45% | Publishing APIs, YouTube, newsletter send, UTM | **M–L** |
| 2 CRM automation | ~35% | Segments, journeys, unified consent/suppression | **L** |
| 3 Data entry copilot | ~65% | Confidence scoring, approval queue, PDF/email lab, delivery-note wiring | **M** |
| 4 Reputation | ~35% | Live ingestion, sentiment, SLAs, reply posting | **M** |
| 5 Event-driven engine | ~45% | Event bus, closeout/invoice emitters, real send adapter, journey execution | **M–L** |

---

## §B. Phased roadmap

Effort = **senior dev days** (one senior full-stack dev, per phase; parallelizable where noted). Calendar targets are the owner's stated goals `[ASPIRATIONAL]`; dev-day totals below are my estimates `[INFERRED]` from the audited codebase. All new tables must be `ext_*.ts`, routers under `apps/web/server/routers/extensions/`, nav via `custom-nav.ts`, i18n into BOTH `messages/en.json` and `messages/sk.json` (SKILL.md `[VERIFIED: .agents/skills/openvpm-ai/SKILL.md]`).

### Phase 1 — Foundation (target 6–8 weeks, ~31–36 dev days)

| # | Feature | Effort (d) | Depends on | Risk | Quick win? |
|---|---|---|---|---|---|
| 1.1 | **Unified suppression & consent center** — single query surface over `clients.smsConsent`, `smsSuppressions`/`emailSuppressions`, `extMarketingMediaConsents`, unsubscribe tokens, sympathy gate; per-client "why suppressed" view + bulk audit export | 3 | — (all tables exist) | Low | ✅ Yes — pure UI + read model over existing data |
| 1.2 | **`ext_automation_events` schema + `db:push`** (practiceId, type, entity ids, payload jsonb, idempotency key, processedAt) | 1 | — | Low | ✅ |
| 1.3 | **Event emitters (5 points)** — (a) appointment `checked_out`, (b) `visitCloseouts.completedAt`, (c) invoice paid (billing router), (d) vaccine administered (statutory/vaccination), (e) condolence; keep existing `createMessagesForTrigger` call sites working | 2 | 1.2 | Medium | ❌ (needs bus) |
| 1.4 | **Event processor** — Vercel cron `/api/cron/automation` (infra pattern exists `[VERIFIED: vercel.json:L8-38]`), claim-and-process with retries, fan-out to rules | 3 | 1.2 | Medium | ❌ |
| 1.5 | **Send adapter (CRITICAL PATH)** — make `processQueue` actually transmit via `@/lib/sms` + `@/lib/email`, keep suppression states, add delivery receipts | 2 | — | Medium | ✅ |
| 1.6 | **CRM segment computation (12 segments)** — nightly materialization into `ext_client_segments` (churn-risk 6+/12+/18+ mo, puppy/kitten, senior 7+/8+, dental-flag, chronic/on-treatment, wellness enrolled, high-LTV, new client <30d, post-op, no-show risk, vaccine due <14d, all-deceased/do-not-contact) | 3 | — (queries over existing tables) | Low | ✅ |
| 1.7 | **Journey engine v1** — `ext_journeys`, `ext_journey_enrollments`, `ext_journey_steps`; 5 built-in journeys: welcome, post-visit follow-up, vaccination reminder, post-op check-in, reactivation; per-journey frequency caps; sympathy + consent gates at **every** step | 6 | 1.4, 1.5 | High | ❌ (core platform) |
| 1.8 | **Reputation inbox** — unify `extMarketingReviews` UI + AI reply drafts + sentiment labels + response-time SLA badge; (live API ingestion is Phase 2) | 2 | — | Low | ✅ |
| 1.9 | **Content calendar with manual approval** — largely exists (`/marketing/plan`); polish = review-queue page + approve/reject/auto-fix in one screen | 1.5 | — | Low | ✅ ship in week 1 |
| 1.10 | **Automation dashboard** — delivered / replied / booked / opted-out per journey + campaign (extend `getMessageStats` [VERIFIED: marketing.ts:L1867]) | 2 | 1.5, 1.7 | Low | ✅ |
| 1.11 | **Unify vaccine recall** — route vanilla recall candidates through the same suppression/consent center (read-only, do not modify vanilla router) | 2 | 1.1 | Medium | ✅ |
| 1.12 | **i18n + tests** — `en.json`/`sk.json` symmetry for all new keys; safety tests (sympathy gate, consent, rate cap) | 3 | all above | Low | — |

**Phase 1 exit criteria:** deceased patient can never receive outreach (test-enforced); every message passes one central suppression check; 5 journeys execute end-to-end in shadow mode; dashboard shows real sent counts. Note: pipeline target weeks assume 1 dev; with 2 devs, ~4–5 weeks.

### Phase 2 — Social Autopilot (target +4–6 weeks, ~16–20 dev days)

| # | Feature | Effort (d) | Depends on | Risk | Quick win? |
|---|---|---|---|---|---|
| 2.1 | Google Business Profile API (reviews ingest + reply post + post publishing) — OAuth per practice, credential vault, token refresh | 3 | 1.1, 1.8 | Medium | ✅ reviews ingestion alone is |
| 2.2 | Facebook Page API (read reviews, publish posts) | 2 | 1.1 | High (App Review) | ❌ |
| 2.3 | Instagram Content Publishing API (media container → publish, carousel) | 2 | 2.2 (same Meta app) | High (App Review) | ❌ |
| 2.4 | YouTube Shorts publishing (new channel enum value, OAuth, upload flow) | 3 | — | Medium | ❌ |
| 2.5 | Publisher service — `published` status ⇐ platform API result, per-platform error surfacing, retry/backoff, publish receipt in content item | 3 | 2.1–2.4 | Medium | ❌ |
| 2.6 | Content brief → AI text+image pipeline (event brief → `generatePost` + Wanx) — largely exists; work = brief triggers from events + auto-scheduling | 2 | 1.4 | Low | ✅ |
| 2.7 | Brand voice per practice (formal style profile: tone, vocabulary, banned claims; feed into prompts) | 1 | — | Low | ✅ |
| 2.8 | UTM + attribution layer (booking page links tagged, appointment source capture, revenue attribution) | 3 | — | Medium | ✅ |
| 2.9 | Newsletter send (email channel adapter + list building from consent + unsubscribe) | 2 | 1.5 | Medium | ✅ |

**Phase 2 exit criteria:** one practice can publish to GBP + FB + IG from the approval queue; Meta App Review submitted **at Phase 1 start** (lead time 2–8 weeks `[ASPIRATIONAL]`) so it cannot block the calendar.

### Phase 3 — Data Entry Copilot (target +6–8 weeks, ~13–17 dev days)

| # | Feature | Effort (d) | Depends on | Risk | Quick win? |
|---|---|---|---|---|---|
| 3.1 | Delivery note → inventory wiring (UI upload → `parseWholesalerDeliveryNote` → preview grid → confirm receipt) | 1.5 | — (parser + tests exist) | Low | ✅ |
| 3.2 | PDF → lab result draft (PDF text extraction for 2–3 common SK lab layouts + reuse analyzer parsing; always draft-until-reviewed) | 4 | 1.1 (draft safety) | High | ❌ |
| 3.3 | Email/IMAP attachment ingestion for labs (align with planned Laboklin fetcher `[VERIFIED: ROADMAP.md]`) | 3 | 3.2 | High | ❌ |
| 3.4 | Confidence scoring — per-field heuristic + model-based score (transcription confidence, source reliability, normal-range agreement), stored per draft | 2 | — | Medium | ❌ |
| 3.5 | **Approval queue for AI-drafted clinical fields** — unified queue (voice SOAP, lab drafts, delivery previews), role-gated vet confirmation, ŠVPS SR register write-lock until confirmed | 3 | 3.1–3.4 | Medium | ❌ |
| 3.6 | Voice → SOAP polish (post-dictation editing UX, re-dictate section, dictation list status) | 1.5 | — | Low | ✅ |

**Phase 3 exit criteria:** zero auto-committed clinical writes (asserted by tests reusing the existing clinician-confirmation envelope pattern [VERIFIED: voice.ts:L530-612]); every accepted suggestion is attributable.

### Phase 4 — Predictive AI (target +8–12 weeks, ~18–24 dev days)

| # | Feature | Effort (d) | Depends on | Risk | Quick win? |
|---|---|---|---|---|---|
| 4.1 | Churn risk score (heuristic first: recency/frequency/gap/deceased/consent; model later once real data exists) | 3 | 1.6 | Low | ✅ heuristic ships alone |
| 4.2 | Optimal send time (quiet-hours-aware per-practice distribution from delivery/read data) | 2 | 1.5 | Low | ✅ |
| 4.3 | Appointment fill prediction → local campaign trigger (gap analysis on schedule + waitlist auto-invite) | 4 | 1.4 | Medium | ❌ |
| 4.4 | A/B testing (message variant schema, assignment, outcome aggregation: open/reply/booked) | 4 | 1.7 | Medium | ❌ |
| 4.5 | Revenue attribution per campaign (UTM + appointment source + invoice join) | 3 | 2.8 | Medium | ❌ |
| 4.6 | ML model pipeline (optional; only after ≥20 practices of data) | 4 | 4.1 | High | ❌ |

**Total program: ~78–97 senior dev days** across phases 1–4 (≈ 20–26 dev-weeks single-dev; ≈ 4–5 calendar months with 1–2 devs, excluding Meta/Google review lead times). `[INFERRED]`

---

## §C. Effort estimate table (all Agent 1–4 tasks, verified & adjusted)

Where the megaprompt's estimate differs materially from what the code shows, I adjust and explain. "Dev days" = senior full-stack dev.

| Task | Est. dev days (prompt) | Verdict vs. code | Adjusted | Risk | Prerequisite |
|---|---|---|---|---|---|
| `ext_automation_events` schema + migration | 0.5 | ✔ No event table exists `[VERIFIED]`; `db:push` flow is standard | 1 | Low | — |
| Event emitter integration (5 trigger points) | 2 | ✔ Correct scale; 3 of 5 emit sites already call trigger functions `[VERIFIED: appointments.ts:L1394-1434, discharge.ts:L619-634]`; add closeout + invoice-paid + event-row writes | 2 | Medium | event schema |
| Event processor (cron + pg polling) | 3 | ✔ Cron infra exists (18 route folders under `app/api/cron/*`, 16 registered in `vercel.json`) `[VERIFIED]`; claim/retry pattern proven in vanilla reminders `[VERIFIED: vaccination-recalls.ts]` | 3 | Medium | event schema |
| Rules engine CRUD + matching logic | 4 | ⚠ Partially exists (`extMarketingAutomationRules` + enable/disable) `[VERIFIED: marketing.ts:L2034-2183]`; work = conditions on segments + event payload matching | 3 | Medium | event processor |
| Journey engine (enrollments + step execution) | 6 | ✔ Nothing exists; stateless trigger map only `[VERIFIED: messaging.ts:L38-72]`. Estimate is tight; +2d for exit conditions & caps | 8 | High | rules engine |
| CRM segment computation (12 segments) | 3 | ✔ No segments exist; 12 SQL materializations over existing tables; keep `ext_client_segments` | 3 | Low | existing schema |
| Suppression engine (all gates unified) | 2 | ✔ Gates exist but fragmented across 4 systems `[VERIFIED]`; work = central evaluator + UI | 3 | Low | existing tables |
| Reputation inbox UI + AI reply | 2 | ⚠ Mostly exists already `[VERIFIED: marketing.ts:L901-1060]`; work = sentiment + SLA + polish | 2 | Low | `extMarketingReviews` |
| Content brief generation | 1 | ⚠ Weekly batch planner exists `[VERIFIED: marketing.ts:L1562-1621]`; work = event-driven briefs | 1 | Low | existing AI router |
| Approval queue (schema + UI) | 3 | ✔ Nothing exists; pattern reuse from content approval `[VERIFIED: marketing.ts:L512]` | 3 | Medium | — |
| Google Business Profile integration | 3 | ✔ No client exists; OAuth + review/post APIs; add 1d for token vault | 4 | Medium | OAuth setup |
| Meta Graph API integration | 4 | ✔ No client exists; dev days fine but **calendar** is 2–8 weeks for App Review | 4 | High | App review required |
| Voice → SOAP draft wiring | 2 | ⚠ **Already ~90% built** — upload→STT→SOAP→confirm→save exists `[VERIFIED: voice.ts:L58, L530, L612]`; work = confidence + queue | 1.5 | Low | `ext_voice.ts` |
| PDF → lab result draft | 4 | ✔ PDF pipeline absent; parser covers analyzer exports only `[VERIFIED: lab-import.ts:L22]` | 5 | High | PDF parsing |
| Delivery note integration | 1 | ✔ Correct — parser for 8 wholesalers exists, referenced only from tests `[VERIFIED: wholesaler-import.ts:L80]` | 1.5 | Low | existing parser |

**Total (adjusted): ~45.5 dev days** for the Agent 1–4 task list; Phases 1–2 of §B absorb most of it. `[INFERRED]`

---

## §D. Success metrics framework (per pillar, with targets and data sources)

Targets marked `[ASPIRATIONAL]`; **Data source** columns map each KPI to concrete tables/queries so instrumentation is buildable today.

### D1. Social autopilot
| KPI | Target | Data source (existing / new) |
|---|---|---|
| Content items published/month per practice | ≥ 8 | `extMarketingContentItems.status='published'` + `publishedAt` `[VERIFIED: ext_marketing.ts]` |
| % approved without edits | > 60% | `approveContentItem` vs `updateContentItem`/`autoFixContentItem` sequence `[VERIFIED: marketing.ts:L512, L1692]`; log approval-with-edit flag |
| Engagement rate vs. vet benchmark (3–5%) | ≥ 3% | New: platform insights pull (GBP/FB/IG) |
| Appointments booked via UTM social link | track & grow MoM | `bookingPages` + new `appointmentSource` capture (Phase 2.8) |

### D2. CRM automation
| KPI | Target | Data source |
|---|---|---|
| % clients in ≥ 1 active journey | > 80% | `ext_journey_enrollments` (new) ÷ active clients `[VERIFIED: clients.ts]` |
| Reactivated clients/month (absent > 6 mo → visit) | per-practice floor set at launch | `appointments` join `clients` last-visit gap (segment 1.6) |
| Vaccination recall conversion (reminder → booked) | > 30% | vanilla recall sends `[VERIFIED: vaccination-recalls.ts]` → `appointments.status='confirmed'` |
| Opt-out rate per campaign | < 2% | `unsubscribeByToken` events + `clients.smsConsent=false` deltas `[VERIFIED: marketing.ts:L2503]` |
| Sympathy-gate violations | **0** (hard) | `extMarketingMessageLogs.status='blocked_sympathy'` audit + safety tests |

### D3. Data entry copilot
| KPI | Target | Data source |
|---|---|---|
| Minutes saved per visit | 5–10 | time-to-closeout (`visitCloseouts.completedAt − clinicalFinalizedAt`) before/after `[VERIFIED: visit-closeouts.ts:L195]` |
| % AI-suggested fields accepted without edit | > 70% | draft vs confirmed content hash comparison (pattern exists `[VERIFIED: voice.ts:L530-612]`) |
| % fields corrected after suggestion | < 15% | same hashes |
| Controlled-substance register errors | **0** | `controlled-substances` audit ledger (auto-drafting must never write here) |

### D4. Reputation management
| KPI | Target | Data source |
|---|---|---|
| % reviews answered ≤ 24h | > 90% | `extMarketingReviews.receivedAt` vs `repliedAt` `[VERIFIED: ext_marketing.ts:L126]` |
| Avg response time | < 4h | same fields |
| Google rating trend (90d) | ≥ +0.1 | ingested ratings (Phase 2.1) |
| Escalations to manager/month | decreasing trend | `extMarketingStaffTasks` kind `postop_escalation`/new `review_escalation` `[VERIFIED: ext_marketing.ts]` |

### D5. Marketing automation (revenue)
| KPI | Target | Data source |
|---|---|---|
| Revenue attributed to automated campaigns | baseline + X% (set per pilot) | UTM → booking → `invoices` join (Phase 4.5) |
| Cost per reactivated client | < 0.3 × visit value | SMS/AI cost (usage `sms|ai_run` kinds `[VERIFIED: usage.ts:L9]`) ÷ reactivations |
| Treatment-plan completion rate (with vs without nudge) | +10 pts vs control | `visitTreatmentPlans`/`treatmentPlanEvidence` join enrollments |
| Unsubscribe rate per journey type | < 2%/journey | journey + unsubscribe join |

---

## §E. Risk register (top 10)

| # | Risk | Prob | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| 1 | **Meta App Review delays** (FB/IG publishing requires Meta approval; reviews can take weeks or be rejected) | High | High | Submit at Phase 1 start; design Phase 2 so GBP + newsletter ship without Meta; manual "copy to clipboard" fallback for FB/IG in the interim | Product |
| 2 | **GDPR Art. 9 exposure** (health data used for segmentation = special-category processing) | Medium | High | Segments computed and stored **within** the tenant DB only, never exported to ad platforms; publish only aggregate/consent-scoped content; update DPIA + DPA register (audit shows DPAs outstanding `[VERIFIED: ROADMAP.md]`) | Legal |
| 3 | **AI clinical content published without vet review** (marketing posts derived from clinical events leak patient/clinical detail) | Medium | High | Keep hard approval gate (`approveContentItem` vet-only `[VERIFIED: marketing.ts:L512]`); KVL validator + name guards on every generated body; extend `validateMarketingText` with clinical-detail patterns | Dev + Vet |
| 4 | **Suppression-engine failure** (deceased patient receives marketing) | Low | **Catastrophic** | Central suppression evaluator as the ONLY send path; sympathy gate test suite per journey step; kill-switch cron that blocks queue if gate fails; reuse `applySympathyGate` `[VERIFIED: messaging.ts:L467]` | Dev |
| 5 | **Over-messaging → client churn** (frequency caps not enforced across journeys) | Medium | High | Per-client global cap (e.g. 4/30d) at the send adapter, not per journey; unified `extSmsDeliveryLog` query already exists `[VERIFIED: ext_marketing.ts]`; alert on opt-out spikes | Product |
| 6 | **ŠVPS SR compliance for automated SOAP entry** (registers have legal evidentiary value) | Medium | High | Auto-drafts never write statutory registers; confirmation envelope pattern (hash + role + revision) extended to all clinical writes `[VERIFIED: voice.ts:L530-612]`; keep registers human-signed | Vet + Dev |
| 7 | **Upstream OpenVPM merge conflicts** with new `ext_*` tables | Medium | Medium | All new code in `ext_*` files + extensions routers (SKILL.md guardrails `[VERIFIED: SKILL.md]`); `pnpm db:push` only, never touch `_journal.json`; run symmetry + safety suites post-merge | Dev |
| 8 | **AI model availability** (Alibaba Wanx downtime stalls the content pipeline) | Medium | Medium | Existing fallback chain (procedural illustrations, static assets) `[VERIFIED: marketing.ts:L372-454]`; queue content without media; provider health endpoint already exists (`getAlibabaProxyStatus` L662) | Dev |
| 9 | **Data quality** (low-quality visit data → bad events → wrong journeys) | Medium | Medium | Emit from `visitCloseouts` completion (structured, constraint-checked `[VERIFIED: visit-closeouts.ts]`) not raw appointment flips; event payload versioning; shadow-mode first 30 days with human-reviewable logs | Dev + Product |
| 10 | **Vet adoption resistance** (automation perceived as threat to clinical judgment or as busywork) | Medium | Medium | Vet holds final approval everywhere (already the pattern `[VERIFIED: marketing.ts:L512, voice.ts:L612]`); frame as "saves documentation time"; onboarding demo data exists (`marketing-demo-data.ts`); pilot with one champion clinic (VetSykora PoC pattern `[VERIFIED: ROADMAP.md]`) | Product + Vet |

---

## §F. Strategic recommendation: what to build FIRST

**Decision: do NOT start with social publishing. Start with the event bus + send adapter + suppression center + vaccination recall, in that order.** Rationale:

1. **The closest lever to revenue is vaccination recall, and it already exists.** A production-grade vanilla recall engine with dedupe, suppressions and quiet hours is in place `[VERIFIED: vaccination-recalls.ts]`; the marketing engine also has a `vaccine_due` journey rule `[VERIFIED: marketing.ts:L2034+]. What's missing is (a) a real send adapter and (b) one unified suppression check. Wiring these two converts existing machinery into billable outcomes (recall conversion target >30%, §D2) with the smallest risk. **Ship in ~2 weeks.** `[INFERRED]`

2. **`processQueue` simulates delivery — fix before any journey work.** Today "sent" messages are marked `delivered` without calling an SMS/email provider `[VERIFIED: messaging.ts:L376-464]`. Every Phase-1 journey is meaningless until the send adapter (task 1.5) exists. This is the critical path.

3. **Event bus = the leverage point for the whole vision.** The north-star question ("what happened in the clinic today?") is unanswerable in a queryable way until events are durable. Five emitter points + a cron processor (pattern proven by the existing cron route infrastructure — 18 folders under `app/api/cron/*` `[VERIFIED]`) unlock every later phase (briefs, churn, fill prediction) without rework. Emit from `visitCloseouts` completion for schema-guaranteed payload quality `[VERIFIED: visit-closeouts.ts:L283-323]`.

4. **Consent/suppression center is the insurance policy.** Four fragmented consent/suppression systems exist today `[VERIFIED]`; unifying them is the prerequisite for any multi-channel outreach and for GDPR Art. 9 defensibility (§E-2, §E-4). Cheap (3d), ships standalone.

5. **Highest ROI single feature for the clinic: reputation inbox + review-ask journey.** The UI and AI replies already exist `[VERIFIED: marketing.ts:L901-1060]`; the post-visit `review_request` trigger already fires `[VERIFIED: appointments.ts:L1394-1434]`. Adding sentiment + SLA + GBP ingestion in Phase 2 turns this into a demonstrable differentiator. Vet practices live on Google reviews.

6. **Defer all ML.** Churn scores and send-time optimization should be heuristics until real clinics generate data (currently **0 production clinics** `[VERIFIED: ROADMAP.md]`). Spending Phase-4 effort before data exists optimizes noise.

**Recommended first 4-week slice (2 devs):**
- Wk 1–2: Send adapter (1.5) + suppression/consent center (1.1) + unified vaccine-recall path (1.11) + dashboard v1 (1.10) → **live pilot with champion clinic.**
- Wk 3: Event bus schema + 5 emitters (1.2, 1.3) + processor cron (1.4).
- Wk 4: Segments (1.6) + journey engine v1 with the 3 highest-value journeys first (vaccination reminder, reactivation, review ask) (1.7).

**Cost-benefit (illustrative, `[ASPIRATIONAL]` — verify at pilot):**
- Build cost: Phase-1 slice above ≈ 20 dev-days ≈ €9–12k at SK senior-dev blended rate; full program ≈ 78–97 dev-days ≈ €35–55k. Platform API/App-Review work adds zero marginal build cost but 2–8 weeks calendar.
- Operating cost per practice: SMS ≈ €0.04–0.08/message (SK); AI ≈ per-`ai_run` quota (5000 free-tier units already budgeted `[VERIFIED: usage.ts:L9-25]`); a recall-heavy practice sending ~300 msgs/mo ≈ €15–25/mo + AI overage.
- Benefit per practice per month (mid-practice, conservative): recall conversion 30% × ~40 due vaccinations × €30 avg visit ≈ **€360**; 2 reactivated clients × ~€40 avg visit ≈ €80 + follow-on LTV; 5–10 min saved × ~15 visits/day × front-desk cost ≈ **€600–900**; review-volume uplift → new-client acquisition (hard to price, treat as 0 in business case).
- Net: a single activated practice plausibly returns **2–5× the monthly ops cost** `[ASPIRATIONAL]`; the gating constraint is adoption, not unit economics.

**The one-line strategy:** *Phase 1 is the product. Phase 2 is a marketing checkbox that must wait on Meta/Google. Phases 3–4 are moats that only pay off once Phase-1 data flows.*
