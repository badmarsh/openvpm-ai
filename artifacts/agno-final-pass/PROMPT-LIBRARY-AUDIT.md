# PROMPT-LIBRARY-AUDIT.md — Prompt Library Audit

**Generated:** 2026-09-26
**Agent:** Arena Final Pass Consolidation Agent
**Verification method:** `ls tasks/`, `ls tasks/proposed/`, `ls prompts/`, `find tasks -type f | wc -l` — all in-session

---

## Preflight Verification (verbatim)

```bash
find tasks -type f | wc -l        # → 87
ls tasks | wc -l                  # → 71 entries (2 are directories)
ls tasks/proposed | wc -l         # → 17
ls prompts/                       # → arena-final-pass-agno-consolidation.md,
                                  #    arena-sprint-writer-prompt.md
```

**87 vs 118 discrepancy RESOLVED:** `find` counts recursively. 69 top-level files in
`tasks/` + 17 Golden Tickets in `tasks/proposed/` + 1 file in
`tasks/openvpm-sprint5-prescriptions-pr/` (PULL_REQUEST.md) = **87**. No evidence of
missing files; the "118" figure in the master prompt matches no current counting
method (UNVERIFIED — likely a stale figure from before sprints 21–30 replaced
interim drafts, or from a different tree state).

---

## Verified Inventory (69 top-level files + 17 proposed + 1 PR dir)

### A. Canonical Sprint Prompts — 30 files ✅ KEEP
`arena-sprint-1-command-palette.md` … `arena-sprint-30-automations-crm-journeys.md`
(all 30 verified present, contiguous numbering). These are the single source of
truth for sprint assignments. Per SPRINT-INDEX.md: 16 merged (1–14, 16–17),
8 dispatched (15, 18–23, 25), 6 written-only (24, 26–30).

### B. Timestamped Arena Duplicates / Fragments — 12 files ⚠️ ARCHIVE
Superseded snapshots with Unix-epoch prefixes; content duplicates canonical sprints
or contains truncated fragment titles:

| File | Superseded by |
|---|---|
| arena-1790286107-arena-sprint-8-billing-ledger-.md | sprint 8 |
| arena-1790288625-task-openvpm-sprint-5-prescrip.md | sprint 5 |
| arena-1790292063-task-openvpm-sprint-5-prescrip.md | sprint 5 |
| arena-1790306655-sprint-11-reports-wellness.md | sprint 11 |
| arena-1790308093-lab-results-page.md | sprint 4 |
| arena-1790325424-sprint-24-finalize-vpm-context.md | NOT sprint-24 (different scheme — fragment) |
| arena-1790325424-sprint-26-audit-legacy-state-b.md | NOT sprint-26 (fragment) |
| arena-1790325424-sprint-27-implement-schema-val.md | NOT sprint-27 (fragment) |
| arena-1790325424-sprint-28-optimize-dependency-.md | NOT sprint-28 (fragment) |
| arena-1790325424-sprint-29-generate-openapi-com.md | NOT sprint-29 (fragment) |
| arena-1790325424-sprint-30-secure-interop-bridg.md | NOT sprint-30 (fragment) |
| arena-1790329318-arena-sprint-25-encounter-deta.md | sprint 25 |

> Note: the six `arena-1790325424-sprint-2X-*` files describe a *different* batch
> (finalize-context, schema-validation, openapi, interop) than canonical sprints
> 24–30 (admin-panel, marketing, inventory, agent-hub, patient-detail, automations).
> They are remnants of an abandoned numbering scheme — keep out of dispatch paths.

### C. Legacy / Superseded Prompts — 6 files ⚠️ ARCHIVE
| File | Reason |
|---|---|
| arena-consolidation-sprint.md | pre-final-pass consolidation; superseded by `prompts/arena-final-pass-agno-consolidation.md` |
| arena-next-sprint.md | superseded by `prompts/arena-sprint-writer-prompt.md` |
| ui-consolidation-prompt.md | pre-UIKIT consolidation; UIKIT.md + page-kit now authoritative |
| ui-phase2-headings.md | fragment (headings only) |
| command-palette-ranking-plan.md | planning doc for merged sprint 1 |
| deer-flow-test-runner-prompt.md | foreign test-runner prompt, not OpenVPM sprint flow |

