# OpenVPM AI — Agent Tool Security & Authorization Matrix

**Document Version:** 1.0.0  
**Date:** 2026-09-09  
**Sprint:** 9.3 Correctness Closure  
**Target Repository:** `badmarsh/openvpm-ai`  
**Operating Contract:** `.agents/skills/openvpm-ai/SKILL.md`  

---

## 1. Architectural Overview & Threat Model

The OpenVPM AI Agent is an assistive clinical and operational agent operating inside a multi-tenant veterinary practice environment.

### Core Principles
1. **Assistive, Never Autonomous Clinical Authority:** The agent cannot finalize clinical SOAP notes, sign prescriptions, approve diagnostic imaging, modify controlled substance logs, or alter immutable medical evidence.
2. **Server-Enforced, Fail-Closed Tool Authorization:** Every tool invocation verifies `ctx.userRole` using `assertAgentRole()` from `apps/web/lib/authorization.ts`. Missing, null, whitespace, unknown, or unauthorized roles are denied immediately before executing any database or model operation.
3. **Strict Tenant Isolation:** `ctx.practiceId` and `ctx.userId` are derived exclusively from the authenticated NextAuth server session context. Tools NEVER accept `practiceId`, `userId`, or role overrides from model tool arguments.
4. **Least-Privilege Role Scoping:** Privileged writes (prescriptions, vitals, bookings) and sensitive data access (OPL register, financial billing, statutory registries) are restricted to authorized roles (`veterinarian`, `admin`, `technician`, or `front_desk` as appropriate). The `viewer` role and unauthenticated callers are rejected for all domain operations.
5. **No Blind Trust of External Input:** IDs, timestamps, and parameters from model output are validated with strict Zod schemas and verified against tenant-scoped database records (`eq(table.practiceId, ctx.practiceId)`).

---

## 2. Complete Agent Tool Inventory

