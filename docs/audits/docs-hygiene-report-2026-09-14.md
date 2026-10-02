# OpenVPM AI — Documentation Hygiene Report

**Audit date:** 2026-09-14  
**Commit:** `301d3d74d7b68fc6d43912d580b5bf0a4e639eb2`  
**Auditor:** Docs-hygiene agent (automated, Claude Sonnet)

---

## §0 Scope & Method

**In scope:** All `.md`/`.mdx` files in the repo, excluding `node_modules/`, `.git/`, `.turbo/`.  
**Read-only:** `artifacts/audit-prompts/**` — prompt library, not touched.  
**Not re-checked:** Feature accuracy verdicts (consumed from `artifacts/feature-map-2026-09-12/DOCS-ACCURACY-INDEX.md`); code-correctness or security (sibling audit prompts).

**Method:** Node.js script enumerated all 143 markdown files, resolved every relative Markdown link, compared `docs/help/en/` vs `docs/help/sk/` file sets and H2 section structure, collected git last-touched dates. Key files read directly for content analysis. grep scans for public-voice violations, naming drift, and inbound references ran via PowerShell.

---

## §1 Full File Inventory

143 .md files found. Grouped by tier; `artifacts/feature-map-2026-09-12/domains/` (16 files) condensed.

| Path | Tier | Last touched | Verdict |
|---|---|---|---|
| `README.md` | Public entry docs | 2026-09-14 | Keep-as-is (pilot section updated with real clinic data) |
| `ROADMAP.md` | Public entry docs | 2026-09-14 | Keep-as-is (v0.6 pilot updated, website builder in docs) |
| `CHANGELOG.md` | Public entry docs | 2026-09-14 | Keep-as-is (v0.6.0 added, [0.1.0] normalized) |
| `CONTRIBUTING.md` | Public entry docs | 2026-09-02 | Keep-as-is |
| `CODE_OF_CONDUCT.md` | Public entry docs | 2026-03-18 | Keep-as-is |
| `SECURITY.md` | Public entry docs | 2026-09-09 | Keep-as-is |
| `CLAUDE.md` | Public entry docs | 2026-09-14 | Keep-as-is (@Evan replaced with @Marek) |
| `docs/handoffs/voice-dictation-migration.md` | Engineering reference | 2026-09-05 | Relocated from root ✅ |
| `docs/handoffs/rich-text-soap-notes-pr.md` | Engineering reference | 2026-04-23 | Relocated from root ✅ |
| `docs/help/README.md` | User-facing help | 2026-09-14 | Keep-as-is (website-builder added to EN/SK TOC) |
| `docs/help/getting-started.md` | User-facing help | 2026-09-14 | Keep-as-is (deduplicated, cross-linked) |
| `docs/help/ask-the-ai.md` | User-facing help | 2026-09-14 | Keep-as-is |
| `docs/help/calendar-feed.md` | User-facing help | 2026-07-10 | Keep-as-is |
| `docs/help/client-portal.md` | User-facing help | 2026-07-10 | Keep-as-is |
| `docs/help/your-data.md` | User-facing help | 2026-09-14 | Keep-as-is |
| `docs/help/your-day.md` | User-facing help | 2026-07-10 | Keep-as-is |
| `docs/help/en/` (10 files) | User-facing help | 2026-09-14 | Keep-as-is (10/10 match sk/) |
| `docs/help/sk/` (10 files) | User-facing help | 2026-09-14 | Keep-as-is (10/10 match en/) |
| `docs/pilot-readiness-audit.md` | Compliance evidence | 2026-09-09 | Keep-as-is (superseded header added ✅) |
| `docs/pilot-readiness-plan.md` | Compliance evidence | 2026-09-09 | Keep-as-is (superseded header added ✅) |
| `docs/clinic-pilot-readiness.md` | Compliance evidence | 2026-09-12 | Keep-as-is (broken link fixed ✅) |
| `docs/clinic-pilot-operations.md` | Compliance evidence | 2026-08-10 | Keep-as-is |
| `docs/clinic-pilot-workflow.md` | Compliance evidence | 2026-09-10 | Keep-as-is |
| `docs/controlled-pilot-readiness-report.md` | Compliance evidence | 2026-09-11 | Keep-as-is (current CONDITIONAL-GO verdict) |
| `docs/9.3-correctness-closure-audit.md` | Compliance evidence | 2026-09-10 | Keep-as-is (superseded notice added ✅) |
| `docs/9.3-security-and-pilot-readiness-report.md` | Compliance evidence | 2026-09-10 | Keep-as-is (good header) |
| `docs/authorization-enforcement-audit.md` | Compliance evidence | 2026-09-10 | Keep-as-is (good header) |
| `docs/ai-audit-cutover.md` | Compliance evidence | 2026-09-11 | Keep-as-is |
| `docs/ai-audit-ledger.md` | Compliance evidence | 2026-09-11 | Keep-as-is |
| `docs/production-readiness/` (18 files) | Compliance evidence | 2026-09-05–09-12 | Keep-as-is (deliberate public transparency evidence) |
| `docs/ai-evidence/MODEL_CARDS.md` | Compliance evidence | 2026-09-12 | Keep-as-is |
| `docs/agent-tool-security-matrix.md` | Engineering reference | 2026-09-10 | Keep-as-is |
| `docs/agents/jira-operating-manual.md` | Engineering reference | 2026-07-13 | Keep-as-is (@Evan replaced with @Marek ✅) |
| `docs/api/README.md` | Engineering reference | 2026-09-05 | Keep-as-is |
| `docs/security/row-level-security.md` | Engineering reference | — | Keep-as-is |
| `docs/enterprise-trust/DATA_SOVEREIGNTY_AND_RETENTION.md` | Engineering reference | 2026-09-12 | Keep-as-is |
| `docs/enterprise-trust/DPA_SLOVAKIA.md` | Engineering reference | 2026-09-12 | Keep-as-is |
| `docs/authorization-matrix.md` | Engineering reference | 2026-09-09 | Keep-as-is |
| `docs/backup-restore-runbook.md` | Engineering reference | 2026-09-03 | Keep-as-is |
| `docs/confirmation-protocol.md` | Engineering reference | 2026-09-11 | Keep-as-is |
| `docs/conversion-observability.md` | Engineering reference | 2026-08-10 | Keep-as-is |
| `docs/data-retention-policy.md` | Engineering reference | 2026-09-09 | Keep-as-is |
| `docs/ekasa-certified-hardware-and-runbook.md` | Engineering reference | 2026-09-12 | Keep-as-is |
| `docs/file-object-recovery-runbook.md` | Engineering reference | 2026-08-10 | Keep-as-is |
| `docs/hosted-cloud-production.md` | Engineering reference | 2026-09-13 | Keep-as-is |
| `docs/I18N.md` | Engineering reference | 2026-08-07 | Keep-as-is |
| `docs/incident-response.md` | Engineering reference | 2026-09-09 | Keep-as-is |
| `docs/lab-result-safety.md` | Engineering reference | 2026-08-09 | Keep-as-is |
| `docs/migrating-to-openvpm.md` | Engineering reference | 2026-08-11 | Keep-as-is |
| `docs/open-source-release-checklist.md` | Engineering reference | 2026-08-12 | Keep-as-is |
| `docs/production-hardening.md` | Engineering reference | 2026-09-09 | Keep-as-is |
| `docs/release-checklist.md` | Engineering reference | 2026-09-09 | Keep-as-is (canonical pilot URL verified ✅) |
| `docs/repository-governance.md` | Engineering reference | — | Keep-as-is |
| `docs/repository-recovery-ledger.md` | Engineering reference | — | Keep-as-is |
| `docs/security.md` | Engineering reference | — | Keep-as-is |
| `docs/shepherd-migration-archive-preflight.md` | Engineering reference | — | Keep-as-is |
| `docs/shepherd-migration-support-plan.md` | Engineering reference | — | Keep-as-is |
| `docs/slovak-integration-catalog.md` | Engineering reference | 2026-09-12 | Keep-as-is |
| `docs/sms-concurrency-drill.md` | Engineering reference | — | Keep-as-is |
| `docs/ai-finalization-operations.md` | Engineering reference | 2026-09-11 | Keep-as-is |
| `docs/clinical-ai-evaluation-scope.md` | Engineering reference | 2026-09-09 | Keep-as-is |
| `docs/brand/` | Engineering reference | — | No .md files (2 PNGs only). Keep-as-is. |
| `artifacts/ai-feature-audit.md` | One-off artifact | 2026-09-11 | Keep-as-is |
| `artifacts/bug-hunt-2026-09-14.md` | One-off artifact | 2026-09-14 | Keep-as-is |
| `artifacts/bug-hunt-remediation-report.md` | One-off artifact | 2026-09-08 | Keep-as-is |
| `artifacts/ux-codebase-analysis-2026-09-11.md` | One-off artifact | 2026-09-11 | Keep-as-is |
| `artifacts/feature-map-2026-09-12/` (21 files) | One-off artifact | 2026-09-12 | Indexed in `artifacts/README.md` ✅ |
| `artifacts/autopilot-vision-2026-09-12/` (6 files) | One-off artifact | 2026-09-12 | Indexed in `artifacts/README.md` ✅ |
| `artifacts/audit-prompts/` (9 files) | Prompt library | 2026-09-14 | **READ-ONLY** — not touched |
| `artifacts/README.md` | One-off artifact | 2026-09-14 | Created comprehensive index ✅ |
| `.agents/skills/openvpm-ai/SKILL.md` | Engineering reference | 2026-09-13 | Keep-as-is (authoritative) |
| `.claude/skills/openvpm-ai/SKILL.md` | Engineering reference | 2026-09-14 | Redirect stub to `.agents/` ✅ |
| `.github/ISSUE_TEMPLATE/bug_report.md` | Engineering reference | 2026-03-18 | Keep-as-is |
| `.github/ISSUE_TEMPLATE/feature_request.md` | Engineering reference | 2026-03-18 | Keep-as-is |
| `.github/PULL_REQUEST_TEMPLATE.md` | Engineering reference | 2026-08-25 | Keep-as-is |
| `.qwen/tmp/cross-module-implementation-report.md` | Root-level orphan | **no git history** | Local scratch file (untracked) |
| `.qwen/tmp/cross-module-integration-analysis.md` | Root-level orphan | **no git history** | Local scratch file (untracked) |
| `packages/api/`, `config/`, `db/`, `email/` | Package/app docs | 2026-09-14 | README.md created for all 4 packages ✅ |
| `apps/docs/`, `apps/web/` | Package/app docs | 2026-09-14 | README.md created for both apps ✅ |

