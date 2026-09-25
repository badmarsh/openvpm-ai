# Sprint 26 — Legacy State Bindings Migration Plan

**Companion to:** [`sprint-26-legacy-state-bindings-audit.md`](./sprint-26-legacy-state-bindings-audit.md)
**Risk class:** `risk:low` · **Baseline:** 102 bindings

This is the deliverable for *"Prepare migration plan"*. It sequences the
retirement of the 102 audited bindings into eight phases, ordered so that no phase
depends on a later one and no phase weakens a clinical control.

---

## 0. On "OpenVPM Migration Guide v3"

The ticket asks for this plan "per OpenVPM Migration Guide v3". **No such
document exists in this repository** — `grep -rn "Migration Guide"` across all
`*.md`, `*.ts`, `*.tsx` and `*.json` returns no match. The two migration
documents that do exist cover different ground:

| Document | Covers | Usable here? |
| --- | --- | --- |
| [`docs/migrating-to-openvpm.md`](../migrating-to-openvpm.md) | Importing clients/patients/vaccines/medical history **from other PIMS vendors** by CSV | No — data migration, not code migration |
| [`DESIGN-SYSTEM-MIGRATION.md`](../../DESIGN-SYSTEM-MIGRATION.md) | Design-token unification (`--brand` vs `--primary`) | No — CSS tokens, not state |

So §1 below states the protocol this plan follows, derived from the conventions
already enforced in this repository (append-only migration history, the
`@deprecated` retirement marker, the ratchet pattern used by
`db:migrations:check`). If Migration Guide v3 exists outside the repository,
point at it and §1 will be re-aligned; the phase plan in §2–§7 does not depend on
which protocol is adopted.

---

## 1. Migration protocol

Five rules that every phase below obeys.

**P1 — Ratchet, never snapshot.** A binding is retired only when
`node src/legacy/state/audit.mjs` still passes afterwards and `baseline.json`
has been refreshed in the same commit. The gate fails on an *unaudited* binding
appearing and reports (without failing) on one disappearing, so the count can
only fall through a reviewed diff.

**P2 — One rule per pull request.** A PR touches exactly one `LSB-nnn` rule.
Mixing rules makes a regression unattributable and makes the baseline diff
unreadable.

**P3 — Server-side first.** Where a binding exists to serve an old URL, the
replacement is a server mechanism (`next.config.js` `redirects()`, a route
handler, or `redirect()`), not a client component. The repo already uses this
mechanism at `apps/web/next.config.js:97-105`.

**P4 — Backfill before delete.** Where a binding exists because rows lack newer
attribution columns, the data is backfilled first and the branch is deleted only
once it is provably unreachable. Never the reverse. This is mandatory for
LSB-009 (`legacyReview`) — see §10.

**P5 — Clinical controls are not scope.** No phase may alter
`lib/ai/draft-safety.ts`, `lib/controlled-substances/policy.ts`, or
`lib/autopilot/consent-gate.ts`. A phase that appears to require such a change
is stopped and re-scoped, not merged.

---

## 2. Scope boundary of *this* sprint

The ticket permits writes only to `src/legacy/state/` and `docs/migration/`.
Every retirement phase below necessarily edits files outside those paths
(`apps/web/app/…`, `apps/web/lib/…`). **This sprint therefore delivers the
audit, the plan and the enforcement tooling — not the retirements themselves.**

Delivered in-scope:

- `src/legacy/state/rules.mjs` — the 10 detection rules, pure and unit-tested
- `src/legacy/state/scan.mjs` — zero-dependency repository scanner
- `src/legacy/state/audit.mjs` — baseline gate (exit 1 on unaudited bindings)
- `src/legacy/state/baseline.json` — the 102 audited findings
- `src/legacy/state/__tests__/` — 56 tests
- `docs/migration/` — this plan and the audit

Each phase below names the path authorisation it needs, so a follow-up sprint can
pick up any phase independently.

---

