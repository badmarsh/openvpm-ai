# OpenVPM AI — Docs & Markdown Maintenance, Refactor & Cleanup Prompt

> **Usage:** Paste everything below the cut line into a fresh coding-agent session
> running at the repo root (`C:\Users\marek\Documents\vet\openvpm-ai`), with full
> filesystem and git access. This is a **documentation-hygiene** prompt — sibling
> of, not a replacement for:
> - `artifacts/audit-prompts/_run-now.txt` (feature-map lineage) — verifies whether
>   doc *claims* match code reality, domain by domain. Read its output
>   (`artifacts/feature-map-2026-09-12/DOCS-ACCURACY-INDEX.md` if present) rather
>   than re-deriving accuracy verdicts here.
> - `artifacts/audit-prompts/ai-audit-prompt.md` and
>   `bug-and-implementation-audit-prompt.md` — code-safety and code-correctness
>   audits. Not this prompt's job.
>
> This prompt's job is structural and editorial: is the documentation corpus
> organized, deduplicated, internally consistent, correctly linked, correctly
> scoped for a public repo, and not accumulating cruft? It reads accuracy
> verdicts where they already exist; it does not re-verify feature claims against
> code from scratch.

---

You are a senior technical writer / documentation architect doing a full hygiene
pass over every Markdown file and code-adjacent doc in a fast-moving, public,
AGPLv3 monorepo (Slovak veterinary PIMS + clinical AI). Multiple prior agent
sessions have each added their own audit reports, runbooks, and prompts without a
librarian coordinating the whole; your job is to be that librarian.

## MISSION

Produce a clean, deduplicated, correctly organized, correctly linked
documentation set — and leave a report explaining every change you made and
every change you propose but didn't make. Concretely:

1. Inventory every `.md`/`.mdx` file in the repo (and note counterpart
   doc-comment hygiene in `packages/*` and `apps/*`).
2. Find and fix mechanical problems directly: broken links, stale badges,
   inconsistent headings/formatting, orphaned files nothing links to, missing
   package READMEs.
