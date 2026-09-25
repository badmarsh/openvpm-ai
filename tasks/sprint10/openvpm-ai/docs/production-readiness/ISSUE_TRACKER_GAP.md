# Issue Tracker — GAP Items

> Auto-import via `bash scripts/create-gap-issues.sh` once GitHub Issues are enabled.
> Generated: 2026-09-12. Status: pending import (Issues currently disabled).

---

## P0 — Blocker (8 issues)

### [P0-L01] KVEPIS: Obtain SVPS test endpoint and prove data acceptance
- **Area:** Regulatory / KVEPIS
- **Acceptance:** Signed confirmation from SVPS that test submission was accepted; screenshot of portal status
- **Owner:** Eng + Legal
- **Labels:** p0, kvepis, legal, regulatory

### [P0-L03] UPVS/eID: Obtain NASES sandbox and integration agreement
- **Area:** Regulatory / eID
- **Acceptance:** NASES sandbox credentials + signed integration agreement
- **Owner:** Legal
- **Labels:** p0, upvs, eid, legal

### [P0-L05] Data classification policy and sensitivity labels in schema
- **Area:** Legal / Data
- **Acceptance:** Written policy + at least sensitivity column on patients/encounters tables in migration
- **Owner:** Legal + Eng
- **Labels:** p0, data-governance, legal

### [P0-L07] Legal opinion on AI recommendation liability
- **Area:** Legal / AI
- **Acceptance:** Written legal memo from qualified SK lawyer
- **Owner:** Legal
- **Labels:** p0, ai-safety, legal

### [P0-G01] Recruit first pilot clinic and sign pilot agreement
- **Area:** Product / Sales
- **Acceptance:** Signed pilot agreement with named clinic + onboarding date set
- **Owner:** Product
- **Labels:** p0, pilot, product

### [P0-G02] Sign DPA with all AI sub-processors (Vertex AI, Anthropic)
- **Area:** Legal / Privacy
- **Acceptance:** Signed DPA, EU/EEA region confirmed in writing, kill-switch tested
- **Owner:** Legal
- **Labels:** p0, dpa, privacy, legal

### [P0-G05] External security audit (RLS / IDOR / SSRF)
- **Area:** Security
- **Acceptance:** Audit report from independent party; all P0 findings remediated
- **Owner:** Security
- **Labels:** p0, security, audit

### [P0-G08] e-Kasa void/storno flow tested in test environment
- **Area:** e-Kasa / Fiscal
- **Acceptance:** Passing test with ORP device in FRSR test env; void receipt stored in DB
- **Owner:** Eng + Accounting
- **Labels:** p0, ekasa, fiscal

---

## P1 — High Priority (10 issues)

### [P1-L02] e-Kasa: Publish certified ORP device list and integration partners
- **Area:** e-Kasa
- **Acceptance:** Public doc listing >=3 certified ORP models with integration test results
- **Owner:** Product + Eng
- **Labels:** p1, ekasa, documentation

### [P1-L04] Sign DPA with AI sub-processors and document sub-processor register
- **Area:** Legal
- **Acceptance:** Sub-processor register published in privacy policy; DPO assigned
- **Owner:** Legal
- **Labels:** p1, dpa, legal

### [P1-L06] Legislative update pipeline: law change -> code process
- **Area:** Product / Regulatory
- **Acceptance:** Written SOP for monitoring SVPS/FR SR regulatory changes and updating codebase
- **Owner:** Product
- **Labels:** p1, regulatory, process

### [P1-P03] Production uptime monitoring and SLA definition
- **Area:** SRE
- **Acceptance:** Uptime dashboard live; SLA target documented; alert routing configured
- **Owner:** SRE
- **Labels:** p1, observability, sre

### [P1-A01] Expand AI eval dataset with veterinary clinical review
- **Area:** AI Safety
- **Acceptance:** Dataset reviewed by licensed SK veterinarian; >=200 cases; coverage of drug interactions
- **Owner:** Clinical + Eng
- **Labels:** p1, ai-safety, evals

