# Standing rules for every sprint

Every sprint spec inherits these rules **by reference**. Specs don't copy them. A spec lists only what is specific to its targets (source-contract literals, frozen logic, out-of-scope files). If a rule here conflicts with a spec, this file wins unless the spec says `overrides: RULES §n` and explains why.

## 1. Codebase non-negotiables

1. Never modify `ClinicalDiffConfirmModal`, controlled-substance zero-prefill, or the sympathy-gate suppression logic.
2. Never hand-edit `packages/db/schema/*.ts` (upstream vanilla schema) or anything under `packages/db/drizzle/`. Extensions go in `packages/db/schema/ext_*.ts`. **Any schema change must include the generated migration** (`pnpm db:generate`, which updates `drizzle/NNNN_*.sql`, `meta/NNNN_snapshot.json` and `meta/_journal.json`). A second `db:generate` must print "No schema changes"; CI enforces this. PR #72 skipped it and main was red until `c2d38789`.
3. i18n: every UI string goes through `useI18n()`. `apps/web/messages/en.json` and `sk.json` stay leaf-symmetric, nested JSON only (`lib/__tests__/i18n-structure.test.ts`).
4. UI follows `docs/UIKIT.md` and `apps/web/components/layout/page-kit.tsx`: no per-page table, tab or button chrome, and semantic tokens instead of raw palette colours.
5. No **new** ESLint warnings. `pnpm --filter @openpims/web type-check`, `lint`, `test` and `i18n:scan` exit 0.
6. The doctor's unit of work is **vyšetrenie**. Fiscal/e-Kasa, statutory print surfaces and money logic are presentation-only unless the sprint is about them.
7. Tenant isolation: every query filters by `practiceId`. New `practice_id` tables get RLS automatically from `packages/db/rls/enable-rls.sql`, so don't add a bypass.
8. AI outputs that become clinical records go through `appendAiAuditEvent` (`lib/ai/audit-ledger.ts`) inside the same transaction. Don't add new hash formats or tables for this.

## 2. Grounding rules (for whoever writes a spec)

1. Every "current problem" is verified in code: quote the real class string, component or line. Counts are measured, never estimated. The word "stub" needs a measured line count next to it (Sprints 25 and 29 were built on a false "stub 0 lines").
2. Every size or state claim that implementation depends on becomes a **premise** in the frontmatter, so `tasks.mjs check` can re-verify it at dispatch time.
3. Never invent props, routes, tRPC params, DB columns, i18n keys or components. If something is unknown, the spec says "verify first".
4. Presentation-only specs say so explicitly: no change to logic, amounts, statuses, mutations or routers.
5. Out-of-scope discoveries go under "Follow-ups". Scope never grows silently.
6. Before writing a spec for a target, check it hasn't moved already: `gh pr list --state all --search "<route>"` and `git log --oneline -5 -- <target>`.
7. When a spec builds on another unmerged sprint, declare it with `depends_on: [N]`. The spec stays BLOCKED until N is done. Premises that only become true once N lands aren't allowed. Premises have to hold today and still hold after N.

## 3. Delivery rules (for whoever implements)

1. **One sprint = one branch = one PR.** Never bundle sprints (PR #67 bundled six generic tickets with no review).
2. Start with `node scripts/tasks/tasks.mjs check <id>`. If it isn't READY, stop and fix the spec first.
3. You're done when the contract test is flipped from `it.fails` to `it` and passes, the pinned tests stay green, the spec's `state:` is `done` with `prs:` filled in, and `tasks.mjs index` has been re-run.
4. Commits: one logical change each (`feat(scope):`, `fix(scope):`, `test(scope):`, `docs(tasks):`).

## 4. Lessons already paid for

- Many tests `readFileSync` page source and assert literals, e.g. `care-reminders-safety.test.ts` ("Template preview", "never sends an email or text automatically") and the billing tests (`verifiedBillingConfig`, `billingSettingsReady`, `listError || billingListMissing` ordering, `data-tour="invoice-detail"`). Grep tests for the target path before renaming anything.
- A page can look harmonized and still mix header styles, so inspect every `<th>`.
- `space-y-6` on a root plus `mt-6` on children double-gaps. UIKIT forbids mixing them.
- Report terminology conflicts (UIKIT "vyšetrenie" vs the command palette's "Nová návšteva"). Don't resolve them inside an unrelated sprint.
- Lint baselines differ between documents, so say "no NEW warnings", never "fix all".
- A "dispatched" row in an index means nothing. Sprints 15 and 18 sat as "running" for days and were never implemented. Only git and CI count.