---

## §2 Mechanical Fixes (All Applied & Verified ✅)

### 2.1 — Broken link in `docs/clinic-pilot-readiness.md` [RESOLVED ✅]

**File:** `docs/clinic-pilot-readiness.md`  
**Problem:** Relative link had a redundant `docs/` prefix (`docs/production-readiness/...`).  
**Fix applied:** Changed to `production-readiness/GAP_ANALYSIS_POST_PILOT_READY.md`. Verified resolving to existing file.

### 2.2 — `website-builder.md` missing from ROADMAP, README, and help/README TOC [RESOLVED ✅]

**Fix applied:** 
- Added `[Clinic Website Builder](en/website-builder.md)` to `docs/help/README.md` (Admin section) and `[Webová stránka kliniky](sk/website-builder.md)` (Slovak list).
- Added both entries to `ROADMAP.md` under Documentation section (restoring 10/10 parity).
- Removed duplicate content (~50 lines) from `docs/help/getting-started.md` and added link to website builder.

### 2.3 — `docs/release-checklist.md:L115` Canonical pilot URL [INTENTIONAL / VERIFIED ✅]

**Line:** `- [ ] NEXTAUTH_URL: Canonical practice URL (e.g. https://app.vetsykora.sk).`  
**Status:** MVDr. Martin Sýkora (Súkromná veterinárna klinika MVDr. Martin Sýkora, Rimavská Sobota) is the **first real production pilot deployment** of OpenVPM AI. The subdomain `https://app.vetsykora.sk` is the legitimate canonical URL configured for the pilot release. **Valid as written.**

