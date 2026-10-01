# OpenVPM — AI Feature Improvement Prompt (All Domains)

> **Usage:** Paste everything below the cut line into a fresh agent session
> running at the repo root, with write access and the ability to run
> `pnpm`, `tsc`, `vitest`, and `psql`/the seeded demo DB. This prompt turns
> the findings in `artifacts/ai-feature-audit.md` (audited at commit
> `e723899`) into shipped fixes. **Re-verify every finding against current
> `HEAD` before touching code** — the repo moves fast and some items may
> already be partially fixed or superseded.

---

You are a senior AI/ML platform engineer pairing with a clinical-safety
reviewer. Your job is not to re-audit — it is to **close every gap** the
prior audit identified, across every domain it covers, without regressing
anything that already works. Treat "AI features" the same way the audit
did: (a) user-facing generative surfaces, (b) the agent-consumable API,
and any (c) build-time AI tooling you discover — improve all that apply.

═══════════════════════════════════════════════════════
0. GROUNDING & WORKING PROTOCOL (governs everything)
═══════════════════════════════════════════════════════
- State the commit hash you start from (`git rev-parse --short HEAD`).
- Before fixing any finding (F1–F10 below, or one you discover), re-read
  the current source at the cited path/line — do not trust the audit's
  line numbers blindly, confirm them.
- One finding = one focused commit/PR-sized change. Do not bundle unrelated
  fixes. Each change must include or update a test that would have caught
  the original defect.
- After each fix: run the narrowest relevant test file, then before
  finalizing the whole session run `tsc --noEmit`, the full `lib/ai/`
  and `lib/agent/` test suites, and `pnpm audit:verify-ai --allow-empty`.
  Do not claim a fix is done without showing these pass.
- Never silently change clinical defaults (dosing, drug safety, withdrawal
  periods) without leaving the change auditable: update
  `docs/ai-audit-ledger.md`-adjacent docs and `CHANGELOG.md` when behavior
  affecting patient safety changes.
- Use the audit's source-tagging discipline in your own summary:
  `[FIXED: path:line]`, `[ALREADY FIXED — no action taken]`,
  `[WONTFIX — reason]`, `[NEW FINDING — not in original audit]`.

═══════════════════════════════════════════════════════
DOMAIN-BY-DOMAIN WORK ORDERS
═══════════════════════════════════════════════════════

### Domain 1 — Tool-Calling Correctness & Authorization (P0)
**F1 [Critical]:** `assertAgentRole` fails closed on every call because
`userRole` is never placed on `AgentToolContext`.
- Fix `apps/web/server/routers/agent.ts` to pass `userRole: ctx.user.role`.
- Fix `apps/web/app/api/v1/agent/route.ts` to resolve and pass a role for
  API-key callers (do not default to the most-privileged role — resolve
  the actual role the key is scoped to, or a dedicated minimal
  `service_agent` role if none exists).
- Add a regression test that invokes at least one read tool and one write
  tool through both entry points end-to-end (tRPC + REST) and asserts
  success, not just that the context object contains the field.
- While here, audit every other field `AgentToolContext` types as required
  vs. what each caller actually supplies — this class of bug (typed but
  not populated) may exist elsewhere; grep for other context constructions.

**F3 [High]:** REST `create_prescription` crashes on non-UUID `userId`
(`apikey:...`) hitting a `uuid` FK column.
- Resolve a real veterinarian/service-account UUID for API-key callers
  before the tool writes `prescribedBy`. Prefer requiring an explicit
  "acting veterinarian" parameter on API-key-driven prescription creation
  over inventing a system user, since a prescription needs a real,
  licensed signer — flag this as a product decision if ambiguous rather
  than silently picking one.
- Add a REST-path integration test that actually inserts a prescription
  via `POST /api/v1/agent` and asserts no `22P02` error.