## 3. Phase 1 — Zero-risk deletions (LSB-005 partial)

**Authorisation needed:** `apps/web/app/(dashboard)/marketing/tv/`
**Removes:** 1 binding, 1 hardcoded string, 1 dead route

`/marketing/tv` is declared twice. `apps/web/next.config.js:99-103` already
redirects it permanently to `/waiting-room`, and Next.js checks
`redirects()` *"before the filesystem which includes pages and `/public`
files"* — so `app/(dashboard)/marketing/tv/page.tsx` can never render. It is
dead code with a Slovak string in it.

**Steps:** delete the directory · run `node src/legacy/state/audit.mjs` (expect
one retirement reported) · refresh baseline · verify `/marketing/tv` still 308s
to `/waiting-room`.

**Verification:** `pnpm --filter @openpims/web type-check` · `pnpm lint` ·
`pnpm --filter @openpims/web i18n:scan` (hardcoded count must drop by 1).

---

## 4. Phase 2 — Redirect stubs to config (LSB-005 remainder)

**Authorisation needed:** the 8 remaining stub directories + `apps/web/next.config.js`
**Removes:** 8 bindings, 7 hardcoded strings, 8 client bundles

Add the eight remaining stub routes to `redirects()`, then delete the page
components. Destinations are already verified to exist:

| `source` | `destination` | `permanent` |
| --- | --- | --- |
| `/admin/pilot` | `/admin` | `true` |
| `/marketing/content-queue` | `/marketing?tab=queue` | `true` |
| `/marketing/messages` | `/inbox?tab=logs` | `true` |
| `/marketing/plan` | `/marketing?tab=calendar` | `true` |
| `/marketing/suppression` | `/marketing/automations?tab=suppression` | `true` |
| `/marketing/wellness` | `/wellness` | `true` |
| `/marketing/competitors` | `/marketing?tab=competitors` | `true` |
| `/vet-intel` | `/marketing?tab=competitors` | `true` |

Two deliberate corrections while doing this:

- **Collapse the two-hop chain.** `/marketing/competitors` currently goes
  `/marketing/competitors` → `/vet-intel?tab=market` → `/marketing?tab=competitors`.
  Point it straight at `/marketing?tab=competitors` and drop the meaningless
  `tab=market` param.
- **Deleting beats translating.** Seven of the eight stubs render a hardcoded
  Slovak string. Removing the components removes the strings; translating them
  would add 14 dictionary keys for copy that should never be seen.

**Verification:** as Phase 1, plus a manual pass over each old URL confirming a
308 and no flash of untranslated copy.

---

## 5. Phase 3 — URL state through the router (LSB-003, LSB-002)

**Authorisation needed:** `apps/web/app/(dashboard)/patients/[id]/`, `…/records/`, `apps/web/components/onboarding/`
**Removes:** 6 + 2 = 8 bindings

Replace the four page-level `history.replaceState` writes with
`router.replace(url, { scroll: false })`. Then move `LEGACY_TAB_MAP`
(`patients/[id]/page.tsx:234,404`) into a server redirect so the client only
ever sees canonical tab ids, and delete the map.

`lib/use-unsaved-changes-guard.ts:87` is **not** in this phase — it is part of
Phase 7, because the sentinel push is intrinsic to the monkey-patch.

**Ordering:** do the `replaceState` replacements before deleting the tab map, so
a regression is attributable to one change.

**Verification:** the tab in the address bar must still survive a refresh and a
back-navigation on both `/patients/[id]` and `/records`. Existing tests:
`apps/web/lib/__tests__/` covers the guard's pure helpers
(`resolveUnsavedPopEffect`, `isSameDocumentHashNavigation`) and must stay green.

---

## 6. Phase 4 — Deprecated symbols (LSB-001)

**Authorisation needed:** `apps/web/server/routers/_app.ts`, `apps/web/lib/marketing/messaging.ts`, `apps/web/server/routers/extensions/wholesaler-import.ts`
**Removes:** 3 bindings

