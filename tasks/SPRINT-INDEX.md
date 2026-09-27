# Arena Sprint Index

Status legend: `merged (#PR)` = the sprint's target files changed in a commit reachable from `main` · `NOT IMPLEMENTED` = the spec exists but its target files never changed · `partial` = delivered in part or under another prompt (see note).
Spec files live in [`sprints/`](sprints/). Per-file evidence is in [`VERIFICATION-LOG.md`](VERIFICATION-LOG.md). Planner prompt: [`../prompts/arena-sprint-writer-prompt.md`](../prompts/arena-sprint-writer-prompt.md).
Update this table whenever a sprint is written or merged. **git outranks this table.** The Agno runtime parses it (`_parse_sprint_index`): keep the 4-column layout, and put a number in the first cell only for real sprints.

Last reconciled against `git log` + `gh pr list`: **2026-09-27** (HEAD `6d8e6ac`).

| # | Sprint file | Title / target files | Status (2026-09-27) |
|---|-------------|----------------------|---------------------|
| 1 | arena-sprint-1-command-palette.md | Command palette ranking | merged (#42) |
| 2 | arena-sprint-2-uikit-harmonization.md | /recalls, /vaccinations, /controlled-substances | merged (#38) |
| 3 | arena-sprint-3-field-practice.md | Field visits, CEHZ, KVEPIS panel | merged (#39, hotfix #40) |
| 4 | arena-sprint-4-lab-results.md | /lab-results | merged (#41) |
| 5 | arena-sprint-5-prescriptions.md | /prescriptions | merged (#45; follow-ups #68, #70) |
| 6 | arena-sprint-6-whiteboard-imaging.md | /whiteboard + imaging modality tags | merged (#43) |
| 7 | arena-sprint-7-encounters-care-reminders.md | /encounters, /care-reminders | merged (#44) |
| 8 | arena-sprint-8-billing-ledger.md | /billing (list, detail row, panels) | merged (#46) |
| 9 | arena-sprint-9-billing-entry-pos-new-invoice.md | /billing/pos, /billing/new | merged (#48) |
| 10 | arena-sprint-10-billing-ekasa-pagekit.md | /billing/ekasa | merged (#47) |
| 11 | arena-sprint-11-reports-wellness.md | /reports, /wellness | merged (#50) |
| 12 | arena-sprint-12-statutory-kvepis.md | /statutory, /statutory/kvepis | merged (#49) |
| 13 | arena-sprint-13-patient-client-intake-duplicates.md | /patients/new, /clients/new, /patients/duplicates | merged (#54) |
| 14 | arena-sprint-14-field-visits-cehz.md | /field-visits (ambulatory livestock, CEHZ, withdrawal) | merged (#51) |
| 15 | arena-sprint-15-clinical-ai-imaging-dicom.md | /agent/imaging (DICOM viewer, modality tags) | NOT IMPLEMENTED — session 01a0d6ba delivered Sprint 16 instead; page unchanged since #43 |
| 16 | arena-sprint-16-clinical-ai-voice-ambient.md | /agent/voice (ambient scribe, GDPR, controlled substances) | merged (#53) |
| 17 | arena-sprint-17-clinical-ai-discharge-sympathy.md | /agent/discharge (post-op discharge, sympathy gate) | merged (#52) |
| 18 | arena-sprint-18-client-dossier-billing-hub.md | /clients/[id], /clients/[id]/edit (client 360, comms log) | NOT IMPLEMENTED — no PR; pages unchanged since #37 |
| 19 | arena-sprint-19-migration-archive-portability.md | /migration-archive, /settings/import-v2 (PIMS archive, HMAC) | merged (#59, #65) |
| 20 | arena-sprint-20-settings-ekasa-diagnostic-hardware.md | /settings/ekasa, /settings/ai, /settings/simulation | merged (#66; #58 closed) |
| 21 | arena-sprint-21-settings-master-hub.md | Practice Settings Master Hub /settings | merged (#56) |
| 22 | arena-sprint-22-clinical-records-soap.md | Clinical Records and SOAP Workspace /records | merged (#56; #55 was description-only) |
| 23 | arena-sprint-23-appointment-scheduler.md | Appointment Scheduler and Calendar /schedule | merged (#60) |
| 24 | arena-sprint-24-admin-panel-swarm.md | Admin Panel and AI Swarm Hub /admin /admin/ai-swarm | merged (#63) |
| 25 | arena-sprint-25-encounter-detail-soap-editor.md | Encounter Detail and SOAP Editor /encounters/[appointmentId] | merged (#57) |
| 26 | arena-sprint-26-marketing-studio-reviews-website.md | Marketing Studio Part 2 Reviews and Website /marketing/reviews /marketing/website | merged (#63) |
| 27 | arena-sprint-27-inventory-hardening.md | Inventory Hardening and Supplier Integration /inventory | merged (87c2a263 inside #61) |
| 28 | arena-sprint-28-ai-agent-hub.md | AI Agent Hub /agent | merged (#61) |
| 29 | arena-sprint-29-patient-detail-clinical-card.md | Patient Detail and Clinical Card /patients/[id] /patients | merged via #72 (partial: different tab set, spec test not created) |
| 30 | arena-sprint-30-automations-crm-journeys.md | Automations and CRM Journey Builder /automations | merged (#64, wiring #71) |

**Next free number: 31.** `31` is already used informally by commit `fcfc18e` ("port arena sprint-31 page", /prescriptions), which has no spec. Start new specs at **32**, or write a retroactive spec for 31 first.

## Number collisions (generic swarm tickets, NOT part of the numbered series)

The Agno swarm emitted a batch of generic tickets on 2026-09-25 (`arena-1790325424-*`) that reused the numbers 24 and 26–30. They landed together in PR #67 with no review. They are listed here with a non-numeric id so the runtime never counts them as sprints. Files are in [`archive/`](archive/).

| Id | Dispatch file (archive/) | Title | Status |
|----|--------------------------|-------|--------|
| G-24 | 2026-09-25-arena-1790325424-sprint-24-finalize-vpm-context.md | Finalize VPM Context Layer | landed a4e60cd (#67), unreviewed |
| G-26 | 2026-09-25-arena-1790325424-sprint-26-audit-legacy-state-b.md | Audit Legacy State Bindings | landed 42f85a2 (#67) |
| G-27 | 2026-09-25-arena-1790325424-sprint-27-implement-schema-val.md | Schema Validation Middleware | landed 155073e (#67), unreviewed |
| G-28 | 2026-09-25-arena-1790325424-sprint-28-optimize-dependency-.md | Optimize Dependency Injection Tree | never implemented; do not dispatch |
| G-29 | 2026-09-25-arena-1790325424-sprint-29-generate-openapi-com.md | OpenAPI Compliance Report | landed f055ddc (#67), unreviewed |
| G-30 | 2026-09-25-arena-1790325424-sprint-30-secure-interop-bridg.md | Secure Interop Bridge v1→v2 | landed dcb15c2 (#67), unreviewed |

Unnumbered Agno sprint specs (in `sprints/`): `arena-sprint-agno-pipeline-hardening.md` (done), `arena-sprint-agno-pipeline-audit-phase2.md` (done), `arena-sprint-prompt-engineering-audit.md` (done; report never written), `arena-sprint-agno-enterprise-specs.md` (reference spec).

Legacy prompts from before numbering (`arena-consolidation-sprint`, `arena-next-sprint`, `ui-consolidation-prompt`, `ui-phase2-headings`) are in `archive/`.
