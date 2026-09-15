# OpenVPM AI — Module Integration, Duplication & Navigation Consolidation Audit

> **Usage:** Paste everything below the cut line into a fresh orchestrator-agent
> session (GLM-5.3 or Claude Code, with subagent/parallel-task capability enabled)
> running at the repo root (`C:\Users\marek\Documents\vet\openvpm-ai`). This is a
> **read + propose** mission: do not modify `apps/`, `packages/`, `custom-nav.ts`,
> `sidebar.tsx`, or any other application code. All output is new files under a
> dedicated `artifacts/` folder (see §6). Restructuring, if approved later, is a
> separate follow-up implementation pass — not this one.
>
> Companion prior-art files to read FIRST (do not duplicate their work — verify,
> extend, and cite them):
> - `artifacts/ux-codebase-analysis-2026-09-11.md` — see finding **F4**
>   (`apps/web/app/(dashboard)/` has 25 directories — navigation clustering problem
>   already flagged once; this audit is the deep dive on fixing it).
> - `artifacts/feature-map-2026-09-12/` — domain-by-domain feature inventory and
>   `REORGANIZATION-FINDINGS.md` (orphaned/phantom features, naming collisions —
>   read this before re-deriving the same findings from scratch).
> - `artifacts/audit-prompts/feature-map-user-manual-prompt.md` — sibling prompt
>   this one is modeled on; reuse its §0 grounding/tagging discipline.
>
> State your own commit hash / clone date at run time (§0). Treat every prior-art
> claim as something to re-verify, not something to assume still holds.

---

You are a senior product/IA (information architecture) consultant with experience in
practice-management software, navigation design, and monorepo codebase archaeology
(Next.js/tRPC/Drizzle stacks). Your job is not to write code — it is to produce a
clear, evidence-based map of where OpenVPM AI's feature surface (dashboard nav +
Settings) should be **integrated, merged, renamed, or relocated** so the product feels
coherent instead of like 40+ independently-bolted-on modules.

## MISSION

OpenVPM AI's dashboard sidebar currently mixes two sources of nav items — the vanilla
`sidebar.tsx` items (Prehľad, Pacienti, Záznamy, Vyšetrenia, Laboratórium, Zdravotné
pripomienky, Pripomienky, Rozvrh, Čakáreň, Provozová tabuľa, Klienti, Správy, Sklad,
Omamné látky, Fakturácia, Zákonné registre, Prehľady, Platform Admin, Nastavenia,
Agent) and `apps/web/config/custom-nav.ts`'s ~19 AI/marketing/support extensions
(Marketingové Štúdio + 12 sub-items, Analýza Snímkov, Hlasové Diktovanie, Prepúšťacie
Správy, Vet Intelligence, e-Kasa Doklady, Vzdialená Podpora, Admin Podpora, Pilotná
Reconciliácia) — roughly **40 top-level-or-near-top-level entries** for one product.
`F4` already flagged the raw directory-count problem. Nobody has yet asked the harder
question: **which of these should actually exist as separate nav destinations at all**,
versus being a tab/action/widget inside a broader module, or a row in Settings.

Your job, in four parts:

1. **Full inventory** of every nav-reachable module (vanilla + custom), with its real
   backing code, so judgments in parts 2-4 rest on evidence, not on the label alone.
2. **Integration audit** — for each module, what data/workflows from *other* modules
   it could surface but currently doesn't (missed cross-links, duplicate data entry,
   siloed views of the same entity).
3. **Duplication & merge audit** — which modules represent the same underlying concept
   exposed twice (or more), and should become one.
4. **Placement audit** — which modules are conceptually a *feature of* a broader module
   (should be nested inside it, not a sibling nav item) and which are actually
   *configuration*, not daily workflow (should move under Nastavenia / Settings).

Named starting hypotheses (verify each — do not assume any of these is correct as
stated; some may turn out fine as-is):

| # | Hypothesis | Why it's suspicious |
|---|---|---|
| H1 | `Web kliniky` (`/marketing/website`) is under-integrated with the rest of the system's data (patients, reviews, hours, staff, services) | A public clinic website is exactly the kind of module that should pull live data, not be hand-authored in isolation |
| H2 | `Knižnica médií` (`/marketing/media`) is under-integrated with Imaging, Records, and the other Marketing sub-tools that need images (handouts, website, TV) | A media library that only serves one consumer isn't really a shared library |
| H3 | `Vzdialená Podpora` (`/support`) and `Admin Podpora` (`/admin/support`) may be the same underlying support feature exposed twice by role, rather than two distinct features | Near-identical naming, both `section: "admin"`, one is role-gated to `admin` only |
| H4 | `Prepúšťacie Správy` (`/agent/discharge`) is a *feature of* the clinical record (generate a discharge summary from an encounter/visit) that has been promoted to its own top-level nav item instead of living inside Records/Encounters | AI-generated document tied 1:1 to a specific patient visit |
| H5 | `Analýza Snímkov` (`/agent/imaging`) is a *feature of* Lab/Imaging that has been split into a separate "Agent"/AI section instead of living inside the imaging workflow | Same pattern as H4 — AI capability split from the domain it operates on |
| H6 | `Klinické záznamy` (the vanilla `Záznamy` item) has an unclear boundary against `Vyšetrenia` (encounters), `Zdravotné pripomienky`, and `treatment-plans` — multiple nav items may all be "the clinical record" sliced differently | Veterinary PIMS commonly conflate "records," "visits/encounters," and "problem list" — worth confirming OpenVPM AI hasn't done the same |
| H7 | Given H3-H6, and F4's 25-directory count, some fraction of the ~40 nav-reachable modules are configuration/setup screens that belong under `Nastavenia`, not the main sidebar | Standard IA smell: anything touched once-per-clinic-setup, not once-per-patient-visit, is a Settings candidate |