Three independent deletions, each needing its callers migrated first:

1. **`_app.ts:79` — `visitTreatmentPlans`.** An alias resolving to the same
   `treatmentEstimatesRouter` object, so both are live tRPC procedures. Grep for
   `visitTreatmentPlans` callers, move them to `treatmentEstimates`, delete the
   alias. Low risk, high value: it removes a duplicated name from the public API
   surface.
2. **`messaging.ts:78` — server-local-clock quiet hours.** This one is a
   correctness fix before it is a deletion. The replacement
   (`isQuietHours(now, brand.timezone)`) must take the timezone explicitly, and
   `nextAllowedTime` must be migrated onto it. **Do not merge this without a
   test proving quiet hours are evaluated in the practice timezone**, because a
   regression here can dispatch an SMS outside the clinic's legal quiet window.
3. **`wholesaler-import.ts:540`.** Superseded by `confirmImport`. Migrate any
   remaining client, then delete.

---

## 7. Phase 5 — Hard navigation (LSB-004)

**Authorisation needed:** `apps/web/app/`, `apps/web/components/`, `apps/web/lib/`
**Removes:** 11 of 17 bindings (6 are justified and stay)

LSB-004 is the largest single category and the one most often *correct*, so this
phase is a triage, not a sweep. The audit (§3 of the audit document) already
splits the 17 sites; the split is the work.

**Keep — annotate with the reason, do not change (6 sites in 5 files):**

| Site | Why the full load is correct |
| --- | --- |
| `app/(auth)/register/page.tsx:215` | handoff to an external payment provider |
| `app/treatment-plan/[token]/treatment-plan-decision-client.tsx:72, :184` | handoff to external e-signature |
| `app/portal/[token]/invoices/page.tsx:59` | external invoice document |
| `app/portal/access/[token]/page.tsx:30` | portal entry with a server-supplied target |
| `components/marketing/website-sections/wellness.tsx:138` | `tel:` scheme |

**Retire — convert to client-side navigation (11 sites):**

`app/(auth)/register/page.tsx:232`, `app/(dashboard)/agent/voice/page.tsx:532`,
`app/(dashboard)/billing/page.tsx:1950`,
`app/(dashboard)/encounters/[appointmentId]/page.tsx:503`,
`app/(dashboard)/schedule/page.tsx:2611`,
`app/(dashboard)/settings/page.tsx:1696, :1705`,
`components/demo/demo-role-switcher.tsx:153`,
`components/portal/portal-shell.tsx:43`,
`components/records/clinical-cards-register.tsx:361`,
`lib/use-unsaved-changes-guard.ts:158`.

**Priority within the phase:** `schedule/page.tsx:2611` and
`encounters/[appointmentId]/page.tsx:503` first. Moving between the day board
and an encounter is the hottest navigation path in the app and currently pays a
full document reload in each direction.

**Two cautions:**

- `components/demo/demo-role-switcher.tsx:153` relies on the full load to reset
  role-scoped state. Converting it requires an explicit cache invalidation
  (`utils.invalidate()`) or the previous role's queries stay warm.
- `lib/use-unsaved-changes-guard.ts:158` interacts with Phase 7. Convert it as
  part of Phase 7, not here, so the guard's navigation blocking is rewritten
  once.

**Verification:** each converted navigation must preserve the tRPC cache where
that is intended and must not leave a stale screen visible mid-transition.

---

## 8. Phase 6 — Browser-storage bindings (LSB-006, LSB-007)

**Authorisation needed:** `apps/web/lib/`, `apps/web/components/`, `apps/web/app/(auth)/`
**Removes:** up to 35 bindings (29 × LSB-006, 5 × LSB-007, 1 × LSB-010), staged

Not all 29 are retirements. Split by whether the state must resolve before
first paint:

**Keep as a browser hint, server value wins** — `openvpm_gui_theme`
(`components/brand/brand-theme.tsx:22`, `lib/theme/theme-context.tsx`) and
`openvpm_locale` (`lib/i18n/context.tsx:68,121`, `lib/pdf.ts:85`). A server
round-trip before first paint would flash the wrong theme. Sanctioned shape:
read storage synchronously as a hint, reconcile against the server-side profile,
server wins.

**Move server-side** — `lib/welcome/local-state.ts` (per-user onboarding state,
already keyed by `userId`), `components/migration/migration-review-checklist.tsx`
(checklist progress), `components/layout/verify-email-banner.tsx` (dismissal).

**Escalate before touching** — `app/(dashboard)/agent/components/agent-chat-history.ts`.
An AI conversation transcript held only in `localStorage` sits outside the audit
ledger. This must land server-side, and the destination must be an audited
store. Treat as its own ticket, not part of this phase.

**LSB-007** — collapse the three copies of the
`(window as any).SpeechRecognition || (window as any).webkitSpeechRecognition`
probe (`agent/imaging/page.tsx:268-269`,
`agent/voice/components/recording-button.tsx:291-292`,
`lib/hooks/use-speech-input.ts:49`) into one typed capability helper.

---

## 9. Phase 7 — The unsaved-changes guard (LSB-008, LSB-010 partial)

**Authorisation needed:** `apps/web/lib/use-unsaved-changes-guard.ts`, `apps/web/lib/voice/mic-simulation.ts`
**Removes:** 13 bindings (4 × LSB-008, 9 × LSB-010 in these two files)

The hardest phase and the last one, because it replaces a platform-API patch
with a declarative mechanism.

`use-unsaved-changes-guard.ts` currently: monkey-patches `window.history.pushState`
(L243), keeps a sentinel history entry (L87), and coordinates five module-level
`let`s (L7–11) into a state machine whose value depends on navigation history.
The replacement must block the navigation *intent* rather than intercept the
platform API.

**Two invariants that must survive, both stated in the module's own comments:**

- Form data is never copied into browser storage — only an in-memory boolean and
  a static warning are tracked.
- Navigation is still blocked while server-unacknowledged clinical form state
  exists.

The pure helpers (`resolveUnsavedPopEffect`, `isSameDocumentHashNavigation`,
`shouldReplaceGuardedHashNavigation`, `canDetachUnsavedListeners`) are already
exported for testing and define the state machine precisely. Port them first;
they are the specification.

`lib/voice/mic-simulation.ts` is the same defect against a different platform
API: a simulated microphone captures the original at L168, overwrites
`navigator.mediaDevices.getUserMedia` document-globally at L171, and restores it
at L204, coordinated by four module-level `let`s (L35, L156, L157, L158). Same
treatment, and the same reason the two files are one phase: in both cases the
module-level `let` is what holds the patched method between install and restore.

**Not in scope:** the four lazily-initialised client singletons —
`lib/email.ts:27`, `lib/messaging/twilio.ts:12`, `lib/i18n/loader.ts:34`,
`lib/rls-assertion.ts:92`. Those are the correct pattern for server modules and
should be suppressed in the rule table rather than retired. The fifth remaining
LSB-010 site, `lib/funnel-visitor.ts:8`, is **not** correct-as-is: it caches a
visitor id that also lives in `localStorage` (LSB-006, same file), so it retires
with Phase 6.

---

## 10. Phase 8 — Legacy data-shape flags (LSB-009)

**Authorisation needed:** `packages/db/` (backfill migration) + `apps/web/`
**Removes:** 13 bindings

Last, because it needs a data migration and P4 applies.

**`legacyBusinessStageRows`** (7 sites: `lib/admin/activation-funnel.ts:43,126,367,574`,
`app/(dashboard)/admin/page.tsx:1582`, `app/api/cron/activation-digest/route.ts:139`,
plus the SQL projection at `activation-funnel.ts:367`) — funnel rows excluded for
missing business-stage evidence. Backfill the stage, then remove the exclusion
and the data-quality counter. Note the counter is surfaced to operators in the
activation digest, so removing it is a product decision as well as a code change.