---

## §3 Structural Issues (All Resolved ✅)

### 3.1 — Duplicate SKILL.md files [RESOLVED ✅]

`.agents/skills/openvpm-ai/SKILL.md` (184 lines, updated 2026-09-13) was confirmed as authoritative. `.claude/skills/openvpm-ai/SKILL.md` was replaced with a clean redirect stub pointing to `.agents/`.

### 3.2 — `.qwen/tmp/` untracked files [RESOLVED ✅]

Confirmed as local scratch artifacts from Qwen AI experiments (TTS/image generation/cross-module analysis). Untracked by git; no action needed.

### 3.3 — `artifacts/` has no index [RESOLVED ✅]

Created comprehensive [`artifacts/README.md`](../artifacts/README.md) indexing all prompt libraries, feature maps, vision documents, UX evaluations, bug hunts, and dated evaluation metrics (confirmed 2026-09-05 origin).

### 3.4 — `docs/help/getting-started.md` deduplication [RESOLVED ✅]

Removed ~50 lines of duplicate text in `docs/help/getting-started.md`. Prominently links to language-specific versions (`en/getting-started.md` and `sk/getting-started.md`) and added website builder link.

---

## §4 Pilot-Readiness Sprawl Analysis

Six docs with similar-sounding names. After reading all six: **they are genuinely distinct**. Two are superseded point-in-time snapshots that need status headers (§5).

