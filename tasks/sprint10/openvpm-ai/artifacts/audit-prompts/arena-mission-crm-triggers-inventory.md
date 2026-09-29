# Autonomous Arena Agent Mission Briefing: CRM Segments, Autopilot Triggers & Wholesaler Delivery Import

> **Target Repository:** `https://github.com/badmarsh/openvpm-ai.git`
> **Base Branch:** `main`
> **Mission Objective:** Complete Phase 2 CRM segmentation, wire dormant clinical triggers into the event bus, and build the Wholesaler Delivery Note Import UI.

---

## 1. System Identity & Mission Context

You are an elite autonomous full-stack software engineer and veterinary clinical informatics specialist. You are working on **OpenVPM AI**, the leading open-source veterinary practice management system (PMS) tailored for European and Slovak veterinary clinics.

In this mission, you will address three high-value product gaps:
1. **CRM Veterinary Segmentation Engine & UI:** Materialize and automate the 12 core veterinary patient/client segments (`puppy_kitten`, `senior_pet`, `chronic_patient`, `vip_clients`, `churn_risk`, `unvaccinated_overdue`, `wellness_enrolled`, `dental_attention`, `post_op_recovery`, `frequent_flyer`, `weight_management`, `lapsed_inactive`) with live UI drill-downs in `/marketing/automations`.
2. **Clinical & Administrative Trigger Wiring:** Close the gap on dormant trigger families by emitting events into `extAutomationEvents` for `appointment_no_show`, `vaccine_due`, `wellness_enrolled`, and `post_operative_care`.
3. **Wholesaler Delivery Note Import UI:** Connect the existing backend parser (`wholesalerImportRouter` supporting Cymedica, Pharmos, Samohyl, Henry Schein, Biopharm, Komvet, SG-Vet, Sanvet, Phramed) to a streamlined drag-and-drop import modal in `/inventory` with batch/LOT tracking, margin markup, and stock updates.

---

## 2. Inviolable Architectural Guardrails

All agents working on this codebase MUST strictly follow the guardrails defined in `.agents/skills/openvpm-ai/SKILL.md`:

1. **Zero-Conflict Upstream Sync:**
   - **NEVER** modify existing vanilla schema tables in `packages/db/schema/*.ts`.
   - All new tables, enums, or relations MUST reside in `packages/db/schema/ext_{name}.ts` and be exported in `packages/db/schema/index.ts`.
   - NEVER alter files in `packages/db/drizzle/` or edit `packages/db/drizzle/meta/_journal.json`.
   - Use `pnpm db:bootstrap` (or `pnpm db:push`) for local database synchronization.

2. **Strict Bilingual (SK/EN) 100% Dictionary Symmetry:**
   - Every single new UI text string MUST be translated into both `apps/web/messages/sk.json` AND `apps/web/messages/en.json`.
   - Both files must maintain identical key structures (100% symmetry).
   - NEVER hardcode English or Slovak text directly in JSX — always wrap in `t("key.path", "Fallback")`.

3. **Slovak Veterinary Compliance & Safety:**
   - **Unconditional Sympathy Gate:** Deceased patients (`patient.status === 'deceased'`) MUST unconditionally suppress all automated marketing, reviews, and reminders.
   - **Human-in-the-Loop:** Clinical assertions require veterinary review before commitment.
   - **Controlled Substances:** ZERO AI prefill for Schedule I/II narcotics.

---

## 3. Detailed Work Breakdown

### Task 1: Veterinary CRM Segmentation Engine & UI
- **Location:** `apps/web/lib/autopilot/segmentation-engine.ts`, `apps/web/server/routers/extensions/crm-segments.ts`, `apps/web/app/(dashboard)/marketing/automations/page.tsx`
- **Specification:**
  - Build `recalculateSegments(db, practiceId)` evaluating the 12 veterinary segments based on client spend, appointment history, patient age/species, care reminders, and medical conditions.
  - Expose `trpc.extensions.crmSegments.recalculateAll` and `trpc.extensions.crmSegments.getSegmentMembers({ segmentKey, limit, offset })`.
  - In the `/marketing/automations` UI, enhance the "Segmenty" tab (or add a dedicated sub-view):
    - Display cards/table for each segment: name, description, active client count, last recalculated timestamp.
    - "Prepočítať segmenty" (Recalculate) button with loading state and toast feedback.
    - Clickable drill-down to inspect clients in a selected segment with deep link to `/clients/[id]`.