| # | Tool Name | Mode | Affected Resource | Sensitivity Category | Permitted Roles | Clinician Confirmation Required? | External Side Effects? | Enforcement Point | Test Coverage | Residual Risk |
|---|---|:---:|---|---|---|:---:|:---:|---|---|---|
| 1 | `find_client` | Read | `clients` | Client PII | `admin`, `veterinarian`, `front_desk`, `technician` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low (Name/phone PII lookup) |
| 2 | `find_patient` | Read | `patients` | Patient Demographics | `admin`, `veterinarian`, `front_desk`, `technician` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low |
| 3 | `get_patient_summary` | Read | `patients`, `soapNotes`, `prescriptions`, `vitalSigns` | Comprehensive Clinical Record | `admin`, `veterinarian`, `technician` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low (Clinical record read) |
| 4 | `list_locations` | Read | `locations` | Clinic Infrastructure | `admin`, `veterinarian`, `front_desk`, `technician` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low |
| 5 | `list_appointments` | Read | `appointments` | Clinic Schedule | `admin`, `veterinarian`, `front_desk`, `technician` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low |
| 6 | `find_open_slots` | Read | `appointments`, `rooms`, `users` | Schedule Availability | `admin`, `veterinarian`, `front_desk`, `technician` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low |
| 7 | `book_appointment` | **Write** | `appointments` | Operational / Scheduling Write | `admin`, `veterinarian`, `front_desk` | No (staff action) | Webhook dispatch after commit | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low (Scheduling lock prevents double booking) |
| 8 | `list_overdue_vaccinations` | Read | `vaccinationRecords` | Preventive Care Records | `admin`, `veterinarian`, `front_desk`, `technician` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low |
| 9 | `calculate_drug_dose` | Read | Pure Formulary Calculation | Clinical Pharmacology Reference | `admin`, `veterinarian`, `technician` | Mandatory UI verification disclaimer | None | Tool `execute` (`assertAgentRole`) | `dosing-safety.test.ts`, `authorization.test.ts` | Low (Reference range only; disclaimers enforced) |
| 10 | `list_treatment_plans` | Read | `treatmentPlans`, `treatmentPlanItems` | Clinical Treatment Protocols | `admin`, `veterinarian`, `technician` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low |
| 11 | `record_vital_signs` | **Write** | `vitalSigns` | Clinical Observation Write | `admin`, `veterinarian`, `technician` | No (staff data entry) | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low (Clinical inputs validated with range checks) |
| 12 | `query_lab_trends` | Read | `labAnalyzerReports` | Diagnostic Lab Results | `admin`, `veterinarian`, `technician` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low |
| 13 | `check_drug_safety` | Read | Formulary, `patientAllergies` | Clinical Drug Interaction / Contraindication | `admin`, `veterinarian`, `technician` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low |
| 14 | `audit_missed_charges` | Read | `soapNotes`, `invoices`, `invoiceItems` | Financial / Billing Audit | `admin`, `veterinarian` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low |
| 15 | `create_discharge_summary` | Read | `soapNotes`, `prescriptions` | Clinical Summary Generation | `admin`, `veterinarian`, `technician` | Yes (Markdown draft for review) | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low (Does not persist finalized discharge) |
| 16 | `generate_rvps_report` | Read | `extRabiesObservations` | Statutory Regulatory Reporting | `admin`, `veterinarian` | Yes (Attending vet submission) | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low (Official reporting requires signed review) |
| 17 | `check_withdrawal_periods` | Read | `extWithdrawalPeriods` | Statutory Food Safety | `admin`, `veterinarian` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low |
| 18 | `check_rabies_observations` | Read | `extRabiesObservations` | Statutory Disease Surveillance | `admin`, `veterinarian` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low |
| 19 | `verify_microchip_crsz` | Read | `microchipRegistrations` | Statutory Microchip Register | `admin`, `veterinarian`, `front_desk`, `technician` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low |
| 20 | `record_vitals_from_speech` | **Write** | `vitalSigns` | Clinical Observation Write | `admin`, `veterinarian`, `technician` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low (Parsed vitals range-checked before insert) |
| 21 | `get_invoice_summary` | Read | `invoices` | Financial / Billing Ledger | `admin`, `veterinarian`, `front_desk` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low |
| 22 | `list_open_reminders` | Read | `careReminders` | Operational Follow-ups | `admin`, `veterinarian`, `front_desk`, `technician` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low |
| 23 | `get_lab_results` | Read | `labAnalyzerReports` | Diagnostic Lab Results | `admin`, `veterinarian`, `technician` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low |
| 24 | `create_prescription` | **Write** | `prescriptions` | Statutory Prescription Registry (Zákon 362/2011) | `admin`, `veterinarian` | Mandatory Attending Vet Signing | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low (Only vet/admin can prescribe) |
| 25 | `get_controlled_substances_log` | Read | `controlledSubstanceLog` | Statutory Controlled Substances Ledger (OPL) | `admin`, `veterinarian` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low (Strictly restricted to vet/admin) |
| 26 | `list_discharge_reports` | Read | `dischargeReports` | Clinical Discharge Records | `admin`, `veterinarian`, `technician` | No | None | Tool `execute` (`assertAgentRole`) | `authorization.test.ts` | Low |

---

## 3. Defense-in-Depth Mechanisms

1. **Dual Guardrail for Writes:**
   - In `apps/web/lib/agent/runner.ts`: All write tools (`readOnly: false`) are unconditionally blocked unless `opts.allowWrites === true`.
   - Inside each tool's `execute()`: `assertAgentRole()` strictly enforces role authorization.
2. **API Key Scope Verification:**
   - Tools declaring `requiredApiScopes` verify caller scopes in `buildToolSet()`.
3. **Tenant Boundary Assertion:**
   - All SQL queries in tools filter on `eq(table.practiceId, ctx.practiceId)`.
   - Cross-practice entity IDs (e.g. `patientId`, `clientId`, `appointmentId`) return `404 Not Found` or `null`, preventing cross-tenant information leakage.
