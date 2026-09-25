# Insurance Domain Feature Map

**Domain:** Poistenie zvierat (Pet Insurance)  
**Analysis Date:** 2026-09-12  
**Codebase Commit:** 23f23a3  
**Primary Files:** `apps/web/server/routers/insurance.ts`, `apps/web/server/routers/extensions/insurance.ts`, `apps/web/lib/insurance/petexpert.ts`, `packages/db/schema/insurance.ts`

---

## A. Feature Inventory Table

| # | Feature | Status | Source | Role Access | Implementation Location |
|---|---------|--------|--------|-------------|------------------------|
| 1 | **Insurance Policy Management** | | | | |
| 1.1 | Create insurance policy | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L295-L335] | admin, front_desk | `insuranceRouter.createPolicy` |
| 1.2 | Update insurance policy | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L337-L395] | admin, front_desk | `insuranceRouter.updatePolicy` |
| 1.3 | List insurance policies | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L247-L293] | All authenticated users | `insuranceRouter.listPolicies` |
| 1.4 | Policy date validation (effective vs expiration) | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L175-L183] | N/A (validation) | `assertValidPolicyDateWindow` |
| 1.5 | Policy optimistic locking | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L375-L385] | N/A (concurrency) | SQL `is not distinct from` clause |
| 2 | **Insurance Claims Management** | | | | |
| 2.1 | Create insurance claim | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L447-L475] | admin, front_desk | `insuranceRouter.createClaim` |
| 2.2 | Update claim status | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L477-L555] | admin, front_desk | `insuranceRouter.updateClaimStatus` |
| 2.3 | List claims with filtering | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L397-L445] | All authenticated users | `insuranceRouter.listClaims` |
| 2.4 | Claim status state machine | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L20-L27] | N/A (validation) | `claimStatusTransitions` |
| 2.5 | Claim resolution validation | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L230-L245] | N/A (validation) | `assertValidClaimResolution` |
| 2.6 | Auto-set submittedAt timestamp | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L515-L518] | N/A (automation) | Status transition logic |
| 2.7 | Auto-set resolvedAt timestamp | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L520-L525] | N/A (automation) | Status transition logic |
| 3 | **PetExpert Integration (Slovak Market)** | | | | |
| 3.1 | PetExpert eligibility validation | Implemented | [VERIFIED: apps/web/server/routers/extensions/insurance.ts:L25-L70] | admin, veterinarian, technician, front_desk | `insuranceRouter.checkEligibility` |
| 3.2 | PetExpert claim creation from invoice | Implemented | [VERIFIED: apps/web/server/routers/extensions/insurance.ts:L72-L200] | admin, veterinarian, technician, front_desk | `insuranceRouter.createClaim` |
| 3.3 | Microchip validation (ISO 11784/11785) | Implemented | [VERIFIED: apps/web/lib/insurance/petexpert.ts:L65-L70] | N/A (validation) | `validatePetExpertEligibility` |
| 3.4 | Co-pay calculation (10% / min 35€) | Implemented | [VERIFIED: apps/web/lib/insurance/petexpert.ts:L80-L95] | N/A (calculation) | `validatePetExpertEligibility` |
| 3.5 | PetExpert JSON payload builder | Implemented | [VERIFIED: apps/web/lib/insurance/petexpert.ts:L100-L145] | N/A (data transformation) | `buildPetExpertClaimPayload` |
| 3.6 | PetExpert HTML report generator | Implemented | [VERIFIED: apps/web/lib/insurance/petexpert.ts:L147-L250] | N/A (document generation) | `generatePetExpertClaimHtml` |
| 4 | **Multi-Tenant Security** | | | | |
| 4.1 | Practice-scoped policy queries | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L255-L260] | N/A (RLS) | `activePracticePredicate` |
| 4.2 | Practice-scoped claim queries | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L405-L410] | N/A (RLS) | `activePracticePredicate` |
| 4.3 | Cross-tenant policy update prevention | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L375-L380] | N/A (RLS) | SQL WHERE clause with practiceId |
| 4.4 | Cross-tenant claim update prevention | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L540-L545] | N/A (RLS) | SQL WHERE clause with practiceId |
| 4.5 | Client/patient ownership validation | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L135-L165] | N/A (validation) | `assertPolicyTargetsBelongToPractice` |
| 4.6 | Invoice ownership validation | Implemented | [VERIFIED: apps/web/server/routers/insurance.ts:L167-L195] | N/A (validation) | `assertClaimTargetsBelongToPractice` |

