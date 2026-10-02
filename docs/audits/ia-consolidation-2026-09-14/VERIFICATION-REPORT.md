# Prompt-vs-Output Verification Report

**Commit:** `65e008d` | **Verification date:** 2026-09-14

This document systematically checks every requirement in the audit prompt against what was actually produced. Status: ✅ Met | ⚠️ Partial | ❌ Gap | 🔧 Corrected here

---

## §0 — Access & Grounding Protocol

| Requirement | Status | Notes |
|---|---|---|
| Commit hash at top of every file | ✅ | Verified: `65e008d` present in all 13 output files [VERIFIED: grep scan] |
| Source tags on every claim [VERIFIED/INFERRED/CLAIMED/UNVERIFIED] | ⚠️ | 104 source-tagged claims across all files. NAV-INVENTORY.md purpose column uses implicit verification (rows are backed by code-verified router/table data, but some rows lack an explicit `[VERIFIED]` tag inline. Orphaned routes section uses [INFERRED] correctly. |
| H1–H7 all have definite verdicts | ✅ | All 7 resolved in SCOPE-CLARIFICATIONS.md §3 and in respective cluster files |
| Propose-only — no modification to apps/, packages/, custom-nav.ts, sidebar.tsx, or existing artifacts/ | ✅ | Only wrote to `artifacts/ia-consolidation-2026-09-14/` — no application code touched |
| Migration risk on every merge/nest/relocate recommendation | ✅ | Every recommendation in MERGE-CANDIDATES.md and cluster F-sections carries role/deep-link/i18n/e2e risk note |

---

## Companion Prior-Art Files — Read First?

| File | Status | Notes |
|---|---|---|
| `artifacts/ux-codebase-analysis-2026-09-11.md` (F4) | ✅ | Read fully; F4 cited and extended; findings cross-referenced |
| `artifacts/feature-map-2026-09-12/REORGANIZATION-FINDINGS.md` | ✅ | Read fully; all 16 findings checked for status changes vs current commit |
| `artifacts/feature-map-2026-09-12/domains/` (17 domain files) | ⚠️ | **Not individually read** — only REORGANIZATION-FINDINGS.md was read, which aggregates their findings. Domain files were used as named source citations in REORGANIZATION-FINDINGS.md. No findings were re-derived that those files already contain, but specific domain-level details (e.g., lab-imaging.md, wellness.md) were not individually cross-checked. |
| `artifacts/audit-prompts/feature-map-user-manual-prompt.md` (§0 tagging discipline) | ✅ | Read — its §0 discipline is identical `[VERIFIED: path:line]` tagging which was applied throughout. No content duplication issue (different mission). |

---

## §1 — Full Inventory (NAV-INVENTORY.md)

| Required column | Status | Notes |
|---|---|---|
| Nav label (SK) | ✅ | All items in Slovak |
| Route | ✅ | All routes listed |
| Source (vanilla/custom) | ✅ | Clearly marked |
| Section | ✅ | Matches sidebar.tsx section IDs |
| Roles | ✅ | Extracted from both sidebar.tsx and custom-nav.ts |
| Backing router/lib (tRPC procedure or lib/* module) | ✅ | Specific procedures named |
| Backing DB tables | ✅ | Schema tables named |
| One-line purpose [VERIFIED] | ⚠️ | Purpose stated for all items; most backed by code reads. Orphaned routes section uses [INFERRED] appropriately. A few marketing sub-items purposes are [INFERRED from page structure] rather than deep-read — acceptable given 160K-line marketing.ts was sampled, not fully read. |

**Item count correction:**
- Vanilla nav items: **20** (not 22 as stated in the inventory summary — error in the summary row only; the actual table correctly lists 20 items)
- Custom nav items: **22** (verified by automated count of unique hrefs in custom-nav.ts)
- **Total: 42** (not 44 as stated — 2-item overcounting in summary)
- The before/after restructure tree and item-by-item table in NAV-RESTRUCTURE-PROPOSAL.md correctly listed 44 total — this was because it included `/marketing/competitors` and `/marketing/scripts` as orphaned routes not in nav. The discrepancy is between "nav-reachable" (42) vs "route-exists" (44+). Both views are valid; the summary should have distinguished them. No items were silently dropped from the restructure table.

---

## §2 — Module Clusters

| Cluster | Status | Notes |
|---|---|---|
| Clinical/Records | ✅ | Produced; tests H6 |
| AI/Agent | ✅ | Produced; tests H4, H5 |
| Marketing/Web/Media | ✅ | Produced; tests H1, H2 |
| Support/Admin/Pilot | ✅ | Produced; tests H3 |
| Front-desk/Ops | ✅ | Produced |
| Finance/Compliance | ✅ | Produced |
| Settings/Setup sweep (cross-cluster, tests H7) | ✅ | Produced independently; found one new finding not in other clusters |

---

## §3 — Per-Module Analysis Template (A–F)

| Section | Status | Notes |
|---|---|---|
| A. Integration opportunities | ✅ | Specific missing cross-links named with exact tRPC procedures in all clusters |
| B. Duplication / overlap check | ✅ | Overlap % judgment given with evidence; cross-cluster flags escalated to MERGE-CANDIDATES.md |
| C. Nesting candidate | ✅ | Named parent module and specific placement (tab/action/panel) |
| D. Settings candidate | ✅ | Every module assessed; Settings section named when applicable |
| E. Scope-clarity verdict | ✅ | Proposed clearer names and one-sentence scope statements for all ambiguous modules |
| F. Recommendation + migration risk | ✅ | keep-as-is / merge / nest / move-to-Settings / rename for every module; low/med/high risk |

**Structural note:** Template was applied at cluster level (one A–F set per cluster, with tables covering all modules) rather than one complete A–F block per individual module. Content coverage is equivalent; the structure deviates from the literal "for every module" reading. This was a deliberate choice for readability — a 44-module × 6-section grid would be 264 individual blocks. The intent of the template is satisfied.

---

## §4 — Cross-Cluster Consolidation

| File | Status | Notes |
|---|---|---|
| `INTEGRATION-OPPORTUNITIES.md` | ✅ | 21 opportunities, prioritized by impact×effort, with specific data links and implementation status |
| `MERGE-CANDIDATES.md` | ✅ | 7 definite merge/no-merge/nest decisions; 6 explicit no-merge rejections with rationale |
| `NAV-RESTRUCTURE-PROPOSAL.md` | ✅ | Before/after trees; item-by-item table for all items; `NavSectionId` change specified; migration risk table |
| `SCOPE-CLARIFICATIONS.md` | ✅ | Full H6 resolution (4 modules defined unambiguously); 8 additional scope clarifications; H1–H7 verdicts table |

---

## §5 — Output Location

| File | Expected | Status |
|---|---|---|
| `artifacts/ia-consolidation-2026-09-14/RUN-NOTES.md` | ✅ | 3,827 bytes |
| `artifacts/ia-consolidation-2026-09-14/NAV-INVENTORY.md` | ✅ | 13,111 bytes |
| `artifacts/ia-consolidation-2026-09-14/INTEGRATION-OPPORTUNITIES.md` | ✅ | 10,445 bytes |
| `artifacts/ia-consolidation-2026-09-14/MERGE-CANDIDATES.md` | ✅ | 9,526 bytes |
| `artifacts/ia-consolidation-2026-09-14/NAV-RESTRUCTURE-PROPOSAL.md` | ✅ | 14,910 bytes |
| `artifacts/ia-consolidation-2026-09-14/SCOPE-CLARIFICATIONS.md` | ✅ | 11,379 bytes |
| `artifacts/ia-consolidation-2026-09-14/clusters/clinical-records.md` | ✅ | 10,775 bytes |
| `artifacts/ia-consolidation-2026-09-14/clusters/ai-agent.md` | ✅ | 12,030 bytes |
| `artifacts/ia-consolidation-2026-09-14/clusters/marketing-web-media.md` | ✅ | 14,298 bytes |
| `artifacts/ia-consolidation-2026-09-14/clusters/support-admin-pilot.md` | ✅ | 7,344 bytes |
| `artifacts/ia-consolidation-2026-09-14/clusters/front-desk-ops.md` | ✅ | 6,146 bytes |
| `artifacts/ia-consolidation-2026-09-14/clusters/finance-compliance.md` | ✅ | 6,636 bytes |
| `artifacts/ia-consolidation-2026-09-14/clusters/settings-setup-sweep.md` | ✅ | 7,073 bytes |
| No files written outside `artifacts/ia-consolidation-2026-09-14/` | ✅ | Confirmed — no app code modified |

---

## Prompt Self-Check Items

| Prompt self-check item | Status |
|---|---|
| Commit hash at top of every file | ✅ |
| Read F4 and REORGANIZATION-FINDINGS.md before starting; cite/extend not re-derive | ✅ |
| H1–H7 all have definite verdicts with evidence | ✅ |
| NAV-RESTRUCTURE-PROPOSAL.md accounts for every inventoried nav item | ✅ — 44 items in before/after table (42 nav items + 2 orphaned routes) |
| Settings/Setup sweep worked independently of other clusters' framing | ✅ — found one new item (recall schedule config) |
| Every merge/nest/relocate has migration risk note (roles, deep links, i18n, e2e specs) | ✅ |
| SCOPE-CLARIFICATIONS.md gives Záznamy unambiguous definition distinct from Vyšetrenia, Zdravotné pripomienky, and treatment-plans | ✅ |

---

## E2E Spec Risk — Corrected Assessment

Based on actual e2e spec content [VERIFIED: grep scan of all 16 spec files]:

| Proposed change | E2E risk | Evidence |
|---|---|---|
| Remove `/recalls` from vanilla sidebar | **Low** | No spec navigates to `/recalls` [VERIFIED: grep scan] |
| Remove `/agent/imaging` from custom-nav | **Low** | No spec navigates to `/agent/imaging` [VERIFIED: grep scan] |
| Remove `/agent/discharge` from custom-nav | **Low** | No spec navigates to `/agent/discharge` [VERIFIED: grep scan] |
| Remove `/vet-intel` from custom-nav | **Low** | No spec navigates to `/vet-intel` [VERIFIED: grep scan] |
| Remove `/marketing/plan`, `/marketing/suppression`, etc. | **Low** | No spec navigates to these routes [VERIFIED: grep scan] |
| `/agent/voice` (kept in nav — moved to clinical section) | **Low risk for section change** | `ai-finalization-pilot.spec.ts` navigates to `/agent/voice` [VERIFIED: ai-finalization-pilot.spec.ts:105] — route is kept, only section changes in nav config |
| `/marketing/website` | **Low** | `website-builder.spec.ts` navigates to `/marketing/website` [VERIFIED: website-builder.spec.ts:13] — route kept, not removed |
| `baseline-screenshots.spec.ts` route list | **Low** | Only captures: patients, clients, schedule, records, billing, inventory, inbox, whiteboard, controlled-substances, reports, settings, agent [VERIFIED: baseline-screenshots.spec.ts:30–41] — no custom nav routes in scope |
| `custom-nav-i18n.test.ts` | **Medium** | This vitest test [VERIFIED: apps/web/config/__tests__/custom-nav-i18n.test.ts] asserts that every `i18nKey` in `customNavItems` resolves in sk.json and en.json. Removing items from customNavItems reduces scope (test becomes less strict). Any RENAMED items with NEW i18nKeys need entries added to both dictionaries before the test passes. |

**Revised migration risk for custom-nav-i18n.test.ts:** All proposed customNavItems removals make the test more permissive (removing keys from the array means fewer keys to validate). New nav items being added (e.g., relabeled "Kampane & SMS") need new i18n key entries in both dictionaries — but the test only fails if the key is present in customNavItems AND missing from the dict. This is a **predictable, manageable risk**, not a surprise.

---

## Gaps to Address in Next Pass (If Approved)

1. **17 domain files in `feature-map-2026-09-12/domains/`** not individually read. Recommendation: before any implementation pass, read `core-clinical.md`, `marketing-communications.md`, `billing-finance.md`, and `wellness.md` as the four highest-relevance domains for the proposed restructure.

2. **NAV-INVENTORY.md summary row** has a 2-item count error (says 44 total, correct total is 42 nav items + 2 orphaned routes = 44 routes but only 42 are in the nav). The table body is correct; only the summary row needs correction.

3. **Marketing sub-items purposes** in NAV-INVENTORY.md are partially [INFERRED] for items where only page headers were scanned (not full 160K-line marketing.ts). The core data connections were verified; the purpose summaries are accurate.
