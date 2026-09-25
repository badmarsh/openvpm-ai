# Clinical AI Evaluation Scope

**Version:** 1.0.0  
**Date:** 2026-09-09  
**Status:** Engineering Governance Document  
**Repository:** `badmarsh/openvpm-ai`

---

> [!IMPORTANT]
> This document describes **engineering-level test gates** for the AI components of OpenVPM AI. It does **not** constitute clinical efficacy validation, a medical device evaluation, or a regulatory submission. Clinical use of AI-generated content requires prospective evaluation by qualified veterinary professionals.

---

## 1. What the Harness Proves

The deterministic clinical evaluation harness at [`apps/web/lib/ai/__tests__/clinical-eval-harness.test.ts`](../apps/web/lib/ai/__tests__/clinical-eval-harness.test.ts) and [`apps/web/lib/ai/__tests__/audit-chain.test.ts`](../apps/web/lib/ai/__tests__/audit-chain.test.ts) proves the following **engineering properties**:

### 1.1 Parsing and Validation Behavior
- SOAP formatter system prompts correctly differentiate between concise, standard, and detailed styles
- Breed-specific VHS reference ranges are applied (Boxer threshold ≠ standard canine threshold)
- Drug dose calculations produce a reference range, not a single value
- Formulary ID validation correctly rejects unknown drug identifiers
- Hash computation is deterministic for identical inputs
- Edit-flag derivation correctly reflects hash comparison results

### 1.2 Policy Enforcement (Deterministic)
- Contraindicated species/drug pairs are rejected (e.g. carprofen in felines)
- Drug dosing exceeds the weight boundary ceiling correctly
- The `wasEditedByClinician` flag is set when draft and confirmed content differ

### 1.3 Authorization Behavior
- `assertAgentRole()` denies undefined, null, empty, unknown, and disallowed roles
- Authorized roles (veterinarian, admin) are permitted for privileged tools
- The old fail-open pattern is documented and proven vulnerable by a regression test

### 1.4 Audit Chain Integrity
- Canonical serialization is deterministic regardless of property insertion order
- Hash chain detects: modified hashes, deleted events, inserted events, reordered events, forged predecessors, duplicated sequences, future timestamps, altered edit flags
- Multi-tenant chains are verified independently

### 1.5 No-Autonomous-Write Behavior
- AI drafts are stored as `draft` status without `clinicianConfirmed: true`
- Finalization requires explicit `clinicianConfirmed: true` in the API call
- Audit log insert is transactional with the clinical record commit

---

## 2. What the Harness Does NOT Prove

### 2.1 Clinical Efficacy
The harness does **not** evaluate:
- Whether AI-generated SOAP content is clinically accurate for any species, breed, or condition
- Whether drug dose reference ranges are appropriate for a specific patient
- Whether VHS interpretation is correct for a specific radiograph
- Whether AI imaging descriptions correspond to actual pathological findings
- Whether AI-generated discharge instructions are medically appropriate

### 2.2 Real-World Performance
- Tests use synthetic fixed inputs; they do not evaluate model behavior on real clinical data
- No evaluation of hallucination rates, factual accuracy, or clinical completeness
- No evaluation of Slovak medical terminology accuracy for all veterinary conditions
- No evaluation of rare or complex clinical presentations

### 2.3 Regulatory Certification
- This harness does not constitute a CE marking evaluation under MDR 2017/745
- This harness does not constitute KVL SR approval of AI-assisted clinical tools
- This harness does not satisfy any ŠVPS SR inspection requirement as a standalone document
- The system is not certified as a medical device

### 2.4 LLM Provider Behavior
- Live model calls are excluded from standard CI — tests run against deterministic pure functions only
- Model output quality, consistency, and safety depend on the configured model provider
- Model behavior may change with provider updates outside the control of this repository

---

## 3. Fixture Design

All test fixtures use **synthetic data only**:
- Synthetic patient identifiers (UUID constants)
- Synthetic practice identifiers
- No real patient names, addresses, or clinical histories
- No real drug lot numbers, prescriptions, or medical records
- No real audio, images, or DICOM files

---

## 4. Engineering Safety Gates (Non-Clinical)

The following gates must pass before a pilot deployment:

| Gate | Command | What it proves |
|---|---|---|
| Authorization fail-closed | `vitest run lib/__tests__/authorization.test.ts` | Absent/unknown roles are denied |
| Audit chain tamper detection | `vitest run lib/ai/__tests__/audit-chain.test.ts` | Hash chain integrity verified |
| Clinical AI deterministic | `vitest run lib/ai/__tests__/clinical-eval-harness.test.ts` | Dosing, VHS, audit trail |
| Typecheck | `pnpm type-check` | No TypeScript errors |
| Audit trail verification | `pnpm audit:verify-ai --allow-empty` | Verifier runs correctly |

---

## 5. What Requires Prospective Veterinary Review

The following items **cannot be assessed by automated tests** and require review by qualified veterinary professionals before clinical use:

1. **Clinical accuracy of AI-generated SOAP notes** — requires evaluation by licensed veterinarians on representative clinical cases
2. **Drug dose reference ranges** — the formulary in `lib/dosing.ts` must be reviewed and validated by a veterinary pharmacologist or supervising veterinarian
3. **VHS reference ranges by breed** — the thresholds in `lib/imaging/vhs-calculator.ts` must be reviewed against current veterinary cardiology literature
4. **Slovak veterinary terminology** — the system prompts in Slovak must be reviewed by a Slovak veterinarian for accuracy and compliance with ŠVPS SR / KVL SR requirements
5. **Controlled substances workflow** — the OPL (Kniha omamných a psychotropných látok) electronic logging workflow must be validated by the clinic's designated supervising veterinarian before replacing paper registers
6. **Informed consent flows** — consent templates must be reviewed by a veterinary legal advisor for compliance with Slovak law (Zákon č. 39/2007 Z. z.)

---

## 6. Governance Requirements

- This harness must be reviewed and updated when: system prompts change, the formulary is updated, VHS reference ranges are updated, or new AI-assisted clinical workflows are added
- Any change to the `canonicalizationVersion` in `audit-chain.ts` must be accompanied by a migration plan for existing audit records
- Live model evaluations (optional, not in standard CI) must be run against a representative anonymized dataset before any major clinical workflow change