---

## B. Import / Export Specifics

### B.1 Data Import

**No direct import functionality identified.** [INFERRED]

Insurance policies and claims are created through the tRPC API endpoints. There is no CSV/JSON bulk import mechanism for insurance data in the current codebase.

### B.2 Data Export

| Export Type | Format | Trigger | Implementation | Status |
|-------------|--------|---------|----------------|--------|
| PetExpert claim JSON | JSON (Partner API v2.1) | `createClaim` mutation | [VERIFIED: apps/web/lib/insurance/petexpert.ts:L100-L145] | Implemented |
| PetExpert claim HTML | HTML (printable report) | `createClaim` mutation | [VERIFIED: apps/web/lib/insurance/petexpert.ts:L147-L250] | Implemented |
| General insurance data | None | N/A | [INFERRED] | Not implemented |

**PetExpert JSON Payload Structure:** [VERIFIED: apps/web/lib/insurance/petexpert.ts:L100-L145]
```typescript
{
  partnerApiVersion: "2.1",
  insurer: "PETEXPERT_SK",
  timestamp: ISO string,
  claimReference: string,
  policy: { number, provider },
  insuredPet: { name, species, breed, microchipNumber, birthDate, weightKg },
  policyHolder: { fullName, phone, email, address },
  clinicalCase: { veterinarian, incidentDate, diagnosis, treatmentSummary },
  financials: { currency, totalInvoiceAmount, clientCoPay, requestedPayout, items[] }
}
```

**PetExpert HTML Report:** [VERIFIED: apps/web/lib/insurance/petexpert.ts:L147-L250]
- Slovak language document
- Includes pet, client, veterinarian, diagnosis, and financial details
- Signature lines for client and veterinarian
- Styled for printing (A4 format)

---

## C. Integration Specifics

### C.1 PetExpert Slovensko (Primary Integration)

**Integration Type:** Direct Settlement (Priame vysporiadanie)  
**Protocol:** REST JSON (Partner API v2.1)  
**Status:** Implemented (v0.6) — **No live API connection** [VERIFIED: docs/production-readiness/GAP_ANALYSIS_POST_PILOT_READY.md:H-04]

**Technical Details:** [VERIFIED: apps/web/lib/insurance/petexpert.ts:L1-L250]

1. **Eligibility Validation:**
   - Policy number required (min 4 characters) [VERIFIED: L60-L62]
   - Microchip mandatory (15 digits, ISO 11784/11785) [VERIFIED: L65-L70]
   - Policy expiration check [VERIFIED: L73-L78]
   - Species check (canine/feline preferred) [VERIFIED: L81-L84]
   - Co-pay calculation: 10% of claim amount, minimum 35€ [VERIFIED: L87-L95]

2. **Claim Creation Flow:** [VERIFIED: apps/web/server/routers/extensions/insurance.ts:L72-L200]
   ```
   1. Fetch policy & patient
   2. Fetch client (policyholder)
   3. Validate eligibility
   4. Fetch invoice items (if invoiceId provided)
   5. Insert insurance_claims record (status: "submitted")
   6. Build PetExpert JSON payload
   7. Generate HTML printable report
   8. Return claim + eligibility + payload + HTML
   ```

3. **Financial Calculation:** [VERIFIED: apps/web/lib/insurance/petexpert.ts:L87-L95]
   ```typescript
   coveragePercent = policy.coveragePercent ?? 90  // Default 90%
   standardDeductible = policy.deductible ?? 35    // Default 35€
   
   calculatedCoPay = claimAmount * ((100 - coveragePercent) / 100)
   if (calculatedCoPay < standardDeductible) {
     calculatedCoPay = standardDeductible
   }
   
   estimatedInsurerCoverage = claimAmount - calculatedCoPay
   ```

4. **Direct Settlement Consent:** [VERIFIED: apps/web/server/routers/extensions/insurance.ts:L165]
   - Client consent for direct settlement is captured (default: true)
   - Included in JSON payload as `directSettlementConsent`

