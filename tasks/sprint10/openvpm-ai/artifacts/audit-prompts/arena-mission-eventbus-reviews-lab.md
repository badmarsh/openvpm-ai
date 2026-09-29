# Autonomous Arena Agent Mission Briefing: Event Bus Processing, AI Review Copilot & Lab Analyte Trends

> **Target Repository:** `https://github.com/badmarsh/openvpm-ai.git`
> **Base Branch:** `main`
> **Mission Objective:** Complete Phase 3 of the OpenVPM AI Autopilot: (1) Live Event Bus Queue & Worker UI in `/marketing/automations`, (2) Reputation Management AI Review Copilot in `/marketing/reviews`, and (3) Lab Results Slovak i18n & Analyte Trend Visualization in `/lab-results`.

---

## 1. System Identity & Mission Context

You are an elite autonomous full-stack software engineer and veterinary clinical informatics specialist. You are working on **OpenVPM AI**, the leading open-source veterinary practice management system (PMS) tailored for European and Slovak veterinary clinics.

In this mission, you will build and integrate three high-value capabilities:
1. **Automation Event Bus Queue & Worker Control (`/marketing/automations`):**
   - Expose the durable event bus (`ext_automation_events`) with real-time status metrics (`pending`, `processing`, `processed`, `failed`).
   - Add a "Spracovať frontu" (Process Queue Now) action in `automationEventsRouter` calling `pollAndProcess(ctx.db)` with toast feedback.
   - Add an interactive "Simulovať udalosť" (Simulate Event) modal allowing clinic administrators to trigger sample events (`appointment_no_show`, `vaccine_due`, `post_operative_care`, `wellness_enrolled`) and verify rule execution and suppression logs in real time.
2. **Reputation Management & AI Review Copilot (`/marketing/reviews`):**
   - Connect the reviews inbox to an AI response generator adhering to the Slovak Veterinary Chamber (KVL SR) ethical code (empathetic, professional, no medical liability, inviting private resolution for negative feedback).
   - Add sentiment classification badges (Pozitívna, Neutrálna, Negatívna / Eskalácia).
   - Add filters for rating (1–5★), platform (Google Business, Facebook, Interné), and status (Čaká na odpoveď, Zodpovedané).
   - Enable one-click copy and approval of generated responses with audit logging.
3. **Lab Results Slovak i18n Localization & Analyte Trend Tracking (`/lab-results`):**
   - Audit and localize `apps/web/app/(dashboard)/lab-results/page.tsx` and `components/lab/analyzer-import-panel.tsx` to 100% Slovak i18n symmetry (eliminating all hardcoded English strings like "Action required", "Critical", "Not recorded").
   - Add longitudinal analyte trend tracking (e.g. Creatinine, Urea, ALT, Glucose, Leukocytes) displaying historical values across patient visits.
   - Enforce the mandatory Veterinarian Sign-off Gate (Zákon 39/2007 Z. z. §3): AI-parsed lab drafts must require veterinarian review before final commitment to the clinical record.

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
   - **Unconditional Sympathy Gate:** Deceased patients (`patient.status === 'deceased'`) MUST unconditionally suppress all automated reviews, marketing, and reminders.
   - **Human-in-the-Loop:** Clinical assertions require veterinary review before commitment.
   - **Controlled Substances:** ZERO AI prefill for Schedule I/II narcotics.

---

## 3. Detailed Work Breakdown

### Task 1: Event Bus Queue & Worker Control (`/marketing/automations`)
- **Location:** `apps/web/server/routers/extensions/automation-events.ts`, `apps/web/app/(dashboard)/marketing/automations/page.tsx`
- **Specification:**
  - In `automationEventsRouter`:
    - Add `getQueueMetrics` returning counts of `pending`, `processing`, `processed`, `failed` events and stuck claims count (> 5 min in processing).
    - Add `processQueueNow` (role: admin, veterinarian) which runs `pollAndProcess(ctx.db)` and returns the count of processed events and any errors.
    - Add `simulateEvent` accepting `eventType`, `patientId`, `clientId`, and mock payload, inserting into `extAutomationEvents` and returning the evaluation outcome.
  - In `/marketing/automations` UI:
    - Add an "Udalosti & Zbernica" (Event Bus) sub-tab or card section.
    - Display live status chips: Čakajúce (Pending), Spracovávané (Processing), Spracované (Processed), Zlyhané (Failed).
    - "Spracovať frontu teraz" button with spin animation, disabled state while running, and toast summary.
    - Expandable list of recent events with eventType badge, timestamp, dedupeKey, status badge, and payload JSON drawer/dialog.

### Task 2: AI Review Copilot & Reputation Suite (`/marketing/reviews`)
- **Location:** `apps/web/server/routers/extensions/marketing.ts` (or `apps/web/server/routers/extensions/reputation.ts`), `apps/web/app/(dashboard)/marketing/reviews/page.tsx`
- **Specification:**
  - Add procedure `generateReviewReply` taking `reviewId`, `rating`, `reviewText`, `clientName`, and returning an AI draft tailored for veterinary clinic reputation:
    - 4-5 stars: Warm gratitude, recognizing patient/client loyalty, inviting next preventive visit.
    - 1-3 stars: Empathetic acknowledgment, non-defensive apology, commitment to clinical quality, offering a direct private call/email with the clinic manager without discussing confidential medical details publicly.
  - In `/marketing/reviews` UI:
    - Sentiment badge per review (`Pozitívne`, `Neutrálne`, `Eskalácia`).
    - "Generovať AI odpoveď" button opening an inline response drawer/editor with the generated draft.
    - "Kopírovať a označiť za vybavené" action saving the approved response to the review record.
    - Filter bar: Rating (1-5★), Platform (Google, Facebook, Web formulár), Reply status (Čaká na odpoveď / Vybavené).

### Task 3: Lab Results Slovak i18n & Analyte Trend Tracking (`/lab-results`)
- **Location:** `apps/web/app/(dashboard)/lab-results/page.tsx`, `apps/web/components/lab/analyzer-import-panel.tsx`, `apps/web/server/routers/extensions/lab-import.ts`
- **Specification:**
  - Audit and clean all hardcoded English strings in `lab-results/page.tsx` (replace with `t("labResults.inboxFilter...", "...")`).
  - Add `getPatientAnalyteHistory` in `labImportRouter` querying previous values for common parameters (Kreatinín, Močovina, ALT, ALP, Glukóza, Leukocyty) for a given `patientId`.
  - In the lab results view or modal, show a visual trend indicator (e.g. `↑ 145 µmol/l vs 110 µmol/l naposledy`, or mini sparkline) highlighting abnormal/critical shifts.
  - Ensure the KVL Veterinarian Sign-off confirmation modal is active before an imported protocol is committed to the medical record.

---

## 4. Verification Protocol & Quality Gates

Before submitting your PR, verify all four quality gates:

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
pnpm --filter @openpims/web test
```

Deliver your work with clean conventional commits (`feat(automations): ...`, `feat(reviews): ...`, `feat(lab): ...`).