### [P1-A02] Define clinical safety threshold for AI FP/FN rate
- **Area:** AI Safety
- **Acceptance:** Documented threshold (e.g., FN < 2% for drug contraindications); signed by clinical advisor
- **Owner:** Clinical + Legal
- **Labels:** p1, ai-safety, clinical

### [P1-A03] Red-team testing: prompt injection and hallucination adversarial tests
- **Area:** AI Safety / Security
- **Acceptance:** Red-team report with >=20 adversarial cases; mitigations implemented for all P0 findings
- **Owner:** Security
- **Labels:** p1, ai-safety, security, red-team

### [P1-S02] Document disaster recovery drill with evidence
- **Area:** Operations
- **Acceptance:** Dated drill log (< 90 days old) with RTO/RPO measurements
- **Owner:** Ops
- **Labels:** p1, dr, ops

### [P1-S03] Add Playwright E2E tests to CI pipeline as merge gate
- **Area:** Engineering / CI
- **Acceptance:** ci.yml has E2E job; PR cannot merge if E2E fails; green on main
- **Owner:** Eng
- **Labels:** p1, ci, testing, e2e

### [P1-G07] KVEPIS: Obtain SVPS production endpoint and submit first real report
- **Area:** Regulatory / KVEPIS
- **Acceptance:** First real KVEPIS report accepted by SVPS in production; response code stored
- **Owner:** Eng + Legal
- **Labels:** p1, kvepis, regulatory

---

## P2 — Medium Priority (9 issues)

### [P2-L01-void] e-Kasa: Document void, storno, and correction receipt procedures
- **Area:** e-Kasa
- **Acceptance:** Written runbook + passing tests for void, storno, and correction flows
- **Owner:** Eng
- **Labels:** p2, ekasa, documentation

### [P2-P05] Production API response time dashboard (p95 target)
- **Area:** Observability
- **Acceptance:** p95 latency visible in dashboard; threshold alert configured
- **Owner:** SRE
- **Labels:** p2, observability, performance

### [P2-P08] Pilot outcomes report: 30/60/90 day metrics
- **Area:** Product
- **Acceptance:** Report template created; first report generated 30 days after pilot start
- **Owner:** Product
- **Labels:** p2, pilot, reporting

### [P2-A04] Audit trail: per-recommendation traceability in DB
- **Area:** AI Safety
- **Acceptance:** Each AI recommendation logged with source references in audit table
- **Owner:** Eng
- **Labels:** p2, ai-safety, audit

### [P2-A05] Onboarding module: automation bias warning for clinicians
- **Area:** UX / Clinical
- **Acceptance:** Onboarding flow includes explicit disclaimer screen; test covering it
- **Owner:** UX + Clinical
- **Labels:** p2, ux, ai-safety, clinical

### [P2-S04] Data retention and automated deletion policy
- **Area:** Legal / Engineering
- **Acceptance:** CRON job for retention; written policy specifying retention periods per data category
- **Owner:** Legal + Eng
- **Labels:** p2, data-governance, legal

### [P2-S05] SK data migration runbook for SK-specific fields
- **Area:** Operations
- **Acceptance:** Step-by-step runbook tested on staging with SK clinic data
- **Owner:** Ops
- **Labels:** p2, migration, ops

### [P2-H03] Wholesale live EDI/API integration (CYMEDICA/PHARMOS)
- **Area:** Inventory
- **Acceptance:** Live API call to at least one wholesaler; inventory updated automatically
- **Owner:** Eng
- **Labels:** p2, inventory, integration

### [P2-P09] Measure and document user onboarding time
- **Area:** UX / Product
- **Acceptance:** Onboarding time measured for >=3 non-technical users; target < 2h documented
- **Owner:** Product + UX
- **Labels:** p2, ux, pilot
