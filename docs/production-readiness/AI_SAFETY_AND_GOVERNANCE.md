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