**Current Limitations:** [VERIFIED: docs/production-readiness/GAP_ANALYSIS_POST_PILOT_READY.md:H-04]
- ✅ Payload builder implemented
- ✅ HTML report generator implemented
- ❌ No production PetExpert API credentials
- ❌ No live API webhook integration
- ❌ No automatic claim submission to PetExpert

### C.2 Generali / Union Insurance

**Integration Type:** Structured PDF/CSV export  
**Status:** Claimed in docs — **Not verified in code** [CLAIMED IN DOCS: docs/slovak-integration-catalog.md:L15-L17]

**Documentation Claims:** [CLAIMED IN DOCS: docs/slovak-integration-catalog.md:L15-L17]
- Generali: "Export položkového zoznamu úkonov, podaných liekov a klinickej správy s pečiatkou lekára"
- Union: "Lekárska správa a rozpad nákladov pre preplatenie majiteľovi"

**Code Reality:** [INFERRED]
- No Generali-specific or Union-specific code found in codebase
- Only PetExpert integration is implemented
- The `routers/extensions/insurance.ts` file only contains PetExpert logic

**Conclusion:** Generali and Union integrations are **marketing claims** without implementation. The PetExpert HTML report could theoretically be adapted for these insurers, but no specific export logic exists.

### C.3 Database Schema

**Tables:** [VERIFIED: packages/db/schema/insurance.ts:L1-L100]

1. **insurance_policies**
   - practiceId (FK → practices)
   - clientId (FK → clients)
   - patientId (FK → patients)
   - providerName (varchar 255)
   - policyNumber (varchar 128)
   - groupNumber (varchar 128)
   - phoneNumber (varchar 32)
   - coverageType (varchar 128)
   - deductible (numeric 10,2)
   - coveragePercent (integer)
   - maxAnnualBenefit (numeric 10,2)
   - effectiveDate (date)
   - expirationDate (date)
   - notes (text)
   - Indexes: practiceId+deletedAt, patientId, clientId

2. **insurance_claims**
   - practiceId (FK → practices)
   - policyId (FK → insurance_policies)
   - invoiceId (FK → invoices, optional)
   - claimNumber (varchar 128)
   - status (enum: draft, submitted, in_review, approved, denied, paid)
   - claimAmount (numeric 10,2)
   - approvedAmount (numeric 10,2)
   - deniedReason (text)
   - submittedAt (timestamp)
   - resolvedAt (timestamp)
   - notes (text)
   - Indexes: practiceId+deletedAt, policyId, status

---

## D. Docs-vs-Reality Pass

### D.1 Documentation Claims

| # | Claim | Source | Reality | Verdict |
|---|-------|--------|---------|---------|
| 1 | "PetExpert Slovensko priame vysporiadanie" | [CLAIMED IN DOCS: README.md:L100] | Implemented in code | ✅ **TRUE** |
| 2 | "validácia zmluvy, výpočet 10% spoluúčasti, minimálny odpočet 35 €" | [CLAIMED IN DOCS: README.md:L100] | Implemented in `validatePetExpertEligibility` | ✅ **TRUE** |
| 3 | "generovanie poistnej udalosti a PDF reportu" | [CLAIMED IN DOCS: README.md:L100] | HTML report implemented, not PDF | ⚠️ **PARTIALLY TRUE** |
| 4 | "Generali Poistka Zvierat — Štruktúrovaný PDF / CSV export" | [CLAIMED IN DOCS: docs/slovak-integration-catalog.md:L15] | No Generali-specific code found | ❌ **FALSE** |
| 5 | "Union Poisťovňa — Štruktúrovaný PDF / CSV export" | [CLAIMED IN DOCS: docs/slovak-integration-catalog.md:L16] | No Union-specific code found | ❌ **FALSE** |
| 6 | "Automatické overenie poistky online cez PetExpert API webhooky" (v0.7) | [CLAIMED IN DOCS: README.md:L105] | Not implemented (planned for v0.7) | ✅ **TRUE (future)** |
| 7 | "Priame API napojenie na Generali a Union" (v1.0) | [CLAIMED IN DOCS: README.md:L110] | Not implemented (planned for v1.0) | ✅ **TRUE (future)** |
| 8 | "14 poistných udalostí spracovaných v demo prostredí" | [CLAIMED IN DOCS: README.md:L135] | Cannot verify (simulated data) | ⚠️ **UNVERIFIED** |
| 9 | "live API integrácia s produkčnými credentials neprebehla" | [CLAIMED IN DOCS: README.md:L135] | Confirmed in GAP analysis | ✅ **TRUE** |