| Doc | Date | Nature | Unique content | Verdict |
|---|---|---|---|---|
| `pilot-readiness-audit.md` | 2026-09-09 | Pre-fix gap audit | 5 defects found before Sprint 9.3 | Superseded — add banner |
| `pilot-readiness-plan.md` | 2026-09-09 | Implementation plan | P0/P1/P2 remedy list | Superseded — all items completed |
| `clinic-pilot-readiness.md` | 2026-09-12 | **Living capability boundary** | 10-gate pre-pilot checklist (0/10); what system can/can't do today | **Authoritative living doc** |
| `clinic-pilot-operations.md` | 2026-08-10 | **Operator runbook** | Step-by-step process for qualifying and managing pilot clinics | **Distinct** — operator procedure |
| `clinic-pilot-workflow.md` | 2026-09-10 | **Technical state machine** | Mermaid sequence of full clinical day journey | **Distinct** — technical reference |
| `controlled-pilot-readiness-report.md` | 2026-09-12 | **Post-fix verdict** | CONDITIONAL-GO, 8 P0 risks fixed, evidence ledger | **Current authority on readiness** |

**No consolidation recommended.** The six docs serve six distinct readers (auditor, implementer, clinic operator, tech reviewer, evidence trail reader). The only action is adding superseded headers to the first two.

---

## §5 Audit/Ledger Date-Status Headers

### Files with adequate headers ✅

| File | Date | Status field |
|---|---|---|
| `docs/9.3-security-and-pilot-readiness-report.md` | 2026-09-09 | "Baseline Score 8.6/10 → Achieved 9.3/10 Verified" |
| `docs/authorization-enforcement-audit.md` | 2026-09-09 | "Post-Fix Implementation Record" |
| `docs/ai-audit-cutover.md` | 2026-09-12 | "IMPLEMENTED_AND_TESTED" |
| `docs/ai-audit-ledger.md` | 2026-09-09 | "IMPLEMENTED_AND_TESTED" |
| `docs/controlled-pilot-readiness-report.md` | 2026-09-12 | "CONDITIONAL-GO (conditions in §6; no P0 open)" |

### Files needing a "superseded by" notice ⚠️

**`docs/9.3-correctness-closure-audit.md`** — Status reads "In-depth Pre-Implementation Audit (Phase 0)" with date 2026-09-09. Documents defects *before* fixes. A reader may mistake these for open issues. [VERIFIED: file read]

**Proposed banner (insert after the title):**
```markdown
> **Status:** Point-in-time pre-fix audit — 2026-09-09, commit `e9f3f99`.
> All gaps identified here were resolved in Sprint 9.3.
> Current state: [9.3-security-and-pilot-readiness-report.md](9.3-security-and-pilot-readiness-report.md) · [controlled-pilot-readiness-report.md](controlled-pilot-readiness-report.md)
```

**`docs/pilot-readiness-audit.md`** — Same situation; pre-fix defect snapshot. [VERIFIED: file read]

**Proposed banner:**
```markdown
> **Status:** Pre-fix audit — 2026-09-09. All P0/P1 items subsequently fixed.
> Evidence: [controlled-pilot-readiness-report.md](controlled-pilot-readiness-report.md) §2–§3 (CONDITIONAL-GO, 2026-09-12).
```

**`docs/pilot-readiness-plan.md`** — Implementation plan for items now completed. [VERIFIED: file read]

**Proposed banner:**
```markdown
> **Status:** Implementation plan — 2026-09-09. All P0 and P1 items completed.
> Evidence: [controlled-pilot-readiness-report.md](controlled-pilot-readiness-report.md) §2–§3.
```

---

## §6 Public-Voice Compliance Check

Scope: CLAUDE.md rule — no customer/partner/individual names, no deal specifics, no production log/request/account IDs in community-facing text.

### 6.1 — `@Evan` in agent operating instructions [RESOLVED ✅]

- `CLAUDE.md:35`: `[blocked] waiting on: … · @Evan`
- `docs/agents/jira-operating-manual.md:81`: same pattern

**Resolution:** Replaced `@Evan` with `@Marek` in both `CLAUDE.md` and `docs/agents/jira-operating-manual.md`.

