# OpenVPM AI — Incident Response Guide

**Document version:** 1.0.0  
**Target Repository:** `badmarsh/openvpm-ai`  
**Date:** 2026-09-09  
**Status:** Canonical Operations Protocol (Phase 4 Deliverable)  

---

## 1. Incident Severity Levels

| Severity | Definition | Target Response | Target Resolution | Examples |
|---|---|---|---|---|
| **SEV-1 (Critical)** | Core clinical charting, billing, or database is completely offline or data loss is occurring. | < 15 minutes | < 2 hours | Database outage, RLS leak between practices, data corruption. |
| **SEV-2 (Major)** | Major clinical feature unavailable with no immediate workaround (e.g. e-Kasa offline, AI scribe failure). | < 30 minutes | < 6 hours | S3 storage unreachable, AI provider API outage, e-Kasa printer driver disconnected. |
| **SEV-3 (Minor)** | Non-blocking degradation (e.g. slow client portal loading, marketing generator timeout). | < 2 hours | < 24 hours | UI display glitch, delayed notification SMS, non-critical cron warning. |

---

## 2. Containment & Escalation Protocol

### Step 1: Immediate Containment (If security or data integrity is threatened)
1. **Activate Recovery Hold:**
   - Execute `lockPracticeForExternalSideEffects(db, practiceId)` to immediately prevent unauthorized outgoing webhooks, SMS, or e-Kasa dispatches.
2. **Revoke Affected Sessions:**
   - Invalidate active NextAuth sessions by rotating `NEXTAUTH_SECRET` or executing session revocation in the database.
3. **Isolate Compromised Integration:**
   - Temporarily disable affected third-party API keys (Stripe, AI provider, SMS gateway).

### Step 2: Investigation & Root-Cause Analysis
- Inspect structured logs via correlation ID (`requestId`).
- Verify database audit ledger integrity using `pnpm audit:verify-ai`.
- Verify database backups and replica state in `docs/backup-restore-runbook.md`.

### Step 3: Post-Mortem & Reporting
- Conduct blame-free technical post-mortem within 48 hours of resolution.
- If personal data was compromised, report to the Slovak Data Protection Authority (Úrad na ochranu osobných údajov SR) within 72 hours per GDPR Article 33.
