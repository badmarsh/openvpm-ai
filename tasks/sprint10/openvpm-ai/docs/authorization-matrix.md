# OpenVPM AI — Authorization & Role-Based Access Control Matrix

**Document version:** 1.0.0  
**Target Repository:** `badmarsh/openvpm-ai`  
**Date:** 2026-09-09  
**Status:** Canonical Security Reference (Phase 2 Deliverable)  

---

## 1. Overview

OpenVPM AI enforces strict multi-tenant isolation and role-based access control (RBAC).
Security is enforced **server-side** in tRPC procedures, REST route handlers, agent tools, and database Row-Level Security (RLS). UI hiding is treated solely as a UX affordance, never as an authorization boundary.

Every request strictly validates:
1. **Tenant Practice Scope:** Derived exclusively from the authenticated session context (`ctx.practiceId`), never accepted from client payload.
2. **Actor Role:** Verified through `requireRole(...)` procedure middleware or tool execution guards.

---

## 2. Global Role Taxonomy

| Role Identifier | Slovak Description | Scope & Responsibilities |
|---|---|---|
| `admin` | Administrátor / Majiteľ kliniky | Plný prístup k nastaveniam praxe, personálu, účtovníctvu, auditným záznamom. |
| `veterinarian` | Veterinárny lekár (MVDr.) | Plná klinická autorita: finalizácia SOAP, predpisovanie liekov, OPL kniha, rádiológia. |
| `technician` | Veterinárny asistent / sestra | Zadávanie vitálnych funkcií, koncepty záznamov, podávanie ordinovanej liečby. Nesmie predpisovať lieky ani prezerať OPL. |
| `front_desk` | Recepcia | Objednávanie termínov, registrácia klientov a zvierat, príjem platieb, e-Kasa. Nemá prístup k OPL ani medicínskym receptom. |
| `portal_user` | Majiteľ zvieraťa (Klient) | Obmedzený prístup výhradne k vlastným zvieratám, termínom, správam a faktúram cez capability tokeny (`/portal/:token`). |
| `service_cron` | Systémový cron / Job | Vykonáva automatizovanú retenciu audia, upomienky a zálohovanie cez overený Bearer token. |

---

## 3. Domain Permission Matrix

| Domain / Resource | Admin | Veterinarian | Technician | Front Desk | Client Portal | Cron / Service |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Patient Demographics & Signalment** | Full | Full | Read/Write | Read/Write | Own Read | - |
| **Clinical SOAP Notes (Drafts)** | Full | Full | Create/Edit | - | - | - |
| **Clinical SOAP Notes (Finalized)** | Full | Finalize/Addendum | Read | Read (Summary) | Client Summary | - |
| **Medical Prescriptions (Recepty)** | Full | Create/Sign | Read | Read | Own Read | - |
| **Controlled Substances (Kniha OPL)** | Full | Full | ❌ DENIED | ❌ DENIED | ❌ DENIED | - |
| **Statutory Rabies Register (Besnota)** | Full | Full | Read | Read | - | - |
| **Statutory Treatment Diary (Ochranné lehoty)** | Full | Full | Read | - | - | - |
| **Invoices & Billing** | Full | Full | Read | Create/Pay | Own Read | - |
| **e-Kasa Fiscal Receipts (Zákon 289/2008)** | Full | Full | - | Issue/Print | - | Retry Cron |
| **DICOM / Medical Imaging Viewing** | Full | Full | Full | - | - | - |
| **AI Imaging Analysis (Multimodal / VHS)** | Full | Review/Sign | Read | - | - | - |
| **AI Voice Dictation & Scribe** | Full | Dictate/Finalize | Dictate Draft | - | - | Purge Cron |
| **Raw Voice Audio Blobs (GDPR 24h)** | Temporary | Temporary | Temporary | ❌ DENIED | ❌ DENIED | 24h Purge |
| **AI Audit Trail (`ext_ai_audit_log`)** | Read / Verify | Read (Own) | ❌ DENIED | ❌ DENIED | ❌ DENIED | Verify CLI |
| **Practice Settings & Staff Management** | Full | Read | - | - | - | - |
| **Agent Write Tools (`book_appointment`, etc.)** | If enabled | If enabled | ❌ DENIED | ❌ DENIED | - | - |
| **Agent OPL Tool (`get_controlled_substances_log`)** | Allowed | Allowed | ❌ DENIED | ❌ DENIED | ❌ DENIED | - |
| **Agent Prescription Tool (`create_prescription`)** | Allowed | Allowed | ❌ DENIED | ❌ DENIED | ❌ DENIED | - |

---

## 4. Enforcement Points

1. **tRPC Router Procedures:**
   - Enforced via `protectedProcedure.use(requireRole("admin", "veterinarian"))`.
2. **Agent Tools:**
   - Enforced in `execute(args, ctx)` via `ctx.userRole` checks throwing standardized Slovak/English access denial exceptions.
3. **Database Row-Level Security (Postgres RLS):**
   - Enforced via `packages/db/rls/enable-rls.sql` with session variable `app.current_practice_id`.
   - Tested live in `packages/db/test-rls.ts`.
