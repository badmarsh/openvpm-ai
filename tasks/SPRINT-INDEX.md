# Arena Sprint Index

**The table below is generated** from the YAML frontmatter of every spec in [`sprints/`](sprints/) and [`proposed/`](proposed/). Do not edit it by hand: change the spec's frontmatter, then run `node scripts/tasks/tasks.mjs index`. CI fails if it is out of date (`index --check`).

Status legend: `merged (#PR)` = delivered and merged · `OPEN · READY` = premises hold and the contract test is armed, dispatchable · `OPEN · NEEDS-CONTRACT` = still needs its contract test before anyone implements it · `OPEN · STALE` = the repo no longer matches the spec's premises, so rewrite it before dispatch · `PARTIAL` = delivered in part. **git outranks this table.** The lifecycle is in [`WORKFLOW.md`](WORKFLOW.md), and per-file history is in [`VERIFICATION-LOG.md`](VERIFICATION-LOG.md).

<!-- BEGIN GENERATED: node scripts/tasks/tasks.mjs index -->

| # | Sprint file | Title / target | Status |
|---|-------------|----------------|--------|
| 1 | arena-sprint-1-command-palette.md | Command palette ranking | merged (#42) |
| 2 | arena-sprint-2-uikit-harmonization.md | /recalls, /vaccinations, /controlled-substances | merged (#38) |
| 3 | arena-sprint-3-field-practice.md | Field visits, CEHZ, KVEPIS panel | merged (#39, #40) |
| 4 | arena-sprint-4-lab-results.md | /lab-results | merged (#41) |
| 5 | arena-sprint-5-prescriptions.md | /prescriptions | merged (#45, #68, #70) — follow-ups #68, #70 and commit fcfc18e |
| 6 | arena-sprint-6-whiteboard-imaging.md | /whiteboard + imaging modality tags | merged (#43) |
| 7 | arena-sprint-7-encounters-care-reminders.md | /encounters, /care-reminders | merged (#44) |
| 8 | arena-sprint-8-billing-ledger.md | /billing (list, detail row, panels) | merged (#46) |
| 9 | arena-sprint-9-billing-entry-pos-new-invoice.md | /billing/pos, /billing/new | merged (#48) |
| 10 | arena-sprint-10-billing-ekasa-pagekit.md | /billing/ekasa | merged (#47) |
| 11 | arena-sprint-11-reports-wellness.md | /reports, /wellness | merged (#50) |
| 12 | arena-sprint-12-statutory-kvepis.md | /statutory, /statutory/kvepis | merged (#49) |
| 13 | arena-sprint-13-patient-client-intake-duplicates.md | /patients/new, /clients/new, /patients/duplicates | merged (#54) |
| 14 | arena-sprint-14-field-visits-cehz.md | /field-visits (ambulatory livestock, CEHZ, withdrawal) | merged (#51) |
| 15 | arena-sprint-15-clinical-ai-imaging-dicom.md | Clinical AI Imaging & DICOM hub /agent/imaging | OPEN · NEEDS-CONTRACT — never implemented (session 01a0d6ba delivered Sprint 16); page unchanged since #43 |
| 16 | arena-sprint-16-clinical-ai-voice-ambient.md | /agent/voice (ambient scribe, GDPR, controlled substances) | merged (#53) |
| 17 | arena-sprint-17-clinical-ai-discharge-sympathy.md | /agent/discharge (post-op discharge, sympathy gate) | merged (#52) |
| 18 | arena-sprint-18-client-dossier-billing-hub.md | Client 360 /clients/[id], /clients/[id]/edit | OPEN · NEEDS-CONTRACT — never implemented; pages unchanged since #37 |
| 19 | arena-sprint-19-migration-archive-portability.md | /migration-archive, /settings/import-v2 (PIMS archive, HMAC) | merged (#59, #65) |
| 20 | arena-sprint-20-settings-ekasa-diagnostic-hardware.md | /settings/ekasa, /settings/ai, /settings/simulation | merged (#66) — #58 closed unmerged |
| 21 | arena-sprint-21-settings-master-hub.md | Practice Settings Master Hub /settings | merged (#56) |
| 22 | arena-sprint-22-clinical-records-soap.md | Clinical Records and SOAP Workspace /records | merged (#56) — #55 was description-only |
| 23 | arena-sprint-23-appointment-scheduler.md | Appointment Scheduler and Calendar /schedule | merged (#60) |
| 24 | arena-sprint-24-admin-panel-swarm.md | Admin Panel and AI Swarm Hub /admin /admin/ai-swarm | merged (#63) |
| 25 | arena-sprint-25-encounter-detail-soap-editor.md | Encounter Detail and SOAP Editor /encounters/[appointmentId] | merged (#57) — spec premise 'stub 0 lines' was false |
| 26 | arena-sprint-26-marketing-studio-reviews-website.md | Marketing Studio Part 2: /marketing/reviews /marketing/website | merged (#63) |
| 27 | arena-sprint-27-inventory-hardening.md | Inventory Hardening and Supplier Integration /inventory | merged (#61) — commit 87c2a263 inside #61 |
| 28 | arena-sprint-28-ai-agent-hub.md | AI Agent Hub /agent | merged (#61) |
| 29 | arena-sprint-29-patient-detail-clinical-card.md | Patient Detail and Clinical Card /patients/[id] | PARTIAL (#72) — delivered by #72 with a different tab set; only the contract test is missing |
| 30 | arena-sprint-30-automations-crm-journeys.md | Automations and CRM Journey Builder /automations | merged (#64, #71) — wiring in #71 |
| 32 | arena-sprint-32-soap-ai-provenance-ledger.md | AI provenance ledger on SOAP finalization (records, ai, imaging) | OPEN · READY — promoted from GT-001; armed contract committed with the spec |

**Next free sprint number: 33.** (31 is reserved: commit `fcfc18e` used it informally, no spec.)

### Tickets (`tasks/proposed/`)

| Id | File | Priority | Title | Status |
|----|------|----------|-------|--------|
| GT-001 | gt-001-ai-provenance-ledger-soap-finalization.md | P0 | Dôkazný záznam AI pôvodu pri finalizácii SOAP (F-04-1) | OPEN · PROMOTED |
| GT-006 | gt-006-prijatie-ai-navrhu-po-sekciach.md | P1 | Prijatie AI návrhu po sekciách + viditeľné označenie AI textu (F-04-4) | OPEN · BACKLOG |
| GT-007 | gt-007-kontrola-role-knihy-opl.md | P1 | Doplniť kontrolu roly na controlledSubstances.list (F-06-2) | OPEN · BACKLOG |
| GT-010 | gt-010-ai-settings-getsettings-rola.md | P1 | Brána roly pre aiSettings.getSettings (F-17-1, alias F-X4-3) | OPEN · BACKLOG |
| GT-011 | gt-011-sifrovaci-klic-ai-nastaveni.md | P1 | Verzovaný a povinný šifrovací kľúč pre AI nastavenia (F-17-2) | OPEN · BACKLOG |
| GT-012 | gt-012-feature-mapping-reálne-respektovaný.md | P1 | Feature mapping musí platiť pre všetky AI funkcie (F-17-3, aliasy F-14-1, F-X2-1) | OPEN · BACKLOG |
| GT-013 | gt-013-data-residency-a-dpa-v-ui.md | P1 | Viditeľná data residency, DPA a automatický fallback v AI nastaveniach (F-17-4, F-17-6) | OPEN · BACKLOG |
| GT-014 | gt-014-hlas-rola-gating-pred-nahranim.md | P1 | Skryť/zablokovať hlasový AI vstup pre roly bez oprávnenia (F-18-2, aliasy F-X4-1, F-X4-2) | OPEN · BACKLOG |
| GT-015 | gt-015-zosuladenie-authorization-matrix.md | P1 | Zosúladiť docs/authorization-matrix.md s kódom (F-20-1, alias F-X4-8) | OPEN · BACKLOG |
| GT-016 | gt-016-progres-zrusenie-timeout-ai-draftu.md | P1 | Progres, zrušenie a timeout pri čakaní na AI (F-X7-1) | OPEN · BACKLOG |
| GT-017 | gt-017-jadro-prace-na-tablete.md | P1 | Použiteľnosť jadra práce na tablete (F-X8-1) | PARTIAL |

<!-- END GENERATED -->

## Number collisions (generic swarm tickets, NOT part of the numbered series)

The Agno swarm emitted a batch of generic tickets on 2026-09-25 (`arena-1790325424-*`) that reused the numbers 24 and 26–30. They landed together in PR #67 with no review. They are listed here with a non-numeric id so nobody counts them as sprints. Files are in [`archive/`](archive/).

| Id | Dispatch file (archive/) | Title | Status |
|----|--------------------------|-------|--------|
| G-24 | 2026-09-25-arena-1790325424-sprint-24-finalize-vpm-context.md | Finalize VPM Context Layer | landed a4e60cd (#67), unreviewed |
| G-26 | 2026-09-25-arena-1790325424-sprint-26-audit-legacy-state-b.md | Audit Legacy State Bindings | landed 42f85a2 (#67) |
| G-27 | 2026-09-25-arena-1790325424-sprint-27-implement-schema-val.md | Schema Validation Middleware | landed 155073e (#67), unreviewed |
| G-28 | 2026-09-25-arena-1790325424-sprint-28-optimize-dependency-.md | Optimize Dependency Injection Tree | never implemented; do not dispatch |
| G-29 | 2026-09-25-arena-1790325424-sprint-29-generate-openapi-com.md | OpenAPI Compliance Report | landed f055ddc (#67), unreviewed |
| G-30 | 2026-09-25-arena-1790325424-sprint-30-secure-interop-bridg.md | Secure Interop Bridge v1→v2 | landed dcb15c2 (#67), unreviewed |

The four unnumbered Agno meta specs (`arena-sprint-agno-*`, `arena-sprint-prompt-engineering-audit`) moved to `archive/` when Agno was deprecated (see `.agents/agno/DEPRECATED.md`).

Legacy prompts from before numbering (`arena-consolidation-sprint`, `arena-next-sprint`, `ui-consolidation-prompt`, `ui-phase2-headings`) are in `archive/`.