### D. Agno Pipeline Prompts — 4 files ✅ KEEP (historical) / REVIEW
| File | Status vs `.agents/agno/` code |
|---|---|
| arena-sprint-agno-enterprise-specs.md | 12 enterprise capabilities verified implemented in `pipeline_team_os.py` header + code (learning, memory, knowledge, metrics, evals, approvals, scheduler…) |
| arena-sprint-agno-pipeline-audit-phase2.md | Phase 2 (WAL, busy_timeout, FK) verified implemented (module docstring + `SQLITE_BUSY_TIMEOUT_MS`) |
| arena-sprint-agno-pipeline-hardening.md | partially implemented (token persistence verified); remaining items UNVERIFIED |
| arena-sprint-prompt-engineering-audit.md | superseded by this final pass |

### E. Golden Tickets — 17 files ✅ KEEP ALL
`tasks/proposed/gt-001…gt-017` (names verified). Safety/AI-governance tickets
(provenance ledger, prompt-injection via booking text, OPL prescription wrapper,
imaging hygiene, role gating, data residency, tablet core). Not prompts —
candidate backlog. Highest-risk cluster: gt-003 (OPL), gt-001 (provenance),
gt-002 (injection), gt-008 (imaging).

### F. Agent Response Artifacts — 6 files ⚠️ ARCHIVE
`arena-response-*.md` (incl. the 115 KB `arena-response-01a0d5f4-*.md`). These are
session outputs, not prompts. Move out of dispatch namespace.

### G. One-offs, Meta, Utils — 10 files ✅ KEEP / CASE-BY-CASE
- `README.md`, `SPRINT-INDEX.md` — keep (index is authoritative)
- `Sprint11.md`, `Sprint12.md`, `Sprint13.md` — legacy duplicates of canonical 11–13 → archive
- `fix-encounters-charge-capture-service-picker.md`, `handoff-ci-test-fixes.md`, `inbox-invoice-import-pdf.md` — one-off task briefs
- `pr_sprint10.md`, `openvpm-sprint5-prescriptions-pr/PULL_REQUEST.md` — PR descriptions → archive
- `parse-test-json.mjs`, `parse-test-msgs.mjs` — utility scripts, keep

---

## Contradictions Found (verified)

1. **SPRINT-INDEX.md vs git depth:** index lists PR numbers (#38–#54) for sprints
   1–17, but the local clone is shallow (deepened by 12) and cannot confirm all
   merge commits in-session → merge status of sprints 1–14, 16–17 is taken from
   the index, **not independently git-verified** (UNVERIFIED per-sprint; index
   itself verified to exist with 30 rows).
2. **Duplicate sprint-5 dispatch lineage:** canonical `arena-sprint-5-*.md` plus
   two timestamped task variants — a dispatched agent reading `tasks/` broadly
   could act on a stale variant. Mitigation: dispatch only canonical files.
3. **Two conflicting sprint-24…30 batches** (see table B) — canonical vs
   `arena-1790325424-*` scheme.

## Recommendations

1. Create `tasks/archive/` and move: 12 timestamped files (B), 6 legacy prompts (C),
   6 response artifacts (F), 3 legacy SprintNN.md, 2 PR descriptions → 29 files.
   `tasks/` shrinks to canonical sprints + meta + one-offs + utils + proposed/.
2. Never dispatch non-canonical `arena-*` files; teach the writer prompt to
   fail on any `arena-<epoch>-*` name.
3. Add the source-contract-trap section (7777/3007 literals,
   `admin.aiSwarm.*` i18n pins) to every future sprint prompt — present in
   `arena-sprint-writer-prompt.md` §4.7, absent from sprint stubs 20–30.

---

**Artifact Status:** ✅ Complete — every filename above verified via in-session `ls`; content-level claims marked UNVERIFIED where noted.
