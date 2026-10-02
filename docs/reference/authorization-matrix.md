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

Roly sú definované v `apps/web/lib/authorization.ts:30-36` (`AgentUserRole`) a zrkadlia sa
v `UserRole` v `apps/web/server/trpc.ts`. Kto nie je v tejto tabuľke, nie je staff rola.

| Role Identifier | Slovak Description | Scope & Responsibilities | Kód |
|---|---|---|---|
| `admin` | Administrátor / Majiteľ kliniky | Plný prístup k nastaveniam praxe, personálu, účtovníctvu, auditným záznamom. | `authorization.ts:39` |
| `veterinarian` | Veterinárny lekár (MVDr.) | Plná klinická autorita: finalizácia SOAP, predpisovanie liekov, OPL kniha, rádiológia. | `authorization.ts:40` |
| `technician` | Veterinárny asistent / sestra | Zadávanie vitálnych funkcií, koncepty záznamov, podávanie ordinovanej liečby. Nesmie predpisovať lieky, upravovať SOAP draft ani diktovať hlasom; nesmie čítať OPL. | `authorization.ts:41` |
| `front_desk` | Recepcia | Objednávanie termínov, registrácia klientov a zvierat, príjem platieb, e-Kasa. Nemá prístup k OPL ani medicínskym receptom. | `authorization.ts:42` |
| `viewer` | Read-only účet | Prístup výhradne na čítanie. `requireRole` ho prijíma len tam, kde je to explicitne uvedené (napr. `records.searchPatientHistory`). Všetky mutácie odmieta. | `authorization.ts:43` |
| `service_agent` | Systémový servisný účet | Reserved pre budúce automatizované workflow. Dnes nepoužíva `requireRole` guard. | `authorization.ts:44` |

**Čo v tejto tabuľke nie je a prečo:**

- `portal_user` — **neexistuje ako rola**. Klient pristupuje cez capability tokeny
  (`/portal/[token]`), nie cez rolu v `UserRole`. `authorization.ts` to vypovedá priamo:
  *"Portal users, cron/service accounts, and unauthenticated traffic are NOT staff roles
  and are denied by every helper in this module."* Overené testom
  `lib/__tests__/authorization.test.ts:59` („denies legacy role 'service_cron'").
- `service_cron` — **neexistuje**. Cron úlohy nie sú staff rola; bežia cez oddelené
  route handlery s vlastnou autentifikáciou, napr. `app/api/cron/ekasa-retry/route.ts`.

---

## 3. Domain Permission Matrix

Stĺpce `Client Portal` a `Cron / Service` z predchodnej verzie boli odstránené — zodpovedajú
rolám, ktoré v kóde neexistujú. Portál a cron sú **kanály**, nie roly.

| Domain / Resource | Admin | Veterinarian | Technician | Front Desk | Viewer |
|---|:---:|:---:|:---:|:---:|:---:|
| **Patient Demographics & Signalment** | Full | Full | Read/Write | Read/Write | Read |
| **Clinical SOAP Notes (Drafts)** | Full | Full | ❌ DENIED | ❌ DENIED | ❌ DENIED |
| **Clinical SOAP Notes (Finalized)** | Full | Finalize/Addendum | Read | Read (Summary) | Read |
| **Medical Prescriptions (Recepty)** | Full | Create/Sign | Read | Read | Read |
| **Controlled Substances (Kniha OPL)** | Full | Full | ❌ DENIED | ❌ DENIED | ❌ DENIED |
| **Statutory Rabies Register (Besnota)** | Full | Full | Read | Read | Read |
| **Statutory Treatment Diary (Ochranné lehoty)** | Full | Full | Read | - | Read |
| **Invoices & Billing** | Full | Full | Read | Create/Pay | Read |
| **e-Kasa Fiscal Receipts (Zákon 289/2008)** | Full | Full | - | Issue/Print | - |
| **DICOM / Medical Imaging Viewing** | Full | Full | Full | - | Read |
| **AI Imaging Analysis (Multimodal / VHS)** | Full | Review/Sign | Read | - | - |
| **AI Voice Dictation & Scribe** | Full | Dictate/Finalize | ❌ DENIED | ❌ DENIED | ❌ DENIED |
| **Raw Voice Audio Blobs (GDPR 24h)** | Temporary | Temporary | Temporary | ❌ DENIED | ❌ DENIED |
| **AI Audit Trail (`ext_ai_audit_log`)** | Read / Verify | Read (Own) | ❌ DENIED | ❌ DENIED | ❌ DENIED |
| **Practice Settings & Staff Management** | Full | Read | - | - | - |
| **Agent Write Tools (`book_appointment`, etc.)** | If enabled | If enabled | ❌ DENIED | ❌ DENIED | ❌ DENIED |
| **Agent OPL Tool (`get_controlled_substances_log`)** | Allowed | Allowed | ❌ DENIED | ❌ DENIED | ❌ DENIED |
| **Agent Prescription Tool (`create_prescription`)** | Allowed | Allowed | ❌ DENIED | ❌ DENIED | ❌ DENIED |

### Odchýlky od striktnej matice (zdôvodnené)

| Riadok | Odchýlka | Dôvod |
|---|---|---|
| Prescription Create/Sign | `technician` má Read, nie sign | `PRESCRIPTION_ROLES = ["admin","veterinarian"]` (`authorization.ts:65`) |
| OPL register | `technician` úplne odmietnutý | `CS_LOG_ROLES = ["admin","veterinarian"]` (`authorization.ts:70`) |
| AI finalizácia | `technician` iba Read | `CLINICAL_ROLES = ["admin","veterinarian"]` (`authorization.ts:60`) |
| Search patient history | `viewer` má prístup | `records.ts:1341` — `requireRole("admin","veterinarian","technician","viewer")` |

### Kľúčové body vynútenia (overené v kóde)

| Tvrdenie | Kde je to naozaj vynútené |
|---|---|
| Technician **nemôže** uložiť SOAP draft | `apps/web/server/routers/records.ts:1750-1751` — `saveSoapDraft` používa `requireRole("admin","veterinarian")` |
| Technician **nemôže** diktovať hlasom | `apps/web/server/routers/extensions/voice.ts:46-47` — `voiceProcedure` používa `requireRole("admin","veterinarian")` |
| Predpisovanie je len admin/veterinár | `apps/web/lib/authorization.ts:65-69` — `PRESCRIPTION_ROLES` |
| OPL kniha je len admin/veterinár | `apps/web/lib/authorization.ts:70-74` — `CS_LOG_ROLES` |
| Legacy role sa odmietajú | `apps/web/lib/__tests__/authorization.test.ts:59` |
| `viewer` je read-only | `apps/web/server/trpc.ts:501` — `type === "mutation" && role === "viewer"` blokuje mutáciu globálne (aj pre `autonomousProcedure`, `trpc.ts:681`) |

---

## 4. Enforcement Points

1. **tRPC Router Procedures:**
   - Enforced via `protectedProcedure.use(requireRole("admin", "veterinarian"))`.
2. **Agent Tools:**
   - Enforced in `execute(args, ctx)` via `ctx.userRole` checks throwing standardized Slovak/English access denial exceptions.
3. **Database Row-Level Security (Postgres RLS):**
   - Enforced via `packages/db/rls/enable-rls.sql` with session variable `app.current_practice_id`.
   - Tested live in `packages/db/test-rls.ts`.