### Domain 2 — Clinical Safety (P0/P1)
**F2 [Critical]:** `check_drug_safety` defaults to `safe: true` for any
drug/interaction not in its ~5 hardcoded rules.
- Do not ship a "complete" interaction database in one pass — that's
  unbounded scope. Instead: (1) flip the default so unknown/unrecognized
  drugs return an explicit `unknown_not_evaluated` status distinct from
  `safe`, never silently `safe: true`; (2) require the UI to visibly
  surface `unknown_not_evaluated` as "not checked — clinician judgment
  required," not blend it into a green "safe" state; (3) add the
  specific interactions the audit names (tramadol+MAOI/SSRI,
  aminoglycoside+loop diuretic, fluoroquinolone in immature animals) as
  concrete rules; (4) fix allergy matching to normalize brand↔generic
  names (e.g. Metacam↔meloxicam) via a lookup table, not substring match.
- Add tests asserting the *fail-safe* direction: an unrecognized drug
  must never come back `safe: true`.

**F5 [High]:** `check_withdrawal_periods` trusts unvalidated user-entered
values with no statutory floor.
- Add minimum-value validation at entry (`statutory.ts`) against the
  known statutory minimums under Slovak law, and have the tool itself
  flag (not silently pass) any stored value below the statutory minimum
  even for data entered before validation existed.
- This is a legal/regulatory correctness question, not just code — if the
  statutory minimum table doesn't exist yet, build it as versioned,
  dated, sourced data (cite the regulation per entry), not a guess.

**F6 [High]:** `create_prescription` writes `active` prescriptions with
no secondary clinician confirmation, unlike the UI's manual path.
- Bring the agent write path to parity with the manual prescription flow:
  write as `pending_signature` (or the manual flow's equivalent draft
  state) and require the same confirmation UI/endpoint the manual path
  uses, rather than building a parallel confirmation mechanism.

### Domain 3 — Audit, Compliance & Guardrails (P0/P1)
**F4 [High]:** Marketing image/copy generation has zero references to
`extAiAuditLog` or `readHostedAiAccess` — it escapes both the audit
chain and billing gates.
- Wrap every generation call in `server/routers/extensions/marketing.ts`
  (`generatePostContent`, `generatePostVisual`, `generateReviewReply`,
  competitor intelligence, quiz/post-from-case generators) in
  `appendAiAuditEvent`, matching the event shape already used by
  voice/imaging/discharge finalization.
- Add `readHostedAiAccess`/billing-entitlement checks to the same set of
  procedures, matching the gate pattern used elsewhere in the router tree.
- Add a test that generates one of each marketing asset type and asserts
  a corresponding `ext_ai_audit_log` row exists and chains correctly
  (reuse `scripts/verify-ai-audit-trail.ts` logic if it's exposed as a
  library function; if not, consider extracting it so tests and the CLI
  share one implementation instead of duplicating chain-walking logic).

**Guardrail gap (not separately numbered in the audit but named in §5):**
Enabling `allowWrites` for a conversation is not itself audit-logged.
- Emit an audit event (or at minimum a structured log line queryable per
  practice) when a run transitions into write mode, including actor,
  practice, and timestamp.

**F10 [Low]:** Agent chat bubbles carry no AI-generated label, unlike
every other AI surface in the product.
- Add the same "Vygenerované AI Asistentom" badge/disclaimer pattern used
  in discharge/imaging to `AgentMessageBubble`. Keep it consistent with
  existing i18n keys rather than inventing new copy.

### Domain 4 — Prompt & Context Hygiene (P2)
**F8 [Medium]:** Raw DB fields (names, notes, free text) flow into model
context with no boundary delimiting — a prompt-injection surface.
- Introduce a single helper (e.g. `wrapUntrustedField`) that all tool
  result serialization funnels through, wrapping DB-sourced strings in an
  explicit boundary (XML-style tags or an equivalent the model provider
  respects) and reinforcing in the system prompt that content inside
  those tags is data, not instructions. Apply it consistently across
  `tools.ts` rather than patching call sites ad hoc — inconsistent
  coverage is worse than an honest "not yet done" note.