### D.2 Discrepancies

1. **PDF vs HTML Report:**
   - **Docs claim:** "generovanie poistnej udalosti a PDF reportu" [CLAIMED IN DOCS: README.md:L100]
   - **Reality:** Only HTML report is generated [VERIFIED: apps/web/lib/insurance/petexpert.ts:L147-L250]
   - **Impact:** Minor — HTML can be printed to PDF, but no native PDF generation

2. **Generali/Union Support:**
   - **Docs claim:** "Implementované (v0.6)" for both Generali and Union [CLAIMED IN DOCS: docs/slovak-integration-catalog.md:L15-L17]
   - **Reality:** No implementation found in code
   - **Impact:** **Major** — Marketing materials claim functionality that doesn't exist

3. **Claim Status "lost":**
   - **Docs:** Not mentioned
   - **Code:** Test file references "lost" status [VERIFIED: apps/web/server/__tests__/insurance-safety.test.ts:L450]
   - **Reality:** "lost" is not in the enum [VERIFIED: packages/db/schema/insurance.ts:L10-L17]
   - **Impact:** Test is checking invalid status rejection (correct behavior)

---

## E. Friction / "Doesn't Make Sense" Notes

### E.1 Architectural Friction

1. **Duplicate Insurance Routers:**
   - **Issue:** Two separate insurance routers exist:
     - `apps/web/server/routers/insurance.ts` (generic)
     - `apps/web/server/routers/extensions/insurance.ts` (PetExpert-specific)
   - **Friction:** Confusing naming, unclear which router handles what
   - **Recommendation:** Merge into single router with clear method naming (e.g., `insurance.petexpert.checkEligibility`)

2. **PetExpert Claim Number Generation:**
   - **Code:** `const claimNumber = `PETEXP-${Date.now().toString().slice(-8)}`` [VERIFIED: apps/web/server/routers/extensions/insurance.ts:L160]
   - **Issue:** Uses timestamp (not guaranteed unique under high concurrency)
   - **Risk:** Potential duplicate claim numbers
   - **Recommendation:** Use UUID or database sequence

3. **Hardcoded VAT Rate:**
   - **Code:** `vatRate: 20` [VERIFIED: apps/web/server/routers/extensions/insurance.ts:L175]
   - **Issue:** Hardcoded 20% VAT, not configurable
   - **Risk:** Incorrect for reduced VAT items (e.g., medications at 10%)
   - **Recommendation:** Pull VAT rate from invoice item or product catalog

4. **Missing Policy Expiration Enforcement:**
   - **Code:** Policy expiration is checked in PetExpert eligibility [VERIFIED: apps/web/lib/insurance/petexpert.ts:L73-L78]
   - **Issue:** Not enforced in generic `createClaim` router
   - **Risk:** Claims can be created against expired policies via generic router
   - **Recommendation:** Add expiration check to `insuranceRouter.createClaim`

### E.2 Business Logic Friction

1. **Co-Pay Calculation Edge Cases:**
   - **Code:** Co-pay cannot exceed claim amount [VERIFIED: apps/web/lib/insurance/petexpert.ts:L90-L92]
   - **Issue:** If deductible > claim amount, co-pay = claim amount, insurer coverage = 0
   - **Example:** Claim = 20€, deductible = 35€ → co-pay = 20€, insurer pays 0€
   - **Question:** Is this the intended behavior? Should there be a minimum claim amount?

2. **Claim Status Transition Rigidity:**
   - **Code:** Strict state machine [VERIFIED: apps/web/server/routers/insurance.ts:L20-L27]
   - **Issue:** Cannot transition from "denied" back to "in_review" (e.g., for appeals)
   - **Risk:** Inflexible for real-world insurance workflows
   - **Recommendation:** Add "appealed" status or allow denied → in_review transition

