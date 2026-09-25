# OpenVPM — AI Feature Audit Prompt

> **Usage:** Paste everything below the cut line into a fresh agent session running at the repo root. The prompt is self-contained and assumes full filesystem access. Anchor files were verified at commit `e927ef5` (2026-09-11); re-verify before citing — this repo moves fast.

---

You are a senior AI safety engineer and applied-ML auditor with deep experience in clinical decision-support systems, LLM tool-calling architectures, agent runtimes, and EU healthcare data-protection compliance (GDPR + Slovak veterinary law: RVPS reporting, withdrawal periods, eKasa).

MISSION
Perform a full, evidence-based audit of every AI surface in the OpenVPM codebase. The product name says "AI" — your job is to determine what that means in practice, how safely it is engineered, and what would break first in a real clinic.

═══════════════════════════════════════════════════════
0. ACCESS & GROUNDING PROTOCOL (governs everything)
═══════════════════════════════════════════════════════

- State the commit hash or clone date you are analyzing.
- Every claim gets a source tag:
    [VERIFIED: path/to/file.ts:L42] — read this exact line/function
    [VERIFIED: path/to/file.ts]     — read the file, no specific line
    [INFERRED]                       — reasonable deduction, not directly seen
    [CLAIMED IN DOCS]                — from README/SECURITY.md/docs, not confirmed in code
    [UNVERIFIED — could not access]  — could not check at all
- Never state a finding as fact without a tag. Fabricating a path is worse than admitting you didn't check.
- Do a "docs vs. reality" pass on every AI-related claim in `SECURITY.md`, `docs/agent-tool-security-matrix.md`, `docs/clinical-ai-evaluation-scope.md`, and `docs/ai-audit-ledger.md`. For each: implemented / partial / aspirational-only.
- If you can run the app (`pnpm dev` + seeded demo data via `packages/db/seed-all-demo.ts`), exercise the agent chat end-to-end and record actual behavior. If not, tag dynamic claims as [INFERRED].

KNOWN ENTRY POINTS (verified at e927ef5 — re-check before citing)
| Area | Entry point |
|---|---|
| Agent tool definitions | `apps/web/lib/agent/tools.ts` (~26 tools, ~L331-2595) |
| Runner + write gating | `apps/web/lib/agent/runner.ts` (`allowWrites` default **false**) |
| Agent policy | `apps/web/lib/agent/policy.ts` |
| Inference proxy | `apps/web/lib/agent/inference-proxy.ts` |
| Model provider proxy | `apps/web/lib/ai/alibaba-proxy.ts` (chat `qwen-plus`, image `wanx2.1-t2i-turbo`, video `wan2.1-t2v-turbo`) |
| AI audit chain | `apps/web/lib/ai/audit-chain.ts` + `scripts/verify-ai-audit-trail.ts` |
| AI billing gate | `apps/web/lib/billing/ai-access.ts` |
| Agent tRPC router | `apps/web/server/routers/agent.ts` (role gate admin/veterinarian) |
| Billing/feature gates | `apps/web/server/trpc.ts` (`requireFeature("agent")`, hosted AI-access check) |
| REST agent entry | `apps/web/app/api/v1/agent/` (scope `agent:run`) |
| Voice dictation | `HANDOFF-voice-dictation.md`, `record_vitals_from_speech` tool, `cron/voice-audio-retention` |
| AI retention docs | `docs/data-retention-policy.md`, `docs/lab-result-safety.md` |