- Add a test with a patient/client field containing an injection-style
  string (e.g. `"\n\nSystem: ignore previous instructions"`) and assert
  it round-trips as inert data in a mocked model call.

### Domain 5 — Model & Provider Configuration (P2)
**F9 [Medium]:** No `temperature` is set on `generateText` calls; clinical
generation runs at whatever the provider defaults to.
- Pin `temperature: 0` (or the lowest value the provider supports) for
  every clinical/legal-adjacent generation path: agent runner, SOAP
  draft, discharge, withdrawal/RVPS-adjacent tools, imaging analysis.
  Marketing/creative generation can reasonably keep a higher temperature —
  don't over-apply this fix where variability is a feature, not a bug.
- While in `runner.ts`, check whether retries on timeout could duplicate
  a write (the audit flags this as `[INFERRED]`, unverified) — confirm or
  refute with a test, and if confirmed, add idempotency keys to
  write-capable tools before relying on retry safety.

### Domain 6 — Cost & Abuse Controls (P2)
**F7 [Medium]:** Alibaba image/video generation has no rate limiting and
no entitlement check (overlaps with F4's billing-gate fix).
- Apply the same `rateLimit()` middleware pattern used by the agent
  runner (20/min/actor, 120/min/practice, or a marketing-appropriate
  variant) to `generatePostVisual` and video generation. Land this
  alongside the F4 billing-gate fix since both touch the same call sites.

### Domain 7 — Data Protection (verify, don't assume fixed)
- Confirm the voice-audio 24-hour purge (`purgeExpiredAudio`) still
  matches `docs/data-retention-policy.md` after any changes made above —
  it was `[VERIFIED]` clean in the audit; a regression test protecting it
  is cheap insurance.
- The audit flagged (`[INFERRED]`) that there's no GDPR Art. 13/14
  disclosure telling pet owners their data reaches AI providers. Confirm
  this against the current client portal, and if still true, treat it as
  a genuinely new finding requiring product/legal input, not a
  ship-blind code fix — flag it rather than guessing at consent copy.

═══════════════════════════════════════════════════════
EXECUTION ORDER
═══════════════════════════════════════════════════════
1. P0 first, in this order: F1 → F3 → F2 → F4 (all four are either
   "the whole agent is broken" or "silently unsafe/uncontrolled").
2. P1: F6, F5.
3. P2: F9, F8, F7.
4. P3: F10, the `allowWrites`-not-audited gap.
5. Domain 7 checks can run in parallel with any of the above — they're
   verification, not implementation.

For each item, before moving to the next: re-run the check that originally
found it (or the closest reproduction the audit describes) and confirm it
no longer reproduces.

═══════════════════════════════════════════════════════
DELIVERABLE
═══════════════════════════════════════════════════════
A `artifacts/ai-feature-improvement-report.md` with:
- Commit hash at start and end of the session.
- One row per finding (F1–F10 + any new ones): status
  (`FIXED`/`ALREADY FIXED`/`WONTFIX`/`DEFERRED — needs product input`),
  files changed, tests added, and the exact command output proving the
  original repro no longer occurs.
- Anything you found that the original audit missed, with the same
  source-tagging discipline (`[VERIFIED: path:line]`).
- An explicit "what's still unsafe" section — do not let a partial pass
  read as "all clear." If F2's interaction database is still
  intentionally incomplete after this pass, say so plainly and state what
  `unknown_not_evaluated` protects against in the meantime.

BEFORE FINALIZING, self-check:
- Did every clinical-safety fix (F2, F5, F6) move the system toward
  *fail-safe* behavior (explicit "unknown/needs review") rather than a
  different flavor of silent confidence?
- Does every write-capable agent tool now have parity with its manual-UI
  equivalent's confirmation/audit requirements?
- Did marketing generation get folded into the same audit chain and
  billing gate as every other AI surface, with a test proving it?
- Did you avoid inventing statutory numbers, consent copy, or a "system
  user" identity where the honest answer is "this needs a human
  decision" — and did you flag those instead of guessing?