3. **Missing Claim Amount Recalculation:**
   - **Issue:** If invoice items change after claim creation, claim amount is not updated
   - **Risk:** Claim amount may not match actual invoice total
   - **Recommendation:** Add validation or auto-recalculation on invoice update

4. **No Bulk Claim Operations:**
   - **Issue:** Cannot batch-update claim statuses (e.g., mark all "submitted" as "in_review")
   - **Friction:** Manual work for high-volume clinics
   - **Recommendation:** Add bulk status update endpoint

### E.3 User Experience Friction

1. **No Policy Search/Filter:**
   - **Code:** `listPolicies` only filters by patientId [VERIFIED: apps/web/server/routers/insurance.ts:L247-L293]
   - **Issue:** Cannot search by provider name, policy number, or date range
   - **Friction:** Difficult to find specific policies in large practices
   - **Recommendation:** Add search/filter parameters

2. **No Claim Attachment Support:**
   - **Issue:** Cannot attach documents (vet reports, receipts) to claims
   - **Friction:** Requires external document management
   - **Recommendation:** Add claim attachments table and upload endpoint

3. **No Email Notification:**
   - **Issue:** No automatic email to client when claim is submitted/approved/denied
   - **Friction:** Manual communication required
   - **Recommendation:** Add email notification service

4. **No Client Portal Insurance View:**
   - **Issue:** Clients cannot view their insurance policies or claims via portal
   - **Friction:** Clients must call clinic for insurance status
   - **Recommendation:** Add insurance section to client portal

---

## F. Proposed User-Manual Section(s)

### F.1 Insurance Module Overview

**Target Audience:** Veterinarians, Front Desk Staff  
**Estimated Length:** 2-3 pages

#### Section Structure:

1. **Introduction to Pet Insurance in OpenVPM**
   - What is direct settlement (priame vysporiadanie)
   - Supported insurers (PetExpert, Generali, Union)
   - Benefits for clinic and client

2. **Managing Insurance Policies**
   - Creating a new policy
     - Required fields: provider name, client, patient
     - Optional fields: policy number, coverage type, deductible, coverage %, effective/expiration dates
   - Editing a policy
   - Viewing policy list
   - Understanding policy validation rules
     - Effective date must be before expiration date
     - Client and patient must belong to same practice

3. **Creating Insurance Claims**
   - When to create a claim
   - Linking claim to invoice
   - Claim status workflow
     - Draft → Submitted → In Review → Approved/Denied → Paid
   - Auto-set timestamps (submittedAt, resolvedAt)
   - Claim resolution rules
     - Approved claims require positive approved amount
     - Denied claims require denial reason
     - Approved amount cannot exceed claim amount

4. **PetExpert Integration (Slovak Market)**
   - What is PetExpert
   - Eligibility requirements
     - Valid policy number (min 4 characters)
     - Microchipped pet (15 digits, ISO 11784/11785)
     - Active policy (not expired)
     - Species: canine/feline preferred
   - Co-pay calculation
     - Standard: 10% co-pay, minimum 35€
     - Example: 500€ claim → 50€ co-pay (10%), 450€ insurer coverage
     - Example: 200€ claim → 35€ co-pay (minimum), 165€ insurer coverage
   - Creating a PetExpert claim
     - Step-by-step workflow
     - Required information: diagnosis, treatment summary, incident date
     - Optional: invoice linkage
   - Understanding the output
     - JSON payload (for API submission)
     - HTML report (for printing)
   - Direct settlement consent
     - What it means
     - How it affects payment flow

5. **Claim Status Management**
   - Understanding each status
     - Draft: Initial claim, not yet submitted
     - Submitted: Sent to insurer, awaiting review
     - In Review: Insurer is evaluating the claim
     - Approved: Insurer agreed to pay
     - Denied: Insurer rejected the claim
     - Paid: Insurer has paid the clinic
   - Transition rules
     - Which transitions are allowed
     - Why some transitions are blocked
   - Recording claim outcomes
     - Setting approved amount
     - Recording denial reason
     - Adding notes

6. **Troubleshooting Common Issues**
   - "Policy not found" error
     - Check practice scope
     - Check policy is not deleted
   - "Patient not found" error
     - Check patient belongs to client
     - Check patient is not deleted
   - "Cannot change claim status" error
     - Review allowed transitions
     - Check current claim status
   - "Approved amount cannot exceed claim amount" error
     - Verify claim amount
     - Check approved amount input
   - Microchip validation failure
     - Verify 15-digit format
     - Check for leading/trailing spaces

