# Documentation index

Reference documentation for OpenVPM AI. Process docs (sprint specs, rules, workflow) live in [	asks/](../tasks/WORKFLOW.md); dated analysis reports live in [docs/audits/](audits/); living prompt templates live in [prompts/](../prompts/README.md).

Entries marked with a dagger (†) are referenced by source code, tests or CI by path. Do not move or rename them without updating those references. Entries marked *superseded* carry a banner pointing at the newer document.

## Runbooks and operations

- [AI Audit Chain — Cutover & Backfill](guides/ai-audit-cutover.md)
- [AI Finalization — Operations Runbook](guides/ai-finalization-operations.md)
- [Backup and Restore Runbook](guides/backup-restore-runbook.md)
- [Conversion evidence and reconciliation](reference/conversion-observability.md)
- [Database Backup — Prevádzkový runbook (Serverové PostgreSQL)](guides/db-backup-server-runbook.md)
- [OpenVPM AI — Dokploy Deployment Runbook & SOP](guides/dokploy-deployment-runbook.md)
- [e-Kasa: Certifikovaný hardvér & prevádzkový runbook](guides/ekasa-certified-hardware-and-runbook.md)
- [File and Object Recovery Runbook](guides/file-object-recovery-runbook.md)
- [OpenVPM Cloud Production Runbook](guides/hosted-cloud-production.md) †
- [OpenVPM AI — Incident Response Guide](guides/incident-response.md)
- [Open-source release checklist](guides/open-source-release-checklist.md)
- [OpenVPM AI — Production Hardening & Operational Runbook](guides/production-hardening.md)
- [OpenVPM AI — Release Checklist & Deployment Runbook](guides/release-checklist.md)
- [Provider-free SMS concurrency drill](guides/sms-concurrency-drill.md)

## Security, privacy and authorization

- [OpenVPM AI — Agent Tool Security & Authorization Matrix](reference/agent-tool-security-matrix.md) †
- [AI Audit Ledger — Design, Canonicalization, and Threat Model](reference/ai-audit-ledger.md) †
- [OpenVPM AI — Authorization & Role-Based Access Control Matrix](reference/authorization-matrix.md) †
- [Clinical AI Evaluation Scope](reference/clinical-ai-evaluation-scope.md)
- [Clinician Confirmation Protocol (AI Finalization)](reference/confirmation-protocol.md) †
- [OpenVPM AI — Data Retention & Privacy Policy](reference/data-retention-policy.md)
- [Lab result safety workflow](guides/lab-result-safety.md)
- [Security Overview](security.md) †

## Pilot, audits and readiness

- [9.3 Security & Pilot Readiness Report](audits/9.3-security-and-pilot-readiness-report.md)
- [Controlled clinic pilot operations](guides/clinic-pilot-operations.md)
- [Clinic pilot readiness](clinic-pilot-readiness.md) †
- [OpenVPM AI — Clinic Pilot Workflow & State Machine](reference/clinic-pilot-workflow.md)
- [Controlled Pilot Readiness Report — Clinical AI Finalization](audits/controlled-pilot-readiness-report.md)
- [OpenVPM AI — 9.3 Correctness Closure Audit](archive/9.3-correctness-closure-audit.md)
- [Authorization Enforcement Audit](archive/authorization-enforcement-audit.md)
- [OpenVPM AI — Pilot Readiness & Clinical AI Trust Audit](archive/pilot-readiness-audit.md)
- [OpenVPM AI — Pilot Readiness Implementation Plan](archive/pilot-readiness-plan.md)

## Migration and integrations

- [Migrating to OpenVPM](migration/migrating-to-openvpm.md) †
- [Shepherd migration archive preflight](migration/shepherd-migration-archive-preflight.md) †
- [Shepherd migration support plan](migration/shepherd-migration-support-plan.md)
- [Slovak Veterinary Integration Catalog (Slovenský integračný katalóg)](reference/slovak-integration-catalog.md) †

## Governance and reference

- [Internationalization and Localization](reference/I18N.md)
- [Repository governance and release policy](reference/repository-governance.md) †
- [Repository recovery and cleanup ledger](repository-recovery-ledger.md) †
- [OpenVPM UI kit — agent prompt](UIKIT.md) †

## Folders

| Folder | Notes |
|---|---|
| [guides/](guides/) | Runbooks, operational checklists, workflows, SOPs. |
| [reference/](reference/) | Matrices, catalogs, policies, technical reference. |
| [audits/](audits/) | Point-in-time system audits, readiness assessments, consolidated reports. |
| [archive/](archive/) | Archived audits, completed remediation reports, stale reference documents. |
| [migration/](migration/) | Legacy-state migration runbooks, tools and preflights. |
| [help/](help/README.md) | End-user help (EN and SK). |
| [wiki/](wiki/README.md) | Outline wiki documentation source and ticket templates. |
| [product/](product/) | Product specs, user journeys, autopilot vision. |
| [product-discovery/](product-discovery/README.md) | Discovery material and simulation output. |
| [production-readiness/](production-readiness/README.md) | Release runbook, gap analysis, compliance matrices. |

Two documents stay at the repository root because scripts/docs-viewer.mjs lists them explicitly: [CLOUDFLARE_TUNNEL.md](../CLOUDFLARE_TUNNEL.md) and [DESIGN-SYSTEM-MIGRATION.md](../DESIGN-SYSTEM-MIGRATION.md).
