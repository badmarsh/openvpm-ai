# IA Consolidation Audit — Run Notes

**Commit hash:** `65e008d` [VERIFIED: git rev-parse --short HEAD, 2026-09-14]
**Audit date:** 2026-09-14
**Auditor:** Antigravity (orchestrator, sequential — no parallel subagents per user instruction)
**Prior art read:** yes — see §Prior Art Citations below

---

## Prior Art Citations & Diff from Previous Findings

| Prior Document | Key Finding Cited | This Audit's Status |
|---|---|---|
| `artifacts/ux-codebase-analysis-2026-09-11.md` F4 | 25 unclustered dashboard dirs, cognitive overload | **Re-verified**: 25 subdirs confirmed at commit `65e008d`. sidebar.tsx already has 5 named sections — clustering structure now exists but is overcrowded with custom items. |
| `artifacts/feature-map-2026-09-12/REORGANIZATION-FINDINGS.md` §1 | Flat sidebar / navigation clustering | **Extended**: this audit goes deeper — per-module merge/nest/relocate, not just grouping proposal |
| REORGANIZATION-FINDINGS.md §2 | Wellness domain collision | **Confirmed + extended**: `/marketing/wellness` relabeled to "Čerpanie benefitov" in current code; nav.ts L164. Still misplaced in Marketing section. |
| REORGANIZATION-FINDINGS.md §4 | Orphaned `recalls` route | **Status changed**: `recalls` IS now in sidebar.tsx (line 130–135, section "clinical", label "Pripomienky"). No longer orphaned. |
| REORGANIZATION-FINDINGS.md §7 | 12/19 i18n keys missing | **Partially remediated**: `nav.wellnessRedemptions`, `nav.marketingContentQueue`, `nav.marketingMedia`, `nav.marketingSuppression` appear to have been added. Still missing: `nav.marketingPlan`, `nav.marketingHandouts`, `nav.marketingMessages`, `nav.marketingWebsite`, `nav.waitingRoomTv`, `nav.marketingAutomations`, `nav.marketingConsents`, `nav.remoteSupport`, `nav.adminSupport`. |
| REORGANIZATION-FINDINGS.md §10 | visit-treatment-plans vs treatment-plans naming | **Confirmed fixed**: `_app.ts:78` shows `treatmentEstimatesRouter` rename in place. |

---

## Cluster Grouping Decisions

The 7-cluster split from the prompt is retained as-is. One adjustment:
- **`/marketing/competitors`** (directory exists, not in custom-nav.ts) — treated as orphaned and assigned to Marketing cluster for coverage.
- **`/marketing/scripts`** (directory exists, not in custom-nav.ts) — assigned to Marketing cluster; also evaluated as Settings candidate.
- **`/lab-results`** (vanilla section, `nav.labResults`) — assigned to Clinical/Records cluster.
- **Čerpanie benefitov / `/marketing/wellness`** — covered in both Marketing and Settings sweep clusters (cross-cluster).

---

## Key Structural Observation (Pre-Cluster)

sidebar.tsx now defines **5 named collapsible sections** (Clinical & Pacienti, Recepcia & Tok, Lekáreň & Sklad, Účtovníctvo & Predpisy, Správa & Manažment). custom-nav.ts assigns each custom item to one of these sections. The structural grouping is better than at commit `23f23a3` — but the **Admin section** now contains:
- Platform Admin, Nastavenia, Agent (vanilla) PLUS
- All 14 Marketing sub-items, Voice, Discharge, Vet Intel, Remote Support, Admin Support, Pilot Reconciliation (custom)

This makes "Správa & Manažment" a catch-all with 18+ items — the real clustering problem is section over-assignment, not flat sidebar.

---

## Files Produced

| File | Status |
|---|---|
| `RUN-NOTES.md` | ✅ This file |
| `NAV-INVENTORY.md` | ✅ |
| `clusters/clinical-records.md` | ✅ |
| `clusters/ai-agent.md` | ✅ |
| `clusters/marketing-web-media.md` | ✅ |
| `clusters/support-admin-pilot.md` | ✅ |
| `clusters/front-desk-ops.md` | ✅ |
| `clusters/finance-compliance.md` | ✅ |
| `clusters/settings-setup-sweep.md` | ✅ |
| `INTEGRATION-OPPORTUNITIES.md` | ✅ |
| `MERGE-CANDIDATES.md` | ✅ |
| `NAV-RESTRUCTURE-PROPOSAL.md` | ✅ |
| `SCOPE-CLARIFICATIONS.md` | ✅ |
