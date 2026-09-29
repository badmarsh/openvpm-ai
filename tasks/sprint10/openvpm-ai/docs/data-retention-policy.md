# OpenVPM AI — Data Retention & Privacy Policy

**Document version:** 1.0.0  
**Target Repository:** `badmarsh/openvpm-ai`  
**Date:** 2026-09-09  
**Status:** Canonical Lifecycle Specification (Phase 3 Deliverable)  

---

## 1. Principles & Regulatory Context

OpenVPM AI adheres to the European Union General Data Protection Regulation (GDPR / Nariadenie EP a Rady EÚ 2016/679) and Slovak Data Protection Act (Zákon č. 18/2018 Z. z. o ochrane osobných údajov), alongside statutory veterinary archival mandates (Zákon č. 39/2007 Z. z. a Zákon č. 362/2011 Z. z.).

### Core Principles
1. **Data Minimization:** Raw audio recordings used for voice transcription and clinical drafting are treated as ephemeral processing artifacts, not medical records.
2. **Clinical Hold & Immutability:** Finalized medical records (SOAP notes, surgical reports, prescriptions, controlled substances ledgers) and fiscal receipts (e-Kasa) are legally protected and must **never** be automatically purged.
3. **Automated & Idempotent Enforcement:** Ephemeral data is deleted via automated cron jobs with verifiable heartbeat telemetry and audit evidence.

---

## 2. Retention Schedule by Data Category

| Category | Retention Window | Storage Medium | Lifecycle Enforcement | Rationale / Legal Basis |
|---|---|---|---|---|
| **Raw Voice Audio Blobs** | **24 hours** | S3 / MinIO Object Storage | `/api/cron/voice-audio-retention` (hourly) | GDPR Art. 5(1)(e) storage limitation. Raw audio is purged once transcription is verified. |
| **Voice Transcripts & Intermediate Drafts** | 90 days (if unconfirmed) | PostgreSQL (`voice_dictations`) | Soft-delete after 90 days if never finalized | Unassigned / abandoned dictations. |
| **Finalized Clinical SOAP Notes** | Permanent / ≥ 10 years | PostgreSQL (`soap_notes`) | **IMMUTABLE (Clinical Hold)** | Zákon č. 39/2007 Z. z. (povinná archivácia zdravotnej dokumentácie). |
| **Controlled Substances Log (OPL)** | Permanent / ≥ 10 years | PostgreSQL (`controlled_substance_log`) | **IMMUTABLE (Statutory Hold)** | Zákon č. 362/2011 Z. z. (§ 42 – register omamných látok). |
| **Fiscal e-Kasa Records** | Permanent / ≥ 10 years | PostgreSQL (`ext_ekasa_receipts`) | **IMMUTABLE (Fiscal Hold)** | Zákon č. 289/2008 Z. z. (daňové a účtovné doklady). |
| **Medical Imaging Files (DICOM, X-Ray)** | Permanent / ≥ 10 years | S3 Object Storage (Private) | Storage versioning & replication | Zdravotná dokumentácia pacienta. |
| **AI Confirmation Audit Trail** | Permanent / ≥ 10 years | PostgreSQL (`ext_ai_audit_log`) | Append-only ledger | Forenzná zodpovednosť veterinárneho lekára. |
| **Client Portal Capability Tokens** | 30 days / Revocable | PostgreSQL (`portal_sessions`) | Invalidation on expiry / client demand | Zabezpečenie prístupu majiteľa k záznamom. |
| **Application & Access Logs** | 30 days | Ephemeral log buffer | Automated rotation with PII redaction | Systémová bezpečnosť a monitoring. |

---

## 3. Automated Voice Audio Retention Engine

The purge mechanism is implemented in `apps/web/lib/voice/retention.ts` and triggered by `/api/cron/voice-audio-retention`:

- **Eligibility Criteria:**
  - `audioFileKey` is not null, AND
  - `audioDeletedAt` is null, AND
  - `scheduledDeleteAt < NOW()` (or `completedAt < NOW() - 24 hours`).
- **Deletion Protocol:**
  1. Object deleted from S3 storage via `deleteFile(audioFileKey)`.
  2. Database record updated with `audioFileKey: null` and `audioDeletedAt: NOW()`.
  3. Operation metrics (`processed`, `deleted`, `errors`) reported to heartbeat monitor.
- **Fail-Safe:**
  - If S3 deletion fails, database record is preserved and error is alerted to operations.