### Task 2: Complete Event Bus Trigger Emissions
- **Location:** `apps/web/server/routers/appointments.ts`, `apps/web/server/routers/care-reminders.ts`, `apps/web/server/routers/wellness.ts`, `apps/web/server/routers/encounters.ts`
- **Specification:**
  - `appointment_no_show`: When an appointment is marked `no_show` in `appointments.updateStatus` or cancelled with reason `no_show`, emit `appointment_no_show` event into `extAutomationEvents`.
  - `vaccine_due`: In `care-reminders.ts` during reminder sweep, emit `vaccine_due` into `extAutomationEvents` for patients with overdue vaccines (respecting sympathy gate!).
  - `wellness_enrolled`: In `wellness.ts` (or `marketing.enrollWellness`), emit `wellness_enrolled` into `extAutomationEvents`.
  - `post_operative_care`: In `encounters.completeCheckout`, if the encounter contains surgical codes, anesthesia, or post-op instructions, emit `post_operative_care` event into `extAutomationEvents`.
  - Ensure all event emissions use a clean deterministic `dedupeKey` (e.g. `${eventType}_${appointmentId || reminderId}_${Date.now()}`) and fire safely outside the transaction.

### Task 3: Wholesaler Delivery Note Import UI (`/inventory`)
- **Location:** `apps/web/app/(dashboard)/inventory/` (e.g. `components/wholesaler-import-modal.tsx` or `/inventory/page.tsx`)
- **Specification:**
  - Add an "Importovať dodací list" (Import Delivery Note) button to the inventory header.
  - Modal with:
    - Wholesaler selector (Cymedica, Pharmos, Samohyl, Henry Schein, Biopharm, Komvet, SG-Vet, Sanvet, Phramed, Generic CSV).
    - Drag-and-drop file upload (CSV, TXT, PDF text export).
    - Review step table showing: Matched Product, Item Code, Batch/LOT, Expiry Date, Quantity, Unit Purchase Price, Proposed Retail Price (with configurable markup % slider or field), and VAT rate.
    - Ability to search and link unmatched items to existing inventory catalog products.
    - "Potvrdiť a naskladniť" action button calling `trpc.extensions.wholesalerImport.confirmImport`.

---

## 4. Verification Protocol & Quality Gates

Before finishing your run, ensure all quality gates pass:

```bash
# 1. Monorepo dependencies & lockfile integrity
pnpm install --frozen-lockfile

# 2. Database TypeScript type check
pnpm --filter @openpims/db type-check

# 3. Web application TypeScript compilation
pnpm --filter @openpims/web type-check

# 4. 100% Dictionary symmetry test
node -e "const en=require('./apps/web/messages/en.json'); const sk=require('./apps/web/messages/sk.json'); function diff(a,b,p=''){let r=[]; for(let k in a){const np=p?p+'.'+k:k; if(!(k in b)) r.push(np); else if(typeof a[k]==='object' && a[k]!==null && typeof b[k]==='object') r.push(...diff(a[k],b[k],np));} return r;} const mEn=diff(en,sk); const mSk=diff(sk,en); if(mEn.length||mSk.length){console.error('Mismatch!',mEn,mSk);process.exit(1);}else{console.log('Symmetry OK');}"

# 5. Unit and integration test suite
pnpm --filter @openpims/web test config/__tests__/custom-nav-i18n.test.ts server/__tests__/marketing
```

Deliver your work with clean conventional commits (`feat(crm): ...`, `feat(triggers): ...`, `feat(inventory): ...`).
