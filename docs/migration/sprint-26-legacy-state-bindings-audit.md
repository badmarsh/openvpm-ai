# Sprint 26 — Legacy State Bindings Audit

**Status:** complete · **Risk class:** `risk:low` · **Audited at:** `8a1b335`, re-verified
unchanged after rebasing onto the Sprint 24/27/29/30 commits
**Scope:** `src/legacy/state/`, `docs/migration/` (ticket-permitted paths only)

This document is the deliverable for *"Identify and document all deprecated
state bindings"*. Every count, file and line number below was produced by the
auditor in [`src/legacy/state/`](../../src/legacy/state/) and is reproducible:

```bash
node src/legacy/state/scan.mjs            # full report
node src/legacy/state/scan.mjs --by-rule  # counts
node src/legacy/state/audit.mjs           # gate against baseline.json
```

---

## 0. Two corrections to the ticket's premises

The ticket names `src/legacy/state/` as the directory holding the deprecated
bindings, and asks for a plan "per OpenVPM Migration Guide v3". Neither existed
when this sprint started. Verified:

| Claim in the ticket | What the repository actually contains |
| --- | --- |
| Deprecated state bindings live in `src/legacy/state/` | No `legacy` directory or file exists anywhere in the repo (`find … -iname '*legacy*'` returns nothing), and there is no root-level `src/` at all — the web app is `apps/web`. The bindings are real; the path in the ticket is not. |
| "OpenVPM Migration Guide v3" | `grep -rn "Migration Guide"` across the repo returns no match. The closest artefacts are [`docs/migrating-to-openvpm.md`](../migrating-to-openvpm.md) (CSV data migration from other PIMS vendors) and [`DESIGN-SYSTEM-MIGRATION.md`](../../DESIGN-SYSTEM-MIGRATION.md) (design-token migration). Neither is a code-migration protocol. |

Rather than stall, this sprint did two things: it **created** `src/legacy/state/`
as the canonical home for the legacy-state auditor (the ticket lists the path as
permitted, so creating it is in scope), and it defines the migration protocol
explicitly in
[`sprint-26-legacy-state-migration-plan.md`](./sprint-26-legacy-state-migration-plan.md)
instead of citing a guide that does not exist. If "Migration Guide v3" is a
document that lives outside this repository, point at it and the plan will be
re-aligned to it.

**Consequence for the audit:** the inventory below is not a directory listing.
It is the output of a rule-based scan over `apps/web/` and `packages/`, which is
where the bindings actually are.

---

## 1. Summary

**102 bindings across 10 rules, in 51 files.** Nothing in this inventory is
broken — every binding works today. "Legacy" means the sanctioned way to hold
that state is now something else, and each row below is a binding a future
sprint must be able to retire without a user-visible regression.

| Rule | Severity | Count | Category | Title |
| --- | --- | --- | --- | --- |
| LSB-001 | high | 3 | deprecated-api | Deprecated exported symbol kept live |
| LSB-002 | medium | 2 | legacy-url-state | Backwards-compatible query-param map |
| LSB-003 | high | 6 | legacy-url-state | Direct History API write |
| LSB-004 | medium | 17 | legacy-url-state | Hard navigation resets client state |
| LSB-005 | medium | 9 | legacy-route | Client-side legacy route redirect stub |
| LSB-006 | medium | 29 | legacy-browser-state | Browser-storage state binding |
| LSB-007 | low | 5 | legacy-browser-state | Untyped window global access |
| LSB-008 | high | 4 | legacy-browser-state | Platform API monkey-patch |
| LSB-009 | medium | 13 | legacy-data-state | Legacy data-shape flag in state |
| LSB-010 | low | 14 | legacy-browser-state | Module-level mutable singleton |
| **Total** | | **102** | | |

By severity: **13 high**, **70 medium**, **19 low**.

**Re-verification after rebase.** The audit was first run against `8a1b335`. The
branch was then rebased onto four later sprint commits (Sprints 24, 27, 29, 30)
that add 50 files, including `apps/web/core/context/`, `apps/web/hooks/` and
`apps/web/lib/interop/`. Re-running the scan over the rebased tree — 1075 source
files, 17 of them in those new directories — returns **exactly 102 findings**, so
none of that code introduces a legacy state binding under these rules. The
baseline was regenerated and is unchanged in content.

---

## 2. High-severity findings

These are the three that change behaviour if they drift, and therefore the three
to retire first.

### LSB-001 — Deprecated exported symbol kept live (3)

