# OpenVPM AI — Pilot Readiness Implementation Plan

**Document version:** 1.0.0  
**Target Repository:** `badmarsh/openvpm-ai`  
**Date:** 2026-09-09  
**Status:** Approved Roadmap for Clinical Pilot (Phase 0 Deliverable)  

---

## 1. Plan Structure & Phasing

To ensure uninterrupted clinical operations and maintain zero-conflict upstream synchronization, this plan separates improvements into three priority tiers:

- **P0: Must Fix Before Pilot (Blockers)**
- **P1: Strongly Recommended Before Pilot (Hardening)**
- **P2: Deferred Post-Pilot (Enhancements)**

---

## 2. Priority Tiers

### P0 — Must Fix Before Pilot (Clinical Safety & Tenant Integrity)

1. **Active Audit Ledger Insertion (`ext_ai_audit_log`):**
   - Wire `buildAiConfirmationAuditTrail` and `db.insert(extAiAuditLog)` into:
     * `apps/web/server/routers/extensions/discharge.ts` (Discharge summary finalization)
     * `apps/web/server/routers/extensions/imaging.ts` (Imaging analysis review)
     * `apps/web/server/routers/extensions/voice.ts` (Voice SOAP note approval)
   - Ensure the SHA-256 hash of the raw AI draft and the final clinician content are permanently stored.

2. **Prescription Tool Role Enforcement:**
   - Add explicit role restriction (`veterinarian` or `admin` only) to `createPrescriptionTool` in `apps/web/lib/agent/tools.ts`. Technicians and front desk cannot create prescriptions.

3. **Standalone Audit Verification Script:**
   - Implement `scripts/verify-ai-audit-trail.ts` and add `pnpm audit:verify-ai` to verify tamper-evidence of the audit chain in CI and preflight checks.

4. **Formal Authorization Matrix:**
   - Deliver `docs/authorization-matrix.md` mapping roles against all sensitive modules.

---

### P1 — Strongly Recommended Before Pilot (Hardening & Quality)

1. **Agent Runner Execution Budget & Timeout:**
   - Add `AbortSignal.timeout(30_000)` and iteration budgeting to `apps/web/lib/agent/runner.ts` to prevent runaway LLM queries.

2. **Deterministic Evaluation Harness:**
   - Create `apps/web/lib/ai/__tests__/clinical-eval-harness.test.ts` with synthetic Slovak veterinary cases testing:
     * SOAP styling (concise vs detailed)
     * Slovak drug name translation (Rimadyl, Metacam, Synulox)
     * Negation understanding ("bez zvracania", "teplota nemeraná")
     * VHS interpretation across brachycephalic breeds

3. **Data Retention & Privacy Specification:**
   - Deliver `docs/data-retention-policy.md` defining explicit lifecycle windows for audio, portal tokens, and clinical attachments.

4. **Clinic Pilot Workflow Specification:**
   - Deliver `docs/clinic-pilot-workflow.md` detailing the end-to-end patient journey from check-in to e-Kasa receipt and discharge letter.

---

### P2 — Deferred Post-Pilot (Platform Expansion)

1. Multi-location practice synchronization across separate physical clinics.
2. Direct bilateral hardware integration with in-house laboratory analyzers (Idexx Catalyst, ProCyte) via ASTM / HL7.
3. Automated real-time submission to ŠVPS / RVPS electronic portals (currently handled via generated export books).
4. External automated notary integration (RFC 3161 timestamping authority) for audit log export.