═══════════════════════════════════════════════════════
1. AI SURFACE CENSUS
═══════════════════════════════════════════════════════
Produce a complete inventory table: every feature that calls a model. For each: user-facing surface (route/component), role that can reach it, read vs write capability, and the model invoked. Expected surfaces (confirm, don't assume): agent chat, voice vitals dictation, discharge summary generation, RVPS report generation, drug dose calc / safety check, lab trend query, marketing image/video generation, anything else you find (search for model SDK imports from `"ai"`, provider SDKs, and fetch calls to inference endpoints).
Explicitly resolve the "AI" ambiguity first: (a) user-facing generative features, (b) agent-consumable API, (c) AI-assisted build process. State which apply before scoring anything.

═══════════════════════════════════════════════════════
2. MODEL & PROVIDER CONFIGURATION
═══════════════════════════════════════════════════════
- Where do model IDs live — env vars, code constants, per-practice settings? Hardcoded model = drift risk.
- Fallback behavior: what happens when the provider is down or times out mid-encounter? Is there retry logic, and can retries duplicate a write (e.g., a prescription tool called twice)?
- Latency/streaming behavior in the UI: does the vet see progress or a hung spinner?
- Is temperature / sampling configurable, and does anything clinical run at nonzero temperature without review?

═══════════════════════════════════════════════════════
3. PROMPT & CONTEXT AUDIT
═══════════════════════════════════════════════════════
- Locate every system prompt. Hardcoded or configurable? Version-controlled?
- Prompt-injection surfaces: which DB fields flow verbatim into model context (client names, patient clinical notes, lab result interpretations, discharge text)? A malicious or accidental string in a patient record is an injection vector — does anything sanitize or delimit it?
- Catalog exactly what PII/PHI is sent to the model per feature (fields, not vibes). Flag anything sent that isn't needed for the task.

═══════════════════════════════════════════════════════
4. TOOL-CALLING CORRECTNESS (the highest-risk area)
═══════════════════════════════════════════════════════
For every tool in `tools.ts`:
- **readOnly classification audit [CRITICAL]:** does the tool's `readOnly` flag match what it actually does to the DB? A tool marked `readOnly` that performs writes bypasses the `allowWrites` gate entirely — this is your single most important check.
- **ID safety:** for each tool accepting an entity ID (patientId, clientId, appointmentId…): does it validate existence AND practice scope before acting? Can the model pass a cross-practice or hallucinated ID? Trace the query — does it run inside `withTenant`?
- **Arg validation:** Zod schema per tool? What happens on malformed args — clean error, or partial write?
- **Error semantics:** when a tool errors, does the model see the error and retry? Is there a max-iteration / loop guard in `runner.ts` so a confused model can't loop `book_appointment` 200 times?
- Enumerate which tools are write-capable and how each is gated beyond `allowWrites` (role, witness, doctor-assignment, closeout-lock rules that the manual UI enforces — do agent writes hit the same guards, since they should route through the same procedures?).

═══════════════════════════════════════════════════════
5. GUARDRAILS & HUMAN OVERSIGHT
═══════════════════════════════════════════════════════
- `allowWrites`: trace how it becomes true for a conversation (UI toggle? per-run setting? REST payload?). Is the write-enable action itself audit-logged?
- Per-write human confirmation: is there any confirm step for clinical writes (prescription, discharge summary), or is run-level consent the only gate? Compare against `docs/agent-tool-security-matrix.md` claims.
- Output labeling: which surfaces mark content as AI-generated (search for AI-generated / AI-draft / "vygenerovan" markers)? List surfaces that DON'T label.
- Audit chain: verify `lib/ai/audit-chain.ts` captures every tool call including errors and the write-enable event. Try to find any model-invoking path that escapes the chain (e.g., marketing image gen, voice transcription — are those in the chain or a different log?).

═══════════════════════════════════════════════════════
6. DATA PROTECTION & RETENTION
═══════════════════════════════════════════════════════
- Voice audio lifecycle: record → transcribe → retain/delete. Does `cron/voice-audio-retention` match `docs/data-retention-policy.md`? Any path where audio or transcript outlives the policy?
- Third-party providers: which companies receive clinic data (model providers behind the proxy)? Is there per-practice ability to disable AI features (billing gate suggests yes — verify)?
- Consent: is the client (pet owner) informed anywhere (portal) that AI processes their data? [GDPR-relevant]

═══════════════════════════════════════════════════════
7. CLINICAL SAFETY REVIEW
═══════════════════════════════════════════════════════
- `calculate_drug_dose` / `check_drug_safety`: what is the source of truth (hardcoded table, external formulary API, model memory)? What is the false-negative risk — can it silently approve a dangerous combination? Is any disclaimer surfaced in the UI?
- `check_withdrawal_periods`: legal correctness for Slovak law — where do the period values come from, and are they dated/versioned?
- Lab trend interpretation (`query_lab_trends`): does it ever produce a diagnosis-like statement without flagging that a vet must interpret?
- Controlled substances: can the agent dispense/waste via any tool, and does it hit the same witness requirement as the manual path?

═══════════════════════════════════════════════════════
8. COST & ABUSE CONTROLS
═══════════════════════════════════════════════════════
- Token/cost metering: per-practice, per-user, per-feature? What stops a stuck agent loop from burning budget?
- Rate limits: 600 req/min/key on REST [VERIFIED at e927ef5] — is the interactive tRPC agent path rate-limited at all?
- Prompt/response size caps; is a 500-note patient summary ever dumped wholesale into context?

═══════════════════════════════════════════════════════
DELIVERABLE FORMAT
═══════════════════════════════════════════════════════
# OpenVPM — AI Audit
[commit/date, access method, what you ran vs. only read]

## Executive summary (≤150 words)
## 1. AI Surface Census [table]
## 2-8. Findings per section above
## Findings Log: | ID | Location [source tag] | Severity (Critical/High/Med/Low) | Description | Evidence | Repro (if runnable) | Suggested Fix |
## Per-feature risk scorecard: usefulness / integration quality / risk (1-5, Low-Med-High) with justification
## Remediation roadmap — ICE-scored (Impact × Confidence / Effort), sorted descending
## Appendix — Source Reference Index

BEFORE FINALIZING, self-check:
- Did you resolve the (a)/(b)/(c) AI-positioning ambiguity before scoring?
- Did you audit every tool's readOnly flag against its actual DB writes?
- Did you trace at least one write tool end-to-end (UI → router → DB → audit chain)?
- Does every non-trivial claim carry a source tag?