A `@deprecated` JSDoc tag is a request, not an enforcement. The symbol is still
exported and still callable; nothing prevents a new caller from using it.

| Site | What is deprecated |
| --- | --- |
| `apps/web/server/routers/_app.ts:79` | `visitTreatmentPlans` — an alias of `treatmentEstimatesRouter`, kept after the FEAT-4 rename |
| `apps/web/lib/marketing/messaging.ts:78` | A quiet-hours helper that reads the **server-local** clock instead of the brand timezone |
| `apps/web/server/routers/extensions/wholesaler-import.ts:540` | A superseded import procedure kept for backward compatibility with an older client |

**Why it matters here.** `_app.ts:79` is the load-bearing one: `visitTreatmentPlans`
and `treatmentEstimates` resolve to the *same router object*, so both names are
live tRPC procedures. A caller that picks the deprecated name silently keeps the
old vocabulary alive in the API surface. `messaging.ts:78` is worse than cosmetic
— a quiet-hours check evaluated against server-local time can send an SMS outside
the clinic's legal quiet window when the server timezone differs from the
practice timezone.

**Migration:** delete the alias once its last caller is migrated. Where an
external contract forbids deletion, gate it behind an explicit compatibility
router rather than a JSDoc hint. Fix `messaging.ts:78` by making the timezone an
argument, then remove the deprecated overload.

### LSB-003 — Direct History API write (6)

Writing the URL behind the Next.js router desynchronises the router's internal
state from the address bar. After such a write, `useSearchParams` still returns
the *old* value while the browser shows the new one.

| Site | Write |
| --- | --- |
| `apps/web/app/(dashboard)/patients/[id]/page.tsx:417` | `window.history.replaceState(…)` in `setActiveTab` |
| `apps/web/app/(dashboard)/patients/[id]/page.tsx:516` | `window.history.replaceState(…)` |
| `apps/web/app/(dashboard)/records/page.tsx:1181` | `history.replaceState(null, "", url)` in `openRecordTab` |
| `apps/web/app/(dashboard)/records/page.tsx:1903` | `history.replaceState(null, "", url)` in `Tabs onValueChange` |
| `apps/web/components/onboarding/journey-overlay.tsx:118` | `window.history.replaceState(…)` |
| `apps/web/lib/use-unsaved-changes-guard.ts:87` | `originalPushState.call(…)` (sentinel push) |

The four page-level sites all do the same thing: keep `?tab=` in the address bar
without a navigation. The reason it is legacy is not the intent but the
mechanism — `router.replace(url, { scroll: false })` expresses the same intent
and keeps the router authoritative.

### LSB-008 — Platform API monkey-patch (4)

Assigning over a platform method is a document-lifetime global mutation: every
later call site flows through the replacement whether or not the component that
installed it is still mounted. Two families are present.

| Site | Patch |
| --- | --- |
| `apps/web/lib/use-unsaved-changes-guard.ts:243` | `originalPushState = window.history.pushState` (capture) |
| `apps/web/lib/voice/mic-simulation.ts:168` | `originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(…)` (capture) |
| `apps/web/lib/voice/mic-simulation.ts:171` | `navigator.mediaDevices.getUserMedia = async (…) => {` (install) |
| `apps/web/lib/voice/mic-simulation.ts:204` | `navigator.mediaDevices.getUserMedia = originalGetUserMedia` (restore) |

`use-unsaved-changes-guard.ts:243` is the highest-leverage binding in the
inventory. The module replaces `window.history.pushState` for the **whole
document**, from a module-level `let` initialised once (`listenersAttached`,
line 7) and never reset on route change. Every navigation in the app — including
navigations the router initiates — flows through the patched method for as long
as any unsaved-changes guard is mounted.

It is also the binding with the most module-level state around it: five
top-level `let`s at lines 7–11 (`listenersAttached`, `originalPushState`,
`sentinelActive`, `bypassBeforeUnload`, `pendingPopAction`) jointly encode a
small state machine whose current value depends on navigation history. That is
why the same file appears under LSB-003, LSB-008 and LSB-010.

`mic-simulation.ts` is the same defect against a different platform API: a
simulated microphone installs itself by overwriting
`navigator.mediaDevices.getUserMedia` document-globally (L171) and restores it
at L204, coordinated by three module-level `let`s (L156, L157, L158). The
capture/install/restore triple at L168/L171/L204 is why this rule reports four
sites rather than two.