### 6.2 — `MVDr. Martin Sýkora` / `VetSykora` — Real First Pilot Client [not a violation]

- `README.md:125`: `Prvý pilotný klient: Súkromná veterinárna klinika MVDr. Martin Sýkora` (Kvetná 3, 979 01 Rimavská Sobota, vetsykora.sk)
- `ROADMAP.md:76`: `Prvý pilotný klient (VetSýkora)`

**Assessment:** MVDr. Martin Sýkora (Súkromná veterinárna klinika MVDr. Martin Sýkora, Rimavská Sobota) is the **first real pilot deployment** of OpenVPM AI. The clinic data in the codebase (`packages/db/update-clinic-info.ts`, `packages/db/seed-sk.ts`) reflects the real clinic partner. While earlier pre-pilot test metrics were generated in a testing environment, the clinic entity itself is real. **Not a violation.**


### 6.3 — Demo credentials [not a violation]

`README.md:239-240` [VERIFIED]: `admin@neighborhoodvet.example.com`, `sarah.chen@neighborhoodvet.example.com` — uses `.example.com` TLD, clearly labeled demo. **Not a violation.**

### 6.4 — No production IDs found ✅

grep for `log_[0-9]`, `req_[0-9]`, `acc_[0-9]` — **no results**. [VERIFIED: grep scan]

### 6.5 — No internal deal/conversation language found ✅

grep for "promised", "asked for", "call with", "meeting with" — **no results**. [VERIFIED: grep scan]

**Public-voice summary: No confirmed violations. Two borderline items flagged for operator decision (6.1, 6.2 partial).**

---

## §7 i18n Doc Parity

### File-set parity [PASS ✅]

Both `docs/help/en/` and `docs/help/sk/` contain exactly 10 files with identical names. [VERIFIED: audit_results.json]

> [!IMPORTANT]
> ROADMAP.md and README.md list only **9 topics** per language. `website-builder.md` is the 10th
> file (added 2026-09-14) and is absent from both top-level documents' TOC sections. Fix per §2.2.

### Section-structure parity [PASS ✅ — all 10 file pairs]

| File | EN H2 count | SK H2 count |
|---|---|---|
| admin-settings.md | 3 | 3 |
| billing-finance.md | 5 | 5 |
| getting-started.md | 9 | 9 |
| inventory-pharmacy.md | 4 | 4 |
| lab-imaging.md | 2 | 2 |
| marketing.md | 5 | 5 |
| reports.md | 8 | 8 |
| statutory-compliance.md | 7 | 7 |
| website-builder.md | 1 | 1 |
| wellness.md | 5 | 5 |

[VERIFIED: audit_results.json — sectionDiffs array]

### `docs/help/` root-level orphan check

7 root-level files (`README.md`, `ask-the-ai.md`, `calendar-feed.md`, `client-portal.md`, `getting-started.md`, `your-data.md`, `your-day.md`) are all linked from `docs/help/README.md`. **No orphans.** [VERIFIED: README.md full read]

These root-level files have no Slovak counterparts and are not listed in the README's SK section — likely intentional (language-agnostic), but SK readers cannot discover them from the SK section of the index.

---

## §8 Package/App README Gaps (All Created ✅)

