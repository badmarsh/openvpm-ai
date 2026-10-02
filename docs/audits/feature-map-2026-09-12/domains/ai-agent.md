# AI Agent Domain — Feature Map

**Domain:** AI Agent & Clinical Decision Support  
**Source Audit:** `artifacts/ai-feature-audit.md` (commit `e723899`)  
**Grounding Protocol:** §0 compliance — all claims carry authoritative source tags

---

## A. Feature Inventory Table

| # | Feature | Route / Component | Min. Role | Read/Write | Model(s) | Source |
|---|---------|-------------------|-----------|------------|----------|--------|
| 1 | Agent Chat (tRPC) | `server/routers/agent.ts:run` | `admin`, `veterinarian` | Read/Write | `gemini-3.8-flash-medium` or Claude | [VERIFIED: agent.ts:30-116] |
| 2 | Agent API (REST) | `app/api/v1/agent/route.ts:POST` | API Key (`agent:run`) | Read/Write | Same as #1 | [VERIFIED: route.ts:42-83] |
| 3 | SOAP Note AI Draft | `app/(dashboard)/records/new-soap/[patientId]/page.tsx` | `veterinarian`, `admin` | Read (Draft) | `configuredModel()` | [VERIFIED: soap-draft.ts:148] |
| 4 | Discharge Summary Gen | `app/(dashboard)/agent/discharge/page.tsx` | `veterinarian`, `admin` | Read (Draft) | `configuredModel()` | [VERIFIED: discharge.ts:135] |
| 5 | Multimodal Imaging Analysis | `app/(dashboard)/agent/imaging/page.tsx` | `veterinarian`, `admin` | Read | `configuredModel()` (VLM) | [VERIFIED: imaging.ts:211-227] |
| 6 | Voice Dictation & Scribe | `app/(dashboard)/agent/voice/page.tsx` | `veterinarian`, `technician`, `admin` | Read→Write | `configuredModel()` | [VERIFIED: voice.ts:762-784] |
| 7 | Drug Dose Calculator | Agent tool `calculate_drug_dose` | `veterinarian`, `technician`, `admin` | Read | N/A (Local) | [VERIFIED: tools.ts:861-906] |
| 8 | Drug Safety Checker | Agent tool `check_drug_safety` | `veterinarian`, `technician`, `admin` | Read | N/A (Heuristic) | [VERIFIED: tools.ts:1260-1442] |
| 9 | Statutory Withdrawal Periods | Agent tool `check_withdrawal_periods` | `veterinarian`, `admin` | Read | N/A (DB query) | [VERIFIED: tools.ts:1818-1898] |
| 10 | Lab Trend Query | Agent tool `query_lab_trends` | `veterinarian`, `technician`, `admin` | Read | N/A (Local) | [VERIFIED: tools.ts:1148-1258] |
| 11 | Marketing Post Copywriter | `server/routers/extensions/marketing.ts:generatePostContent` | `admin`, `veterinarian`, `front_desk` | Write | `configuredModel()` | [VERIFIED: marketing.ts:230-268] |
| 12 | Marketing Image Gen | `server/routers/extensions/marketing.ts:generatePostVisual` | `admin`, `veterinarian`, `front_desk` | Write | Alibaba Wanx 2.1 | [VERIFIED: marketing.ts:400; alibaba-proxy.ts:14] |
| 13 | Marketing Video Gen | `app/(dashboard)/marketing/page.tsx:252` | `admin`, `veterinarian`, `front_desk` | Write | Alibaba Wan 2.1 | [VERIFIED: alibaba-proxy.ts:15, 42-62] |
| 14 | Review Reply Generator | `server/routers/extensions/marketing.ts:generateReviewReply` | `admin`, `veterinarian`, `front_desk` | Read | `configuredModel()` | [VERIFIED: marketing.ts:1015-1041] |
| 15 | Competitor Intelligence | `lib/marketing/competitors.ts:analyzeCompetitors` | `admin` | Read | `configuredModel()` | [VERIFIED: competitors.ts:144-180] |
| 16 | Marketing Quiz from Imaging | `server/routers/extensions/imaging.ts:createMarketingQuizFromImaging` | `veterinarian`, `admin` | Write | `configuredModel()` | [VERIFIED: imaging.ts:854-900] |
| 17 | Marketing Post from Discharge | `server/routers/extensions/discharge.ts:createMarketingPostFromCase` | `veterinarian`, `admin` | Write | `configuredModel()` | [VERIFIED: discharge.ts:794-825] |
| 18 | Statutory Bulletin Post Gen | `server/routers/extensions/marketing.ts:createPostFromStatutoryBulletin` | `admin`, `veterinarian` | Write | `configuredModel()` | [VERIFIED: marketing.ts:3441-3460] |