═══════════════════════════════════════════════════════
§0 ACCESS & GROUNDING PROTOCOL (governs everything, non-negotiable)
═══════════════════════════════════════════════════════

- State the commit hash (`git rev-parse --short HEAD`) or clone timestamp at the top
  of every file you produce.
- Every claim gets a source tag:
    - `[VERIFIED: path/to/file.ts:L42]` — you read this exact line/function
    - `[VERIFIED: path/to/file.ts]` — you read the file, no specific line
    - `[INFERRED]` — reasonable deduction, not directly seen
    - `[CLAIMED IN DOCS]` — from README/docs, not confirmed in code
    - `[UNVERIFIED — could not access]` — could not check at all
- A hypothesis (H1-H7) that turns out **false** on inspection is a valid, useful
  finding — say so plainly ("H3 is false: `/support` and `/admin/support` back
  different tRPC procedures and serve different audiences — see evidence") rather
  than forcing a merge recommendation to fit the seed list.
- This is a **propose-only** mission. Every recommendation gets a migration-risk note
  (low/med/high) covering role-permission changes, broken deep links/bookmarks,
  i18n key churn, and any e2e specs (`e2e/*.spec.ts`) that assert on the current nav
  structure — do not recommend a move without naming what could break.

═══════════════════════════════════════════════════════
§1 FULL INVENTORY (orchestrator, before fan-out)
═══════════════════════════════════════════════════════

Produce `artifacts/ia-consolidation-<date>/NAV-INVENTORY.md`: one row per nav item
from both `apps/web/components/layout/sidebar.tsx` (vanilla) and
`apps/web/config/custom-nav.ts` (custom), with columns:

| Nav label (SK) | Route | Source (vanilla/custom) | Section | Roles | Backing router/lib (tRPC procedure or `lib/*` module) | Backing DB tables | One-line purpose `[VERIFIED]` |

This is the shared ground truth every subagent works from — do not let subagents
re-derive it independently and disagree.

═══════════════════════════════════════════════════════
§2 MODULE CLUSTERS FOR FAN-OUT
═══════════════════════════════════════════════════════

Group the inventory into clusters and assign one subagent per cluster (adjust
grouping if the inventory reveals a better split — record why):

1. **Clinical/Records cluster** — Záznamy, Vyšetrenia, Zdravotné pripomienky,
   Pripomienky, treatment-plans, templates, vitals (tests H6)
2. **AI/Agent cluster** — Analýza Snímkov, Hlasové Diktovanie, Prepúšťacie Správy,
   Vet Intelligence, `/agent/*` generally (tests H4, H5)
3. **Marketing/Web/Media cluster** — Marketingové Štúdio and all 12 `/marketing/*`
   sub-items, especially Web kliniky and Knižnica médií (tests H1, H2)
4. **Support/Admin/Pilot cluster** — Vzdialená Podpora, Admin Podpora, Pilotná
   Reconciliácia, Platform Admin (tests H3)
5. **Front-desk/Ops cluster** — Rozvrh, Čakáreň, Provozová tabuľa, Klienti, Správy
6. **Finance/Compliance cluster** — Fakturácia, e-Kasa Doklady, Omamné látky,
   Zákonné registre, Prehľady
7. **Settings/Setup sweep** (cross-cluster, tests H7) — for every module across all
   six clusters above, this subagent specifically asks: "is this a once-per-setup
   configuration screen masquerading as a daily-use nav item?" and produces its own
   candidate list independent of the other subagents' framing, to cross-check them.

═══════════════════════════════════════════════════════
§3 PER-MODULE ANALYSIS TEMPLATE (each cluster subagent fills this in)
═══════════════════════════════════════════════════════

For every module in the subagent's cluster, in
`artifacts/ia-consolidation-<date>/clusters/<cluster-slug>.md`:

### A. Integration opportunities
What data or workflow from *other* domains could this module surface/consume but
currently doesn't? (e.g., "Web kliniky's staff bio section has no link to the
`veterinarians` table — staff names are hand-typed" `[VERIFIED: path:line]`). Name
the specific other domain and the specific missing link — not a generic "could be
more integrated."

### B. Duplication / overlap check
Does this module's underlying concept (not just its name) overlap with another
module's? Compare backing tRPC procedures / DB tables, not just UI labels. State a
concrete overlap percentage judgment (none / partial / near-total) with evidence.
If two modules in *different* clusters look like candidates, flag it for the
orchestrator rather than guessing which cluster owns the merge call.

### C. Nesting candidate (is this really a feature of something broader?)
Does this module operate on a single entity that already has its own home (a patient
visit, an encounter, an inventory item)? If so, it's a nesting candidate — name the
parent module and where inside it (new tab, action button, panel) this would live.

### D. Settings candidate
Is this module configuration/setup (touched rarely, by admin/owner role, to define
how the clinic works) rather than a daily clinical/front-desk/billing workflow? If
so, propose which existing Settings section it joins, or whether Settings itself
needs a new subsection.

### E. Scope-clarity verdict
Is the module's name a clear, non-overlapping description of what it does? If
ambiguous or misleading given what you found in A-D, propose a clearer name and a
one-sentence scope statement ("Klinické záznamy = X, not Y — Y lives in
Vyšetrenia").

### F. Recommendation + migration risk
One of: **keep as-is** / **merge into <other module>** / **nest inside <parent
module>** / **move to Settings** / **rename to <name>, keep placement**. Migration
risk (low/med/high) per §0's checklist (roles, deep links, i18n keys, e2e specs).

═══════════════════════════════════════════════════════
§4 CROSS-CLUSTER CONSOLIDATION (orchestrator, after all subagents finish)
═══════════════════════════════════════════════════════

### `artifacts/ia-consolidation-<date>/INTEGRATION-OPPORTUNITIES.md`
Every §3.A finding from every cluster, in one prioritized list (impact × effort,
plain judgment call, justify it in one line each).

### `artifacts/ia-consolidation-<date>/MERGE-CANDIDATES.md`
Every §3.B "partial" or "near-total" overlap, resolved into a definite merge/no-merge
call (the orchestrator has visibility across all clusters that a single subagent
doesn't — use it, especially for the H3 support pair and any new cross-cluster
overlaps subagents flagged).

### `artifacts/ia-consolidation-<date>/NAV-RESTRUCTURE-PROPOSAL.md`
A single proposed nav tree: which of the ~40 current entries remain top-level,
which become nested tabs/actions inside another module (and where exactly), and
which move under Nastavenia. Present as a before/after tree diagram (markdown nested
list is fine). This is the document meant to directly inform a future
`custom-nav.ts` / `sidebar.tsx` refactor — be concrete about the target structure,
not just the problems with the current one.

### `artifacts/ia-consolidation-<date>/SCOPE-CLARIFICATIONS.md`
Every §3.E naming/scope fix, especially the Klinické záznamy vs. Vyšetrenia vs.
Zdravotné pripomienky vs. treatment-plans boundary (H6) — this needs a definitive,
unambiguous statement of what each one is *for*, since it's the seed question that
motivated this whole audit.

═══════════════════════════════════════════════════════
§5 OUTPUT LOCATION
═══════════════════════════════════════════════════════

```
artifacts/ia-consolidation-<YYYY-MM-DD>/
  RUN-NOTES.md                       (commit hash, cluster list, any regrouping + why)
  NAV-INVENTORY.md                   (§1)
  INTEGRATION-OPPORTUNITIES.md       (§4)
  MERGE-CANDIDATES.md                (§4)
  NAV-RESTRUCTURE-PROPOSAL.md        (§4)
  SCOPE-CLARIFICATIONS.md            (§4)
  clusters/
    clinical-records.md
    ai-agent.md
    marketing-web-media.md
    support-admin-pilot.md
    front-desk-ops.md
    finance-compliance.md
    settings-setup-sweep.md
```

Do not write anywhere else. Do not modify `apps/`, `packages/`, `custom-nav.ts`,
`sidebar.tsx`, or existing `docs/`/`artifacts/` files.

═══════════════════════════════════════════════════════
SELF-CHECK BEFORE FINALIZING (orchestrator)
═══════════════════════════════════════════════════════

- [ ] Did you state a commit hash at the top of every file?
- [ ] Did you read `artifacts/ux-codebase-analysis-2026-09-11.md` (F4) and
      `artifacts/feature-map-2026-09-12/REORGANIZATION-FINDINGS.md` before starting,
      and cite/extend rather than re-derive their findings?
- [ ] Did every one of H1-H7 get a definite verdict (true/false/partially true) with
      evidence, rather than being silently assumed correct?
- [ ] Does `NAV-RESTRUCTURE-PROPOSAL.md` account for every one of the ~40 inventoried
      nav items — no module silently dropped from the before/after tree?
- [ ] Did the Settings/Setup sweep subagent (§2.7) work independently of the other
      clusters' framing, so its Settings-candidate list is a genuine cross-check
      rather than an echo?
- [ ] Does every merge/nest/relocate recommendation carry a migration-risk note
      (roles, deep links, i18n keys, e2e specs)?
- [ ] Does `SCOPE-CLARIFICATIONS.md` give Klinické záznamy an unambiguous definition
      distinct from Vyšetrenia, Zdravotné pripomienky, and treatment-plans?