**`legacyReview`** (6 sites) — **P4 is mandatory here.** `server/routers/billing.ts:2000`
enforces `if (source.legacyReview && !input.acknowledgeLegacyReview)` — a human
must acknowledge a legacy dispense before a draft is created. This is adjacent to
controlled-substance handling (Zákon 139/1998 Z. z.; the detection pattern at
`lib/controlled-substances/policy.ts:86` covers ketamine, propofol, fentanyl,
buprenorphine, butorphanol, methadone, diazepam, phenobarbital, morphine).
Backfill the attribution so `legacyReview` becomes false for every row, confirm
the branch is unreachable, and only then delete it. The UI affordances at
`billing/page.tsx:848,849,921,954` and the copy keys
(`billing.dispense.legacyReviewBadge`, `billing.dispense.dialogReviewLegacyTitle`,
`…Desc`, `…Confirm`) go in the same commit.

**`billingSyncStatus.status === "legacy"`** (`app/(dashboard)/settings/page.tsx:1840`)
— depends on whether any practice is still on the legacy billing sync. Verify
before removing.

---

## 11. Sequencing and effort

| Phase | Rule | Bindings removed | Depends on | Notes |
| --- | --- | --- | --- | --- |
| 1 | LSB-005 (partial) | 1 | — | dead code, zero risk |
| 2 | LSB-005 | 8 | — | also removes 7 hardcoded strings |
| 3 | LSB-003, LSB-002 | 8 | — | URL state |
| 4 | LSB-001 | 3 | — | includes one correctness fix |
| 5 | LSB-004 | 11 of 17 | — | triage; 6 are correct and stay |
| 6 | LSB-006, LSB-007, LSB-010 (1) | ≤35 | — | staged; 1 item escalates |
| 7 | LSB-008, LSB-010 (9) | 13 | 3, 5 | hardest; port the pure helpers first |
| 8 | LSB-009 | 13 | data migration | P4 mandatory |
| | **Retired** | **92** | | |
| | **Deliberately kept** | **10** | | 6 justified LSB-004 handoffs + 4 correct client singletons |
| | **Baseline total** | **102** | | |

92 + 10 = 102, so every audited binding is accounted for: either scheduled for
retirement, or recorded as correct-as-is with a reason.

Phases 1–6 are independent and parallelisable. Phase 7 follows Phase 3 (the
guard's sentinel push interacts with router navigation) and Phase 5 (the guard's
own `window.location.assign` site is converted there). Phase 8 is gated on a
backfill migration, which must respect the append-only migration-history check
enforced by `pnpm --filter @openpims/db db:migrations:check` in CI.

Suppressing the four legitimately-correct client singletons (§9) and re-running
`audit.mjs --update` brings the baseline to its floor.

---

## 12. Definition of done per phase

Every phase is complete when all of these pass:

```bash
node src/legacy/state/audit.mjs                    # gate: exit 0
node --test src/legacy/state/__tests__/rules.test.mjs \
            src/legacy/state/__tests__/scan.test.mjs
pnpm --filter @openpims/web type-check             # 0 errors
pnpm lint                                          # 0 errors, 0 warnings
pnpm --filter @openpims/web i18n:scan --symmetry   # 100% sk/en leaf symmetry
pnpm --filter @openpims/web test                   # no new failures
```

plus, for any phase touching UI copy: the `sk.json`/`en.json` leaf-key sets stay
identical. The symmetry is the invariant, not the count — the catalog was 8590
keys per locale when this audit started and 8788 after rebasing onto the Sprint
24/27/29/30 commits, symmetric both times.

---

## 13. Rollback

Each phase is one revertible commit with a refreshed `baseline.json`. Rolling
back a phase restores both the code and the baseline together, so the gate
cannot be left failing by a partial revert. Phase 8 is the exception: its
backfill migration is append-only and must not be reverted — roll back only the
application-layer deletion, leaving the backfilled data in place.