**Total Agent Tools:** 26 tools in `AGENT_TOOLS` array [VERIFIED: tools.ts]

---

## B. Import / Export Specifics

**No import/export functionality identified for AI agent features.**

The AI agent domain does not expose data import or export mechanisms. All AI-generated content (SOAP drafts, discharge summaries, marketing posts) is stored directly in PostgreSQL tables (`soapNotes`, `dischargeReports`, `extMarketingContentItems`) without intermediate file formats or bulk export capabilities.

[INFERRED — no import/export routes, CLI commands, or file handlers found in AI-related modules]

---

## C. Integration Specifics

### C.1 Model & Provider Configuration

- **Default Model:** `gemini-3.8-flash-medium` [VERIFIED: apps/web/lib/ai-models.ts:L11]
- **Resolution Chain:** `opts.model` → `process.env.AI_MODEL` → `process.env.AGENT_MODEL` → `DEFAULT_AI_MODEL` [VERIFIED: runner.ts:L66-73]
- **Alibaba Proxy Models:** Hardcoded constants `wanx2.1-t2i-turbo`, `wan2.1-t2v-turbo`, `qwen-plus` [VERIFIED: alibaba-proxy.ts:L14-16]
- **Per-Practice Configuration:** Not supported — model drift impacts entire fleet [INFERRED]

### C.2 Execution Constraints

- **Timeout:** 60-second hard deadline via `AbortController` [VERIFIED: runner.ts:L431-432]
- **Retries:** None — no application-level retry logic [INFERRED]
- **Idempotency:** Write tools lack idempotency keys; client resubmission after timeout can cause duplicate bookings/prescriptions [INFERRED]
- **Streaming:** Uses `generateText` (non-streaming) instead of `streamText` [VERIFIED: runner.ts:L436]
- **User Experience:** Blocking `TypingIndicator` spinner for up to 60 seconds [VERIFIED: agent/page.tsx:L678]
- **Temperature:** Not passed to `generateText`; upstream provider defaults apply (0.7–1.0) [VERIFIED: runner.ts:L436-449]

### C.3 Rate Limiting

- **Agent Runner:** 20 runs/minute per actor, 120 runs/minute per practice [VERIFIED: runner.ts:L43-44, L314-326]
- **Marketing Media Generation:** No rate limiting, no billing entitlement checks [VERIFIED: marketing.ts:L396-454]

### C.4 Context Size Caps

- **Turn Instruction:** 2,000 characters max (`AGENT_INSTRUCTION_MAX_LENGTH`) [VERIFIED: agent/policy.ts:L1]
- **History Window:** 20 turns max [VERIFIED: agent.ts:L99]
- **Model Output:** 4,096 tokens max [VERIFIED: runner.ts:L41]

---

## D. Docs-vs-Reality Pass

| Document | Claim | Status | Discrepancy |
|----------|-------|--------|-------------|
| `SECURITY.md:L41` | "All 26 agent tools enforce fail-closed role authorization" | **BROKEN** | `assertAgentRole()` enforces checks, but callers omit `userRole` from context, breaking all 26 tools [VERIFIED: agent.ts:L110-115, route.ts:L75-81] |
| `SECURITY.md:L42` | "AI write paths require explicit clinician confirmation with replay-safe envelopes" | **PARTIAL** | True for SOAP/imaging/discharge finalization. False for agent chat writes (`create_prescription`, `book_appointment`) which execute immediately when `allowWrites: true` [VERIFIED: agent.ts:L85, runner.ts:L417] |
| `SECURITY.md:L43` | "Audit logging uses tamper-evident SHA-256 hash chain" | **IMPLEMENTED** | Verified in `audit-ledger.ts:L100` with PostgreSQL advisory locking |
| `docs/agent-tool-security-matrix.md:L51` | `create_prescription`: "Clinician Confirmation Required?: Mandatory" | **ASPIRATIONAL** | Tool immediately writes `active` row to `prescriptions` table without interactive signature [VERIFIED: tools.ts:L2457] |
| `docs/agent-tool-security-matrix.md:L23` | `book_appointment`: "Clinician Confirmation Required?: Mandatory" | **ASPIRATIONAL** | Tool immediately inserts appointment without confirmation envelope [VERIFIED: tools.ts:L664] |
| `docs/clinical-ai-evaluation-scope.md` | "All clinical AI outputs logged to `ext_ai_audit_log`" | **INCOMPLETE** | Agent chat writes (`book_appointment`, `create_prescription`, `record_vital_signs`) and marketing generation bypass audit ledger [VERIFIED: tools.ts, marketing.ts] |
| `docs/data-retention-policy.md` | "Voice audio purged after 24 hours" | **IMPLEMENTED** | Verified via `/api/cron/voice-audio-retention` calling `purgeExpiredAudio()` [VERIFIED: voice/retention.ts:L57-64] |