> **Rule provenance.** This rule originally matched only the `History` family.
> The `getUserMedia` triple was found during this audit and the rule was
> broadened, which raised the count from 99 to 102. The broadened pattern uses
> `\s*(?<![=!<>])=(?!=)` so that `===` / `!==` comparisons against these
> properties are not reported; both the positive and the comparison cases are
> unit-tested.

**Migration:** replace the interception with a declarative guard the router can
query (block the navigation *intent*) rather than patching the platform API.
Note the module's own comment already states the right invariant — *"Only an
in-memory boolean and static warning are tracked; form data is never copied into
browser storage"* — so the replacement must preserve that: no clinical form data
in browser storage.

---

## 3. Medium-severity findings

### LSB-002 — Backwards-compatible query-param map (2)

`apps/web/app/(dashboard)/patients/[id]/page.tsx:234` (definition), `:404` (use)

```ts
// Backwards-compatible mapping for previously bookmarked ?tab= links
const LEGACY_TAB_MAP: Record<string, Tab> = { weight: "overview", appointments: "overview",
  clinical: "diagnostics", vitals: "diagnostics", labResults: "diagnostics",
  records: "history", vaccinations: "preventive", procedures: "preventive",
  documents: "admin", invoices: "admin" };
```

Ten retired tab ids are still accepted and translated client-side, so the
`?tab=` URL contract has two shapes. This is a well-executed compatibility shim
— the comment explains every merge — but it lives in the render path forever.

**Migration:** move the translation to a server redirect at the route boundary so
the client only ever sees canonical state, then delete the map.

### LSB-004 — Hard navigation resets client state (17)

A full document load discards the React tree, the tRPC cache and every in-flight
query. Sites, grouped by whether the hard load is actually justified:

**Justified — genuine cross-origin or cross-app handoff (keep, document why):**

| Site | Handoff |
| --- | --- |
| `app/(auth)/register/page.tsx:215` | `data.checkoutUrl` — external payment provider |
| `app/treatment-plan/[token]/treatment-plan-decision-client.tsx:72, :184` | `data.signUrl` — external e-signature |
| `app/portal/[token]/invoices/page.tsx:59` | `data.url` — external invoice document |
| `app/portal/access/[token]/page.tsx:30` | `body.redirectTo` — portal entry |
| `components/marketing/website-sections/wellness.tsx:138` | `tel:` scheme |

**Not justified — same-origin navigation that could be client-side (retire):**

| Site | Target |
| --- | --- |
| `app/(auth)/register/page.tsx:232` | `nextPath` (internal) |
| `app/(dashboard)/agent/voice/page.tsx:532` | `/patients/${id}` |
| `app/(dashboard)/billing/page.tsx:1950` | internal `url` |
| `app/(dashboard)/encounters/[appointmentId]/page.tsx:503` | `/schedule` |
| `app/(dashboard)/schedule/page.tsx:2611` | `/encounters/${id}` |
| `app/(dashboard)/settings/page.tsx:1696, :1705` | internal `url` |
| `components/demo/demo-role-switcher.tsx:153` | internal destination |
| `components/portal/portal-shell.tsx:43` | `/` |
| `components/records/clinical-cards-register.tsx:361` | internal |
| `lib/use-unsaved-changes-guard.ts:158` | `anchor.href` |

The two `schedule`/`encounters` sites are the costly ones: navigating between the
day board and an encounter is the hottest path in the app and currently pays a
full reload each way.

### LSB-005 — Client-side legacy route redirect stub (9)

Nine page components whose entire behaviour is to move the visitor somewhere
else. Each ships a client bundle, hydrates, mounts, and only then redirects.

| Stub route | Redirects to | Hardcoded copy? |
| --- | --- | --- |
| `/admin/pilot` | `/admin` | yes — `"Presmerovávam na Platform Admin…"` (L18) |
| `/marketing/competitors` | `/vet-intel?tab=market` | yes (L17) |
| `/marketing/content-queue` | `/marketing?tab=queue` | yes (L18) |
| `/marketing/messages` | `/inbox?tab=logs` | no — spinner only |
| `/marketing/plan` | `/marketing?tab=calendar` | yes (L18) |
| `/marketing/suppression` | `/marketing/automations?tab=suppression` | yes (L18) |
| `/marketing/tv` | `/waiting-room` | yes (L22) |
| `/marketing/wellness` | `/wellness` | yes (L18) |
| `/vet-intel` | `/marketing?tab=competitors` | yes (L18) |

Three further problems fall out of this table, all verified:

