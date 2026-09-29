# OpenVPM AI — Bug & Implementation-Issue Hunt Prompt

> **Usage:** Paste everything below the cut line into a fresh coding-agent session
> running at the repo root (`C:\Users\marek\Documents\Vet\openvpm-ai`), with full
> filesystem, shell, and (ideally) local Postgres/Docker access. This prompt is
> **code-correctness focused** — it is the sibling of, not a replacement for:
> - `artifacts/audit-prompts/ai-audit-prompt.md` — AI/agent safety specifically
> - `artifacts/audit-prompts/_run-now.txt` / `feature-map-user-manual-prompt.md` —
>   docs-vs-reality and information architecture
>
> Read the prior-art files listed in §0 **first**. Do not re-derive findings they
> already made — confirm, extend, or contradict them with a fresh source tag.

---

You are a senior staff engineer doing an independent code-correctness audit of a
production-track multi-tenant SaaS: a Slovak veterinary practice-management system
(PIMS) handling clinical records, controlled-substance logs, fiscal receipts
(e-Kasa), insurance claims, and statutory government exports. You have deep
experience with Next.js/tRPC/Drizzle monorepos, PostgreSQL row-level security,
concurrency bugs in scheduling/inventory systems, and financial-data integrity.

## MISSION

Find real, demonstrable bugs and implementation issues in the current codebase —
not documentation drift, not architecture opinions, not AI-safety findings (those
belong to the sibling prompts above). A "finding" here means: code that does not do
what it is supposed to do, does it inconsistently, or will break under a condition
the current tests don't cover. Every finding must be something you can point to in
the source and, wherever feasible, prove with a failing test or a reproduction
trace — not a hunch.

═══════════════════════════════════════════════════════
§0 ACCESS, GROUNDING & PRIOR-ART PROTOCOL (non-negotiable)
═══════════════════════════════════════════════════════