---

## E. Friction / "Doesn't Make Sense" Notes

### E.1 CRITICAL: Broken Agent Context Role Injection

**Impact:** All 26 agent tools are inoperable in production.

**Root Cause:** 
- `agent.ts:L110-115` and `route.ts:L75-81` invoke `runAgent()` without providing `userRole` in context
- `assertAgentRole()` in `authorization.ts:L55` throws `Access denied` when `userRole` is undefined
- Model retries until `MAX_ITERATIONS (12)`, then terminates with fallback message

**Evidence:** [VERIFIED: agent.ts:L110-115, route.ts:L75-81, authorization.ts:L55]

### E.2 CRITICAL: Drug Safety Checker False-Negative Risk

**Impact:** `check_drug_safety` returns `safe: true` for dangerous drug interactions not covered by 3 hardcoded rules.

**Failure Mode:**
- Only checks: feline paracetamol/permethrin, human NSAIDs, NSAID+steroid combination
- Omits: Tramadol+SSRI/MAOI (serotonin syndrome), aminoglycosides+loop diuretics (ototoxicity), fluoroquinolones in immature animals
- Allergy matching uses substring comparison: generic "meloxicam" vs brand "Metacam" evaluates as `safe: true` [VERIFIED: tools.ts:L1420]

**Evidence:** [VERIFIED: tools.ts:L1321-1400]

### E.3 CRITICAL: REST API Foreign Key Syntax Error

**Impact:** Prescription creation via REST API crashes with PostgreSQL error `22P02`.

**Root Cause:**
- `tools.ts:L2513` sets `prescribedBy: ctx.userId`
- REST route sets `ctx.userId = "apikey:" + auth.ctx.apiKeyId` [VERIFIED: route.ts:L79]
- Schema expects UUID: `prescribedBy` references `users.id` [VERIFIED: schema/prescriptions.ts:L53-55]

**Evidence:** [VERIFIED: tools.ts:L2513, route.ts:L79, schema/prescriptions.ts:L53-55]

### E.4 HIGH: Prompt Injection Surface

**Impact:** Raw database fields (client names, patient notes, invoice items) reach model context unsanitized.

**Failure Mode:**
- Tool outputs pass raw, unsanitized data [VERIFIED: tools.ts]
- No boundary encapsulation tags (XML delimiters) around database records
- Maliciously crafted patient name (e.g., via online booking) reaches model verbatim [INFERRED]

**Evidence:** [VERIFIED: tools.ts, INFERRED: no sanitization layer]

### E.5 HIGH: Agent Chat Write Tools Escape Audit Chain

**Impact:** `book_appointment`, `create_prescription`, `record_vital_signs` write directly to domain tables without appending to `ext_ai_audit_log`.

**Evidence:** [VERIFIED: tools.ts:L664, L2457, L2169; marketing.ts contains zero references to extAiAuditLog]

### E.6 HIGH: Marketing Generation Escapes Billing Gates

**Impact:** `generatePostVisual` (Alibaba image generation) and `generatePostContent` contain no rate limiting and no billing entitlement checks.

**Evidence:** [VERIFIED: marketing.ts:L396-454; `readHostedAiAccess` never called]

### E.7 MEDIUM: Statutory Withdrawal Periods Unvalidated

**Impact:** `meatWithdrawalDays` and `milkWithdrawalDays` populated from unvalidated user input; no cross-reference against Slovak Law 39/2007 Z. z. or ŠÚKL SPC registers.

**Failure Mode:** Accidental entry of "0 days" causes agent to certify animal slaughter as legally safe immediately.

**Evidence:** [VERIFIED: tools.ts:L1864, statutory.ts:L154-166]