**(a) `/marketing/tv` is already dead code.** `apps/web/next.config.js:99-103`
already declares `{ source: "/marketing/tv", destination: "/waiting-room",
permanent: true }`, and per the Next.js documentation *"Redirects are checked
before the filesystem which includes pages and `/public` files."* The config
redirect (308) therefore wins and the page component can never render. Deleting
it is zero-risk.

**(b) A two-hop redirect chain.** `/marketing/competitors` → `/vet-intel?tab=market`
→ `/marketing?tab=competitors`. The `tab=market` query param is dropped, because
`/vet-intel/page.tsx` is itself a stub that ignores query params. `/vet-intel/`
contains nothing but the 628-byte stub — there is no Vet Intelligence page behind
it. A visitor paying two hydrations to land on a tab.

**(c) 8 of the 9 stubs violate the i18n rule.** Each renders a hardcoded Slovak
string, so an English-locale clinician sees Slovak mid-redirect. The repo's own
scanner confirms each one (`node scripts/scan-hardcoded-i18n.js <file>`). Moving
these to `next.config.js` `redirects()` deletes the strings instead of
translating them — the correct fix for both findings at once.

### LSB-006 — Browser-storage state binding (29)

Per-browser storage instead of account state: invisible to the server,
un-migratable, lost on device change. Four logical keys across 29 call sites:

| Key | Sites | Nature |
| --- | --- | --- |
| `openvpm_gui_theme` | `components/brand/brand-theme.tsx:22`; `lib/theme/theme-context.tsx:38,39,40,91,98,119,120` | presentation preference |
| `openvpm_locale` | `lib/i18n/context.tsx:68,121`; `lib/pdf.ts:85` | presentation preference |
| welcome/onboarding state | `lib/welcome/local-state.ts:33,46` (keyed `storageKey(userId)`) | per-user, but client-only |
| funnel visitor id | `lib/funnel-visitor.ts:24,33,51` | analytics identity |
| chat history | `app/(dashboard)/agent/components/agent-chat-history.ts:23,38,50` | conversation transcript |
| registration draft | `app/(auth)/register/page.tsx:126,160,169,200` | pre-auth form state |
| verify-email banner | `components/layout/verify-email-banner.tsx:25,29` | dismissal flag |
| AI agents view | `components/automations/ai-agents-view.tsx:89,99` | view preference |
| migration checklist | `components/migration/migration-review-checklist.tsx:55,80` | checklist progress |

`openvpm_locale` and `openvpm_gui_theme` are legitimately browser-hint state —
they must resolve before first paint, so a server round-trip would flash. The
sanctioned shape is storage as a *hint* with the server-side profile value
winning. `agent-chat-history.ts` is the one to watch: an AI conversation
transcript living only in `localStorage` is not covered by the audit ledger.

### LSB-009 — Legacy data-shape flag in state (13)

UI and server logic branching on a marker that exists only because
pre-migration rows never received the newer attribution columns.

| Site | Flag |
| --- | --- |
| `app/(dashboard)/billing/page.tsx:848,849,921,954` | `legacyReview` — dispense charge requires acknowledgement |
| `server/routers/billing.ts:1901,2000` | `legacyReview` — server-side guard `if (source.legacyReview && !input.acknowledgeLegacyReview)` |
| `app/(dashboard)/settings/page.tsx:1840` | `billingSyncStatus.status === "legacy"` |
| `app/(dashboard)/admin/page.tsx:1582`, `app/api/cron/activation-digest/route.ts:139`, `lib/admin/activation-funnel.ts:43,126,367,574` | `legacyBusinessStageRows` — funnel rows excluded for missing business-stage evidence |

The `legacyReview` pair is clinically load-bearing and must **not** be removed
lightly: `server/routers/billing.ts:2000` is the guard that forces a human to
acknowledge a legacy dispense before a draft is created. That is a controlled-
substance-adjacent control (see §5). The correct retirement is a backfill of the
missing attribution, after which the branch becomes unreachable and can be
deleted — not deleting the branch first.

---

## 4. Low-severity findings

### LSB-007 — Untyped window global access (5)

`(window as any).SpeechRecognition` / `webkitSpeechRecognition` at
`app/(dashboard)/agent/imaging/page.tsx:268,269`,
`app/(dashboard)/agent/voice/components/recording-button.tsx:291,292`,
`lib/hooks/use-speech-input.ts:49`.

The same vendor-prefixed capability probe is written three times. On a browser
without the API the expression silently yields `undefined` rather than failing
loudly. **Migration:** one typed capability probe, feature-detected once,
exporting a narrow helper.

### LSB-010 — Module-level mutable singleton (14)