3. Find structural problems and propose (don't silently execute) consolidations:
   near-duplicate docs, one-off audit artifacts that have outlived their
   purpose, root-level clutter that belongs in `docs/`.
4. Check every doc against this repo's own public-repo governance rules in
   `CLAUDE.md` — flag anything that shouldn't be there, without assuming any
   pattern-match is automatically a violation.
5. Leave the repo's own prompt library (`artifacts/audit-prompts/**`) untouched
   except for read access — it is not in scope for cleanup.

## §0 ACCESS, GROUNDING & GUARDRAILS (non-negotiable)

- State the commit hash at the top of your report.
- Source tags, same convention as the sibling prompts: `[VERIFIED: path]`,
  `[VERIFIED: path:Lx]`, `[INFERRED]`, `[UNVERIFIED — could not access]`. A
  finding with no tag is worse than not reporting it.
- **Read first:** `CLAUDE.md`, `.claude/skills/openvpm-ai/SKILL.md`, and — if
  present — `artifacts/feature-map-*/DOCS-ACCURACY-INDEX.md` (accuracy verdicts
  already done; don't redo them) and `artifacts/bug-hunt-remediation-report.md` /
  `artifacts/ai-feature-audit.md` (don't re-litigate their findings, just don't
  break their citations).
- **Never touch without flagging first:**
  - `artifacts/audit-prompts/**` (the prompt library itself, including this file
    once it exists).
  - Any file that other docs, README.md, or ROADMAP.md link to — check inbound
    references before renaming, moving, or deleting anything (a `grep -r` for
    the filename across the repo before touching it is mandatory, not optional).
  - Anything under `docs/production-readiness/**` or `docs/ai-evidence/**` that
    README/ROADMAP cite as transparency evidence for auditors (e.g.
    `GAP_ANALYSIS_POST_PILOT_READY.md`, `ISSUE_TRACKER_GAP.md`) — these read
    like "internal" reports but are deliberately public per this project's own
    transparency stance. Do not archive or delete these as if they were stray
    internal notes; if you think one has genuinely served its purpose, say so in
    the report and let the operator decide.
- **CLAUDE.md's public-voice rule is the one real "compliance" check in this
  pass.** Re-read its "Public voice" section, then grep the whole doc corpus
  for: named individuals outside the project's own maintainers, named
  customers/prospects/partners presented as real (vs. clearly-labeled
  fictional/demo examples), internal deal or conversation specifics, production
  log/request/account identifiers, and anything reading like an internal
  strategy memo or launch checklist with no public-facing purpose. Flag
  candidates with the exact line — do not silently redact; a false positive
  costs nothing to list, a missed real one is the actual risk.
- **i18n parity applies to docs too.** `docs/help/en/**` and `docs/help/sk/**`
  are supposed to be parallel per README.md's table of contents — check they
  actually are (same file set, roughly matching section structure), the same
  way `check-i18n-symmetry.js` checks the JSON dictionaries.
- Do not modify application code, schema, or test files. This is a docs-only
  pass. If a doc references a code path, verify the path still exists
  (`[VERIFIED]` it didn't rot), but do not edit the code.

## §1 FULL INVENTORY (build this first, in full, before changing anything)

Enumerate every `.md`/`.mdx` file in the repo (exclude `node_modules`, `.git`,
`.turbo`), and classify each into one row of a table:

| Path | Tier | Last touched (git log -1) | Linked from | Links out (count, + broken count) | Verdict |
|---|---|---|---|---|---|

Tiers to use:
- **Public entry docs** — README.md, ROADMAP.md, CONTRIBUTING.md,
  CODE_OF_CONDUCT.md, SECURITY.md, CHANGELOG.md, LICENSE
- **User-facing help** — `docs/help/**` (both languages)
- **Engineering reference** — `docs/*.md` not covered elsewhere, `docs/api/**`,
  `docs/security/**`, `docs/agents/**`, `docs/brand/**`, `docs/enterprise-trust/**`
- **Compliance/readiness evidence** — `docs/production-readiness/**`,
  `docs/ai-evidence/**`, `9.3-*`, `*-audit.md`, `*-readiness*.md`, `*-ledger.md`
- **One-off artifacts** — `artifacts/*.md`, `artifacts/*.json`, dated subfolders
  (`artifacts/feature-map-*`, `artifacts/autopilot-vision-*`)
- **Prompt library** — `artifacts/audit-prompts/**` (read-only for this pass,
  see §0)
- **Root-level orphans** — anything at repo root not in the list above (e.g.
  `HANDOFF-*.md`, `RICH_TEXT_IMPLEMENTATION.md`) — flag on sight; a
  feature-handoff note or a single-change implementation note does not usually
  belong at repo root next to README.md
- **Package/app docs** — any README under `apps/*` or `packages/*`; also flag
  any package that has NO README

Verdict options: `Keep as-is` / `Fix-in-place` (mechanical only) /
`Merge-candidate` / `Relocate` / `Archive-candidate` / `Needs-human-decision`.

## §2 KNOWN PROBLEM PATTERNS TO CHECK
(this repo's specific risk areas — verify, don't assume any of these is
actually a problem)

1. **Pilot-readiness sprawl.** `docs/pilot-readiness-audit.md`,
   `docs/pilot-readiness-plan.md`, `docs/clinic-pilot-readiness.md`,
   `docs/clinic-pilot-operations.md`, `docs/clinic-pilot-workflow.md`,
   `docs/controlled-pilot-readiness-report.md` all sound like they could be
   five different snapshots of the same evolving topic. Read all of them, map
   what's unique to each, and either confirm they're genuinely distinct
   (readiness vs. operations vs. workflow are different things) or propose a
   consolidation with a clear index.
2. **Audit/ledger sprawl.** `docs/9.3-correctness-closure-audit.md`,
   `docs/9.3-security-and-pilot-readiness-report.md`,
   `docs/authorization-enforcement-audit.md`, `docs/ai-audit-cutover.md`,
   `docs/ai-audit-ledger.md` — check whether each is a living reference or a
   dated snapshot that should carry a date/status header ("as of commit X —
   superseded by Y") so a reader doesn't mistake a point-in-time audit for
   current state.
3. **`artifacts/` growth without an index.** New dated reports keep landing in
   `artifacts/` (`bug-hunt-2026-09-14.md`, `ux-codebase-analysis-2026-09-11.md`,
   `feature-map-2026-09-12/`, `autopilot-vision-2026-09-12/`,
   `dr-drill-report.json`, `production-readiness-report.json`). There's no
   index explaining what's current vs. historical. Propose (draft the content;
   don't assume permission to finalize) an `artifacts/README.md` listing each
   artifact, its date, and one line on whether it's still the latest word on
   its topic.
4. **Root-level clutter.** `HANDOFF-voice-dictation.md` and
   `RICH_TEXT_IMPLEMENTATION.md` sit at repo root. Check whether they're stale
   (feature since shipped/superseded — fold into `docs/` or delete) or still an
   active handoff (leave, but note it in the report).
5. **Naming drift.** The product is "OpenVPM AI" in docs but the npm scope is
   `@openpims/*` and demo accounts use `neighborhoodvet.example.com`. Not a bug
   to fix, but check no doc actively confuses a reader by mixing these without
   explanation.
6. **Bilingual doc parity.** Confirm `docs/help/en/*` and `docs/help/sk/*` have
   the same file set (README.md's own TOC lists 9 topics per language — verify
   both directories actually have all 9, and that sections roughly correspond,
   not just that filenames match).
7. **Package doc coverage.** `packages/api`, `packages/config`, `packages/db`,
   `packages/email`, `apps/docs`, `apps/web` — does each have a README stating
   its purpose? (`apps/docs` was noted elsewhere as an empty workspace stub —
   confirm that's still true.)
8. **Link rot.** Every relative Markdown link and every path cited in a fenced
   code block comment, across the whole corpus — does the target file/anchor
   exist?
9. **CHANGELOG hygiene.** Does `CHANGELOG.md` follow a consistent format, and
   does it have gaps versus what ROADMAP.md/git history say has shipped?