### E.8 MEDIUM: Lab Trend Interpretation Naive

**Impact:** `query_lab_trends` uses naive percentage difference without reference ranges.

**Failure Mode:**
- Fluctuations within normal range (ALT 25→35 U/L in 10–100 range) flagged as "increasing"
- Acute intermediate spikes returning to baseline labeled "stable"
- No mandatory disclaimer requiring veterinary diagnostic interpretation

**Evidence:** [VERIFIED: tools.ts:L1244]

### E.9 MEDIUM: No AI-Generated Label on Agent Chat

**Impact:** Agent chat interface displays no explicit AI-generated label or disclaimer on message bubbles.

**Evidence:** [VERIFIED: agent-message-bubble.tsx:L39-46 renders as generic muted bubble]

### E.10 LOW: No GDPR Article 13/14 Disclosure

**Impact:** No transparency disclosures informing pet owners that AI models process clinical encounters or photos.

**Evidence:** [INFERRED — no GDPR disclosure code found in codebase]

---

## F. Proposed User-Manual Section(s)

Based on the audit findings, the following user-manual sections are recommended:

### F.1 "AI Agent Chat — Enabling Write Operations"

**Purpose:** Explain the `allowWrites` toggle and its implications.

**Content:**
- How to enable write operations (appointments, prescriptions, vital signs)
- Warning that writes execute immediately without per-action confirmation
- Recommendation to review agent output before enabling writes
- Note that write toggling is not logged in audit trail

**Source:** [VERIFIED: agent.ts:L85, agent/page.tsx:L126]

### F.2 "AI-Generated Clinical Content — Review Requirements"

**Purpose:** Clarify clinician responsibility for AI-generated drafts.

**Content:**
- SOAP drafts, discharge summaries, and imaging analyses are drafts only
- Mandatory clinician review before finalization
- AI-generated content is logged in tamper-evident audit chain upon confirmation
- Agent chat outputs are not automatically logged

**Source:** [VERIFIED: audit-ledger.ts:L100, ai-draft-safety.test.ts]

### F.3 "Drug Safety Checker — Limitations"

**Purpose:** Disclose limitations of automated drug safety checking.

**Content:**
- Tool checks only common contraindications (feline paracetamol/permethrin, human NSAIDs, NSAID+steroid)
- Does not replace veterinary pharmacological knowledge
- Brand-name vs generic-name allergy matching limitations
- Mandatory manual verification for complex polypharmacy cases

**Source:** [VERIFIED: tools.ts:L1321-1400]

### F.4 "Marketing Content Generation — Billing & Rate Limits"

**Purpose:** Inform users about marketing generation constraints.

**Content:**
- Image and video generation may incur additional costs
- No automatic rate limiting (users should exercise discretion)
- Generated content is not logged in clinical audit trail
- AI-generated images carry "AI Vizuál" caption

**Source:** [VERIFIED: marketing.ts:L396-454, L442]

### F.5 "Voice Dictation — Audio Retention Policy"

**Purpose:** Explain 24-hour audio purge policy.

**Content:**
- Audio recordings automatically deleted after 24 hours
- Only transcribed text retained in SOAP notes
- Deletion is irreversible
- Complies with data retention policy

**Source:** [VERIFIED: voice/retention.ts:L57-64, docs/data-retention-policy.md]

### F.6 "Statutory Withdrawal Periods — Data Entry Requirements"

**Purpose:** Emphasize accuracy requirements for withdrawal period data.

**Content:**
- Withdrawal periods must comply with Slovak Law 39/2007 Z. z.
- Cross-reference with ŠÚKL SPC registers before entry
- Zero-day entries will certify immediate slaughter safety
- Agent relies on entered data without statutory validation

**Source:** [VERIFIED: tools.ts:L1864, statutory.ts:L154-166]

---

## Cross-References

- **Full Audit Report:** `artifacts/ai-feature-audit.md`
- **Security Matrix:** `docs/agent-tool-security-matrix.md`
- **Clinical AI Scope:** `docs/clinical-ai-evaluation-scope.md`
- **Audit Ledger:** `docs/ai-audit-ledger.md`
- **Data Retention:** `docs/data-retention-policy.md`

---

**Document Generated:** 2026-09-12  
**Commit Reference:** `23f23a3` (target) / `e723899` (audit baseline)  
**Auditor:** AI safety & applied-ML systems auditor  
**Protocol Compliance:** §0 grounding protocol — all claims carry source tags