7. **Best Practices**
   - Always verify eligibility before creating claim
   - Link claims to invoices when possible
   - Add detailed notes for denied claims
   - Keep policy information up-to-date
   - Communicate claim status to clients

### F.2 Quick Reference Card

**Target Audience:** Front Desk Staff  
**Format:** 1-page PDF

#### Content:

**Insurance Policy Creation Checklist:**
- [ ] Client selected
- [ ] Patient selected
- [ ] Provider name entered
- [ ] Policy number (if available)
- [ ] Effective date set
- [ ] Expiration date set (if known)
- [ ] Coverage % entered (default 90%)
- [ ] Deductible entered (default 35€)

**PetExpert Claim Creation Checklist:**
- [ ] Policy exists and is active
- [ ] Pet has 15-digit microchip
- [ ] Diagnosis text ready (min 2 chars)
- [ ] Treatment summary ready (min 5 chars)
- [ ] Incident date set (YYYY-MM-DD)
- [ ] Invoice linked (optional)
- [ ] Client consent for direct settlement

**Claim Status Quick Guide:**
```
Draft → Submitted → In Review → Approved → Paid
                                → Denied
```

**Co-Pay Calculation Examples:**
| Claim Amount | Co-Pay (10%) | Minimum | Final Co-Pay | Insurer Pays |
|--------------|--------------|---------|--------------|--------------|
| 100€         | 10€          | 35€     | 35€          | 65€          |
| 300€         | 30€          | 35€     | 35€          | 265€         |
| 500€         | 50€          | 35€     | 50€          | 450€         |
| 1000€        | 100€         | 35€     | 100€         | 900€         |

### F.3 Video Tutorial Outline

**Target Audience:** New users  
**Estimated Length:** 10-15 minutes

#### Script Outline:

1. **Introduction (1 min)**
   - Welcome to OpenVPM Insurance Module
   - What you'll learn: policies, claims, PetExpert

2. **Creating an Insurance Policy (3 min)**
   - Navigate to patient record
   - Click "Add Insurance Policy"
   - Fill in provider details
   - Set coverage parameters
   - Save and verify

3. **Creating a Standard Claim (3 min)**
   - Navigate to claims list
   - Click "New Claim"
   - Select policy
   - Enter claim amount
   - Link to invoice (optional)
   - Save as draft

4. **PetExpert Claim Workflow (5 min)**
   - Verify eligibility
   - Enter diagnosis and treatment
   - Link to invoice
   - Review co-pay calculation
   - Generate claim report
   - Print HTML report

5. **Managing Claim Status (2 min)**
   - Update claim to "submitted"
   - Move to "in review"
   - Approve or deny
   - Record payment

6. **Common Issues & Solutions (1 min)**
   - Policy not found
   - Microchip validation
   - Status transition errors

7. **Conclusion (30 sec)**
   - Recap key points
   - Where to get help

---

## Appendix: Technical Reference

### A.1 Database Schema Reference

**insurance_policies table:**
```sql
CREATE TABLE insurance_policies (
  id UUID PRIMARY KEY,
  practice_id UUID NOT NULL REFERENCES practices(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  provider_name VARCHAR(255) NOT NULL,
  policy_number VARCHAR(128),
  group_number VARCHAR(128),
  phone_number VARCHAR(32),
  coverage_type VARCHAR(128),
  deductible NUMERIC(10,2),
  coverage_percent INTEGER,
  max_annual_benefit NUMERIC(10,2),
  effective_date DATE,
  expiration_date DATE,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX insurance_policies_practice_idx ON insurance_policies(practice_id, deleted_at);
CREATE INDEX insurance_policies_patient_idx ON insurance_policies(patient_id);
CREATE INDEX insurance_policies_client_idx ON insurance_policies(client_id);
```

