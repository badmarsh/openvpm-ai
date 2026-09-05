# AI safety and governance

Language: **implemented technical control** vs **requires legal/operator review**. AI output is **not** medical advice.

## Inventory (verified in repo)

| Feature | Location | Intended use | Prohibited use | Data that may leave the system |
| --- | --- | --- | --- | --- |
| OpenVPM Agent | `server/routers/agent.ts`, `lib/agent` | Natural-language tools on **one** practice | Autonomous diagnosis, unapproved writes | Instruction + tool results to Vertex/Anthropic/`AI_BASE_URL` |
| SOAP draft | `lib/ai/soap.ts`, `lib/ai/soap-draft.ts` | Draft notes | Auto-finalizing chart | Clinical text to model provider |
| Voice transcription | `lib/voice/transcription.ts` | Speech → text draft | Unreviewed chart write | Audio/transcript to provider if configured |
| Imaging | `routers/extensions/imaging.ts`, `schema/ext_imaging.ts` | Assistive analysis | Autonomous diagnosis | Images to provider if enabled |
| Marketing copy | `extensions/marketing.ts` | Draft outreach | Send without consent/approval | Prompts; must not send unapproved |

Kill switch: leave `AI_MODEL` / provider credentials unset. Hosted billing can deny `requireFeature("agent")`. Recovery hold blocks AI calls (backup runbook).

## Rules enforced in code (agent)

- `protectedProcedure` + `requireRole("admin","veterinarian")` + `requireFeature("agent")`
- Writes require `allowWrites: true` per run
- Instruction length bounded (`AGENT_INSTRUCTION_MAX_LENGTH`)
- History bounded to 20 turns
- Failures: not-configured, rate-limit, recovery-hold, billing — mapped to tRPC errors
- Tools listed via `AGENT_TOOL_NAMES`; must stay practice-scoped in `lib/agent`

## Human-in-the-loop

Staff remain responsible for the medical record. SOAP/imaging/voice outputs are drafts until a human saves/finalizes through normal clinical APIs.

Enforced contract (`apps/web/lib/ai/draft-safety.ts`, proven by `apps/web/server/__tests__/ai-draft-safety.test.ts`):

- `ai.draftSoapNote` returns text to the editor only; it never writes `soap_notes`.
- `ai.createSoapFromAI` (tRPC) and `POST /api/v1/soap-notes` (REST) require `clinicianConfirmed: true` / `clinician_confirmed: true` as a schema literal. Missing or `false` is a validation error before any DB work. The finalizer is always the signed-in user, never the AI source.
- `voice.saveAsSoapNote` and `discharge.save` default to `draft`; finalizing requires the same explicit attestation and goes through the SOAP lifecycle (which also enforces the one-draft/one-finalized DB invariant).
- `imaging.injectFindingsIntoSoap` appends to a draft only and refuses finalized notes (`PRECONDITION_FAILED`).
- Discharge drafts emit no webhooks and no marketing/recall automation. A finalized discharge for a deceased or euthanized patient routes only to the sympathy gate; post-op check-ins, dental recalls, senior milestones and review asks are hard-blocked for those patients.
- Agent tools that touch clinical text remain `readOnly` — the agent cannot sign a record.

## Prompt injection

Agent tools execute with server-side tenant scope, not with model-chosen practice IDs. Retrieved document text can still influence the model; consequential actions require `allowWrites` and role gates. Additional injection evals are **partial**.

## Provider / contract

- Hosted Gemini: Vertex AI + Vercel OIDC (no long-lived Google key for Cloud health)
- Alternative: Anthropic API key
- Self-host: `AI_BASE_URL` OpenAI-compatible proxy — **operator** must ensure no unexpected data residency

**Requires DPA confirmation** with each provider before production PHI/clinical text.

## Audit

tRPC mutations are audit-logged after commit (`recordAuditLog`). Consequential agent writes should appear as the underlying domain mutations plus agent run path.

## Tests

Search the tree for agent/AI unit tests under `apps/web/lib/agent` and `lib/ai/__tests__`. Cross-tenant AI leakage is primarily covered by tenant DB scoping, not a dedicated prompt-injection suite.

## Disclosure

UI and docs must state: assistive draft, clinician review required, not a diagnosis or prescription.