- State the commit hash (`git rev-parse --short HEAD`) at the top of your report.
- Every claim gets a source tag (same convention as the sibling audits — keep it
  consistent across this repo's artifacts):
    - `[VERIFIED: path/to/file.ts:L42]` — you read this exact line/function
    - `[VERIFIED: path/to/file.ts]` — you read the file, no specific line
    - `[PROVEN: <test/command run>]` — you reproduced the bug (failing test, repro
      script, or manual trace with actual output) — this is the strongest tag, use
      it whenever you can
    - `[INFERRED]` — reasonable deduction from reading code, not executed
    - `[UNVERIFIED — could not access]` — could not check (e.g. no DB available)
- A finding with no tag, or a fabricated file path/line, is worse than not reporting
  it. If you're not sure, say so and mark confidence explicitly.
- **Read first, do not duplicate:**
  - `artifacts/bug-hunt-remediation-report.md` — prior bug-hunt + fixes already
    applied. For anything you rediscover here, mark it `CONFIRMED-STILL-OPEN`,
    `CONFIRMED-FIXED` (verify the fix actually landed), or `NEW`.
  - `artifacts/production-readiness-report.json`, `docs/production-readiness/
    GAP_ANALYSIS_POST_PILOT_READY.md`, `docs/production-readiness/RISK_REGISTER.md`,
    `docs/production-readiness/THREAT_MODEL.md`, `docs/9.3-correctness-closure-audit.md`
    — prior structured findings. Same rule: confirm / already-fixed / new.
  - `docs/agent-tool-security-matrix.md` and `artifacts/ai-feature-audit.md` if your
    search happens to cross into agent tool code — cite them rather than re-auditing
    AI safety from scratch; stay focused on correctness bugs in that code, not
    safety policy.
- **Guardrails you must respect while investigating and while proposing fixes**
  (from `CLAUDE.md` and `.claude/skills/openvpm-ai/SKILL.md` — violating these in a
  proposed fix is itself a finding-worthy mistake):
  - Never modify upstream schema files in `packages/db/schema/*.ts` directly — new
    tables/columns go in `packages/db/schema/ext_*.ts`.
  - Migrations exclusively via `pnpm db:push` (keep `_journal.json` clean) — do not
    hand-write migration SQL as a "fix."
  - New tRPC procedures mount under `extensions: extensionsRouter` in
    `apps/web/server/routers/_app.ts`, not injected into upstream routers.
  - i18n: any user-facing string you touch must stay symmetric between
    `apps/web/messages/en.json` and `sk.json`.
  - The clinical-sympathy guardrail (hard-block SMS reminders/review-asks for
    deceased/euthanized patients) is a standing product invariant — if you find any
    reminder/notification/marketing send-path that doesn't check patient status,
    that is a **Critical** finding, not a style note.

═══════════════════════════════════════════════════════
§1 ARCHITECTURE MAP (verify, don't assume — this is a fast-moving repo)
═══════════════════════════════════════════════════════

| Area | Anchor |
|---|---|
| Next.js app (dashboard + portal + marketing site) | `apps/web/app/**` |
| tRPC routers (core + extensions) | `apps/web/server/routers/_app.ts`, `apps/web/server/routers/extensions/**` |
| REST v1 API | `apps/web/app/api/v1/**`, `docs/api/README.md` |
| DB schema + RLS | `packages/db/schema/*.ts` (upstream) + `ext_*.ts` (custom), `packages/db/rls/**`, `docs/security/row-level-security.md` |
| Migrations / drift tooling | `packages/db/drizzle/**`, `packages/db/schema-drift.ts`, `packages/db/check-drift.ts` |
| Auth | NextAuth config, TOTP/recovery-code flow, `apps/web/middleware.ts` + `middleware.test.ts` |
| Fiscal (e-Kasa) | `apps/web/lib` e-Kasa driver(s), offline queue, `docs/ekasa-certified-hardware-and-runbook.md` |
| Billing (Stripe) | `apps/web/lib/billing/**`, webhook handlers |
| Clinical dosing/safety | `lib/dosing`, `lib/controlled-substances`, `lib/lab` analyzer parsers |
| Insurance | `apps/web/lib/insurance/petexpert.ts`, `server/routers/extensions/insurance.ts` |
| Wholesaler / lab import | `apps/web/lib/inventory/wholesaler-import.ts`, `apps/web/lib/lab/analyzer-parser.ts` |
| Email/SMS | `packages/email/**`, Telnyx/Twilio + Resend send-paths |
| Test suites | `apps/web/**/__tests__/**`, `packages/db/test-*.ts`, `e2e/**` (Playwright) |
| CI | `.github/workflows/ci.yml` |

═══════════════════════════════════════════════════════
§2 BUG VECTORS TO HUNT (in priority order — this system's actual risk surface)
═══════════════════════════════════════════════════════

**1. Multi-tenant isolation.** Every DB query must be practice-scoped. Search for
   queries that bypass `withTenant`/equivalent scoping helpers, raw SQL that
   concatenates a practice/clinic id without parameterization, tRPC procedures
   missing a practice-id check before acting on a caller-supplied entity id (IDOR),
   and REST v1 endpoints where the scope check differs from the tRPC equivalent for
   the same resource. Cross-check against `packages/db/test-rls.ts` /
   `test-rls-preflight.ts` coverage — which tables have RLS tests, which don't.

**2. Concurrency & double-writes.** `packages/db/test-treatment-plan-concurrency.ts`
   shows the team already found and fixed one race condition — treat that as a
   pattern-match hint, not the only instance. Check for the same class of bug in:
   appointment double-booking, inventory stock decrement on concurrent sales,
   e-Kasa/invoice document-number allocation (gaps are compliance-legal, duplicates
   are worse), controlled-substance ledger entries, and any "check-then-act"
   sequence not wrapped in a transaction or unique constraint.

**3. Financial & fiscal correctness.** e-Kasa offline queue: is replay idempotent
   (can a retried submission fiscalize twice)? Storno/refund logic: can a document
   be storno'd twice, or storno'd for more than its original amount? VAT/DPH
   rounding: rounding-per-line vs rounding-per-total consistency. Stripe webhooks:
   signature verification, replay/idempotency-key handling, and what happens if the
   webhook handler throws after a partial DB write.

**4. Clinical-safety logic.** Species-specific drug contraindication checks (e.g.
   paracetamol/cats, ivermectin/collies per README) — verify the check actually
   blocks the write path, not just warns in the UI and lets the API accept it
   anyway. Withdrawal-period and VHS calculations — trace the formula against a
   hand-computed example. The deceased-patient SMS/review-ask block (see §0
   guardrail) — enumerate every send-path and confirm each one checks patient
   status, not just the primary reminder cron.

**5. Auth & session edge cases.** Role checks: do tRPC middleware and REST route
   guards enforce the same role matrix for equivalent operations? Portal magic-link
   tokens: expiry, single-use vs reusable, and behavior after the linked
   client/pet is deleted or transferred. TOTP/recovery codes: rate limiting,
   recovery-code single-use enforcement, session fixation after MFA step-up.

**6. Data integrity & migrations.** Any `ext_*.ts` file that actually duplicates or
   shadows an upstream column name (guardrail violation risk). Schema drift between
   `schema-drift.ts` output and the live migrations directory. Seed data
   (`packages/db/seed*.ts`) producing states the app can't otherwise reach in
   production (masking bugs that only appear on freshly-onboarded practices).

**7. Error handling & failure visibility.** Empty/swallowed `catch` blocks,
   especially around webhook handlers, cron jobs, and email/SMS send calls —
   does a silent failure there mean a clinic never finds out a reminder didn't
   send? Unhandled promise rejections. Retries that aren't idempotent (a retried
   write tool/cron that can duplicate a side effect).

**8. Type-safety erosion.** Grep for `as any`, `as unknown as`, `@ts-ignore`,
   `@ts-expect-error`, and non-null assertions (`!`) that sit near
   user-controlled input (route params, tRPC input after `.passthrough()`,
   webhook payloads). Each one is a candidate for a real runtime bug — verify
   whether the surrounding logic actually handles the case the cast is hiding.

**9. i18n / locale correctness.** Re-run the i18n symmetry check
   (`node apps/web/scripts/check-i18n-symmetry.js`) — confirm it still passes and
   isn't stale. Separately: timezone handling for appointment times, vitals
   timestamps, and statutory report date ranges — anything using local `Date`
   arithmetic instead of a timezone-aware library is a candidate bug in a
   system serving a single timezone today but storing UTC.

**10. Performance-as-correctness.** N+1 query patterns in list views that will
   silently degrade as a practice's patient count grows (dashboard, patient
   search, statutory export generation). Unbounded loops over full-practice
   datasets with no pagination — flag as a bug if it can plausibly time out or
   OOM on realistic data volume, not as a general style complaint.

**11. Test-suite trustworthiness.** The README claims 4,858 tests / 100% pass rate.
   Spot-check: any `.skip`/`.todo`/`xit`/commented-out tests? Any test that mocks
   away the exact function under test (so it can't fail)? Any test asserting
   `expect(true).toBe(true)`-style tautologies? Any flaky test hidden by a retry
   config in CI? Report these as implementation issues in the test suite itself —
   they hide real bugs.

**12. Import/export & offline-path correctness.** Wholesaler delivery-note import
   duplicate detection (re-importing the same file twice). Lab analyzer parsers —
   malformed/partial instrument output handling. Backup/restore — does restore
   actually round-trip every table, or silently drop data the export didn't
   include (cross-check against `docs/backup-restore-runbook.md` and
   `docs/file-object-recovery-runbook.md` claims)?

═══════════════════════════════════════════════════════
§3 METHOD
═══════════════════════════════════════════════════════

1. Run the existing gates first and record actual output (not assumed):
   `pnpm --filter @openpims/web type-check`, `pnpm --filter @openpims/db type-check`,
   `pnpm --filter @openpims/email type-check`, `pnpm --filter @openpims/web test`,
   `pnpm db:rls:test` (if a local Postgres is available). Note any gate that fails,
   is skipped, or can't run in your environment — tag accordingly.
2. Work §2 in priority order. For each vector, grep broadly first (list every
   candidate location), then read each candidate in full before deciding it's a
   real finding — do not report a grep hit as a bug without reading the
   surrounding logic.
3. For anything you flag as Critical or High, attempt to **prove it**: write a
   minimal failing test, a repro script, or a manual trace with concrete
   input/output. Use the `[PROVEN: ...]` tag when you do. If you can't prove it in
   your environment (e.g. no DB), say exactly what would prove it and tag
   `[INFERRED]`.
4. Do not fix anything unless asked to — this prompt is an audit, not a
   remediation pass. If the operator wants fixes, they will ask for them as a
   follow-up scoped to the confirmed findings, respecting the §0 guardrails.

═══════════════════════════════════════════════════════
§4 SEVERITY RUBRIC
═══════════════════════════════════════════════════════

| Severity | Definition | Examples in this system |
|---|---|---|
| **Critical** | Cross-tenant data exposure, financial double-charge/loss, silent data loss, or a bypass of a standing safety guardrail (deceased-patient SMS block, contraindicated-drug block) | Missing practice-scope check; e-Kasa doc number reused; SMS sent to a deceased-patient's owner |
| **High** | Auth/authorization bypass, silent data corruption that isn't immediately visible, race condition with a plausible real-world trigger | Two front-desk staff double-book the same slot and both "succeed"; a retried webhook double-fires a side effect |
| **Medium** | Logic bug producing wrong-but-non-destructive output, inconsistent behavior between two equivalent code paths (tRPC vs REST), a swallowed error that degrades UX without losing data | VAT rounding off by a cent on some line combinations; REST endpoint missing a role check that the tRPC equivalent has (but no destructive action possible) |
| **Low** | Code smell with low but non-zero exploitability, type-safety gap not yet observed to cause a real failure, test-suite issue that doesn't itself hide a confirmed bug | Unjustified `as any` on a well-validated value; a skipped test with a stale TODO |

═══════════════════════════════════════════════════════
§5 OUTPUT FORMAT
═══════════════════════════════════════════════════════

Write to `artifacts/bug-hunt-<YYYY-MM-DD>.md` (new file — do not overwrite
`bug-hunt-remediation-report.md`, which is a closed prior pass). Structure:

```
# OpenVPM AI — Bug & Implementation-Issue Hunt

Commit: <hash> [VERIFIED: git rev-parse]
Gates run: <list, with pass/fail/skip and why>

## Findings

### <ID> — <short title>
- Severity: Critical | High | Medium | Low
- Vector: <§2 number/name>
- Status: NEW | CONFIRMED-STILL-OPEN | CONFIRMED-FIXED (prior report ref)
- Location: `path/to/file.ts:L<start>-L<end>`
- Evidence: <what you read/ran, with the tag>
- Root cause: <1-3 sentences>
- Reproduction: <steps, or the failing test you wrote>
- Suggested fix: <direction, not necessarily full diff — respect §0 guardrails>
- Confidence: High | Medium | Low
```

End with a short **summary table** (ID, severity, vector, status, one-line title)
so the operator can triage without reading every section, and a **"gates I
couldn't run"** list naming exactly what environment access would remove the
remaining `[UNVERIFIED]`/`[INFERRED]` tags.

═══════════════════════════════════════════════════════
SELF-CHECK BEFORE FINALIZING
═══════════════════════════════════════════════════════

- [ ] Stated commit hash and which gates actually ran, with real output.
- [ ] Read the three prior-art report files and marked every rediscovered issue
      CONFIRMED-STILL-OPEN / CONFIRMED-FIXED / NEW — no silent duplicates.
- [ ] Every Critical/High finding has a `[PROVEN: ...]` tag or an explicit
      statement of what's missing to prove it.
- [ ] No finding proposes a fix that violates the CLAUDE.md guardrails (upstream
      schema edits, hand-written migrations, i18n asymmetry, routers mounted
      outside `extensionsRouter`).
- [ ] Checked every deceased-patient-adjacent send-path, not just the obvious one.
- [ ] Test-suite trustworthiness (§2.11) was actually checked, not assumed clean
      because CI is green.