Top-level `let` state shared by every component instance for the lifetime of the
module.

| File | Lines | Nature |
| --- | --- | --- |
| `lib/use-unsaved-changes-guard.ts` | 7, 8, 9, 10, 11 | the guard state machine (see LSB-008) |
| `lib/voice/mic-simulation.ts` | 35, 156, 157, 158 | cached audio buffer + patched `getUserMedia` |
| `lib/email.ts` | 27 | Resend client singleton |
| `lib/messaging/twilio.ts` | 12 | Twilio client singleton |
| `lib/i18n/loader.ts` | 34 | memoised dictionary promise |
| `lib/rls-assertion.ts` | 92 | memoised assertion promise |
| `lib/funnel-visitor.ts` | 8 | visitor id cache |

The four client singletons (`email`, `twilio`, `i18n/loader`, `rls-assertion`)
are the *correct* pattern — lazily-initialised, per-process, and exactly what a
server module should do. They are flagged for completeness, not for retirement.
The two to retire are `use-unsaved-changes-guard.ts` and `mic-simulation.ts`;
both also appear under LSB-008, because the module-level `let`s are what hold the
patched platform method between install and restore.

---

## 5. Clinical-safety interactions

No binding in this inventory may be retired in a way that weakens a clinical
control. The three controls that intersect this audit, each verified at its
current location:

| Control | Statute | Enforcement point |
| --- | --- | --- |
| AI output stays **draft** until a veterinarian signs | Zákon 39/2007 Z. z. | `apps/web/lib/ai/draft-safety.ts` — `resolveAiRecordStatus()` returns `AI_DRAFT_STATUS` unless an explicit confirmation envelope is present; `assertAiMayWriteToSoapNote()` throws on a finalised note |
| **Zero AI prefill** for controlled substances | Zákon 139/1998 Z. z. | `apps/web/lib/controlled-substances/policy.ts:86` — detection pattern covers ketamine, propofol, fentanyl, buprenorphine, butorphanol, methadone, diazepam, phenobarbital, morphine |
| **Sympathy Gate** — no automated reminders for a deceased patient | — | `apps/web/lib/autopilot/consent-gate.ts` — `assertPatientNotDeceased()`; the gate returns `{ allowed: false, reason: "Patient is deceased", suppressionType: "deceased_patient" }` |

Specific constraints on this migration:

1. **LSB-009 (`legacyReview`) is a gate, not clutter.** `server/routers/billing.ts:2000`
   blocks draft creation until a human acknowledges a legacy dispense. Retire by
   backfilling attribution so the branch becomes unreachable — never by deleting
   the branch.
2. **LSB-006 (`agent-chat-history.ts`) touches AI recordkeeping.** An AI
   conversation transcript held only in `localStorage` is outside the audit
   ledger. Any move of this state must land server-side, not in another browser
   store.
3. **LSB-008 (unsaved-changes guard) protects uncommitted clinical input.** The
   module's invariant — form data is never copied into browser storage — must
   survive the rewrite. The replacement must still block navigation while
   server-unacknowledged clinical form state exists.
4. **No retirement may introduce a new reminder path.** Anything that touches
   reminder or outreach dispatch must pass through `consent-gate.ts`, so that a
   deceased patient continues to be suppressed regardless of how the calling
   state is held.

---

## 6. Reproducing this audit

```bash
node src/legacy/state/scan.mjs --by-rule   # counts per rule
node src/legacy/state/scan.mjs             # full file:line report
node src/legacy/state/audit.mjs            # gate vs. baseline.json (exit 1 on new bindings)
node --test src/legacy/state/__tests__/rules.test.mjs \
            src/legacy/state/__tests__/scan.test.mjs
```

The baseline is
[`src/legacy/state/baseline.json`](../../src/legacy/state/baseline.json):
102 findings, first recorded at `8a1b335` and re-generated unchanged after the
rebase. The gate fails when an **unaudited** binding
appears, and reports (without failing) when an audited binding is retired — so
the count can only go down without an explicit, reviewed baseline refresh.

### Known limitation

The auditor is regex-based, line-oriented. It finds the binding *shapes* listed
in §1 and deliberately trades recall for precision: a `router.replace` inside an
event handler is not reported (it is not a legacy redirect stub), and commented-out
code is not reported. It will not find a deprecated binding expressed in a shape
no rule describes. Every rule is unit-tested in
[`src/legacy/state/__tests__/rules.test.mjs`](../../src/legacy/state/__tests__/rules.test.mjs),
including the false-positive cases that were found and fixed during this audit.