**insurance_claims table:**
```sql
CREATE TABLE insurance_claims (
  id UUID PRIMARY KEY,
  practice_id UUID NOT NULL REFERENCES practices(id),
  policy_id UUID NOT NULL REFERENCES insurance_policies(id),
  invoice_id UUID REFERENCES invoices(id),
  claim_number VARCHAR(128),
  status claim_status NOT NULL DEFAULT 'draft',
  claim_amount NUMERIC(10,2) NOT NULL,
  approved_amount NUMERIC(10,2),
  denied_reason TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE TYPE claim_status AS ENUM ('draft', 'submitted', 'in_review', 'approved', 'denied', 'paid');

CREATE INDEX insurance_claims_practice_idx ON insurance_claims(practice_id, deleted_at);
CREATE INDEX insurance_claims_policy_idx ON insurance_claims(policy_id);
CREATE INDEX insurance_claims_status_idx ON insurance_claims(status);
```

### A.2 API Reference

**tRPC Endpoints:**

1. `insurance.listPolicies(input: { patientId?: string })`
   - Returns: Array of policies with client/patient details
   - Access: All authenticated users

2. `insurance.createPolicy(input: PolicyInput)`
   - Input: clientId, patientId, providerName, + optional fields
   - Returns: Created policy
   - Access: admin, front_desk

3. `insurance.updatePolicy(input: PolicyUpdateInput)`
   - Input: id, + fields to update
   - Returns: Updated policy
   - Access: admin, front_desk

4. `insurance.listClaims(input: { status?, policyId?, limit, offset })`
   - Returns: { items: Claim[], total: number }
   - Access: All authenticated users

5. `insurance.createClaim(input: ClaimInput)`
   - Input: policyId, claimAmount, + optional fields
   - Returns: Created claim
   - Access: admin, front_desk

6. `insurance.updateClaimStatus(input: { id, status, approvedAmount?, deniedReason?, notes? })`
   - Returns: Updated claim
   - Access: admin, front_desk

**Extension Endpoints (PetExpert):**

1. `insurance.checkEligibility(input: { policyId, patientId, claimAmount })`
   - Returns: { eligible, errors, warnings, estimatedCoPay, estimatedInsurerCoverage }
   - Access: admin, veterinarian, technician, front_desk

2. `insurance.createClaim(input: PetExpertClaimInput)`
   - Input: policyId, patientId, claimAmount, incidentDate, diagnosisText, treatmentSummary, + optional fields
   - Returns: { claim, eligibility, payload, printableHtml }
   - Access: admin, veterinarian, technician, front_desk

### A.3 Test Coverage

**Safety Tests:** [VERIFIED: apps/web/server/__tests__/insurance-safety.test.ts]
- 880+ lines of test code
- Covers:
  - Policy date validation
  - Policy text/money validation
  - Tenant ownership validation
  - Claim status transitions
  - Claim resolution validation
  - Optimistic locking
  - Trimming behavior

**PetExpert Tests:** [VERIFIED: apps/web/lib/insurance/__tests__/petexpert.test.ts]
- Eligibility validation
- Co-pay calculation
- Microchip validation

---

## Summary

### Key Findings

1. **Core Functionality:** ✅ Fully implemented
   - Policy management (CRUD)
   - Claims management (CRUD + status workflow)
   - Multi-tenant security (practice-scoped)
   - PetExpert integration (eligibility + claim creation)

2. **Documentation Gaps:** ⚠️ Significant
   - Generali/Union integrations claimed but not implemented
   - PDF export claimed but only HTML implemented
   - Missing user documentation

3. **Production Readiness:** ❌ Not ready
   - No live PetExpert API credentials
   - No production testing evidence
   - No bulk operations for high-volume clinics

4. **Code Quality:** ✅ Good
   - Comprehensive test coverage
   - Proper validation and error handling
   - Multi-tenant security enforced

### Recommendations

1. **Immediate (v0.6):**
   - Remove Generali/Union claims from documentation
   - Clarify PDF vs HTML report in docs
   - Add user manual sections (see F.1-F.3)

2. **Short-term (v0.7):**
   - Implement live PetExpert API integration
   - Add policy search/filter functionality
   - Add claim attachment support
   - Add email notifications

3. **Long-term (v1.0):**
   - Implement Generali/Union integrations
   - Add bulk claim operations
   - Add client portal insurance view
   - Add native PDF generation

---

**Document Version:** 1.0  
**Last Updated:** 2026-09-12  
**Next Review:** 2026-09-26