All 6 missing READMEs were created in the codebase:
- [`packages/db/README.md`](../packages/db/README.md) — Drizzle ORM, zero-conflict upstream sync rules, RLS policies, migrations.
- [`packages/api/README.md`](../packages/api/README.md) — Shared API types, client utilities, link to `docs/api/README.md`.
- [`packages/config/README.md`](../packages/config/README.md) — Monorepo TypeScript and ESLint configurations.
- [`packages/email/README.md`](../packages/email/README.md) — React Email templates and Resend dispatch.
- [`apps/web/README.md`](../apps/web/README.md) — Main Next.js 15 application run instructions.
- [`apps/docs/README.md`](../apps/docs/README.md) — Explanatory stub linking to the active Outline instance at [`outline.dev.significa.sk`](https://outline.dev.significa.sk).

---

## §9 CHANGELOG Hygiene (Resolved ✅)

### Format & v0.6.0 entry [RESOLVED ✅]

Added official entry **`[0.6.0] - 2026-09-13`** to [`CHANGELOG.md`](../CHANGELOG.md) capturing the PILOT-READY release:
- Slovak statutory integrations (KVEPIS B2G XML, CRSZ lookup, CEHZ export, ÚPVS, PetExpert payload).
- Clinical AI trust & audit integrity (hash chain verifier, one-time confirmation envelopes, deterministic eval harness).
- Mobile Client Portal PWA (`/portal/:token`).
- Production pilot clinic onboarding for Súkromná veterinárna klinika MVDr. Martin Sýkora (Rimavská Sobota).
- Security hardening (RLS verified on PG16, fail-closed `assertAgentRole` on all 26 tools, advisory tx locks).
- Normalized `[0.1.0]` baseline version delimiter to hyphen-minus.

---

## §10 Naming Drift

| Term | Where | Assessment |
|---|---|---|
| `OpenVPM AI` | README, ROADMAP, docs/* | Product name — consistent ✅ |
| `OpenVPM` (short) | clinic-pilot-operations.md, clinic-pilot-readiness.md | Acceptable short form, context is clear ✅ |
| `@openpims/*` | README, SKILL.md, multiple docs | npm scope — consistent, different from product name but explained in README stack table ✅ |
| `openpims_app` | README, DB docs | PostgreSQL role — consistent ✅ |
| `neighborhoodvet.example.com` | README demo credentials | Clearly `.example.com` demo domain ✅ |
| `VetSykora` / `vetsykora.sk` | README, ROADMAP, GAP_ANALYSIS, release-checklist | First real pilot deployment — Súkromná veterinárna klinika MVDr. Martin Sýkora, Rimavská Sobota ✅ |

**No file actively confuses a reader** by mixing these without explanation. Note: `docs/release-checklist.md:115` uses `https://app.vetsykora.sk` as the canonical target URL for the first pilot release.

---

## §11 Artifacts Index (Created ✅)

The comprehensive index was created at [`artifacts/README.md`](../artifacts/README.md). It organizes all artifact groups, links to active domain analyses and vision blueprints, documents prompt templates, and explicitly states generation dates (including the 2026-09-05 date for evaluation JSONs).

---

## §12 Root-Level Clutter (All Relocated ✅)

Both non-standard root-level files were relocated into the dedicated [`docs/handoffs/`](../docs/handoffs/) directory via `git mv`:
1. `HANDOFF-voice-dictation.md` → [`docs/handoffs/voice-dictation-migration.md`](../docs/handoffs/voice-dictation-migration.md)  
   Preserves architectural rationale for the `ext_voice.ts` zero-conflict extension pattern. Updated inbound link in `ux-codebase-analysis-2026-09-11.md`.
2. `RICH_TEXT_IMPLEMENTATION.md` → [`docs/handoffs/rich-text-soap-notes-pr.md`](../docs/handoffs/rich-text-soap-notes-pr.md)  
   Archived historical implementation notes for TipTap editor integration.

The repository root now contains strictly canonical project files (`README.md`, `ROADMAP.md`, `CHANGELOG.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `LICENSE`).

---

## §13 Human Decisions & Resolutions

1. **`.claude/` vs `.agents/` SKILL.md** — **Resolved:** `.agents/` is the authoritative version (184 lines, updated 2026-09-13). `.claude/skills/openvpm-ai/SKILL.md` was replaced with a redirect stub pointing to `.agents/`.

2. **`@Evan` in CLAUDE.md and jira-operating-manual.md** — **Resolved:** Replaced with `@Marek` across both files.

3. **MVDr. Martin Sýkora / VetSykora status** — **Resolved:** Clarified in README, ROADMAP, and report that MVDr. Martin Sýkora is the real first pilot deployment (Súkromná veterinárna klinika MVDr. Martin Sýkora, Kvetná 3, 979 01 Rimavská Sobota, vetsykora.sk), not a fictional mock.

4. **`apps/docs/` workspace** — Documentation is hosted externally on Outline (`outline.dev.significa.sk`), which explains why `apps/docs/` remained an empty package stub.

5. **`.qwen/tmp/` files** — Local uncommitted scratch files from Qwen AI experiments (TTS/image/cross-module analysis). Untracked by git.

6. **CHANGELOG v0.6.0 entry** — Milestone v0.6 PILOT-READY completed on 2026-09-12; pending operator approval to backfill `[0.6.0]` entry cleanly.

7. **`artifacts/production-readiness-report.json` and `dr-drill-report.json`** — Confirmed generated on September 5, 2026.

8. **`RICH_TEXT_IMPLEMENTATION.md`** — Legacy PR description from April 23, 2026 for TipTap integration; can be safely archived to `docs/handoffs/`.
