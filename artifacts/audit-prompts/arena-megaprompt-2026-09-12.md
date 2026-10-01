# OpenVPM AI — Arena.ai Megaprompt (2026-09-12)

> **Repo root:** `C:\Users\marek\Documents\Vet\openvpm-ai`
> **Anchor commit:** `23f23a3`
> **Prior art (read FIRST):**
> - `artifacts/feature-map-2026-09-12/FEATURE-INDEX.md` — 430 features, 17 domains, 24 collisions
> - `artifacts/feature-map-2026-09-12/REORGANIZATION-FINDINGS.md` — 16 findings (5 High, 7 Medium, 4 Low)
> - `artifacts/feature-map-2026-09-12/USER-MANUAL-PROPOSAL.md` — 80+ manual sections, persona matrix
> - `artifacts/feature-map-2026-09-12/domains/*.md` — per-domain audit files (A–F sections each)
>
> **Ground rules for every agent:**
> - Read the relevant domain file(s) FIRST. Do not re-derive findings from scratch.
> - Tag every claim: `[VERIFIED: path:Lnn]` / `[INFERRED]` / `[ASPIRATIONAL]`
> - Do NOT modify `packages/`, existing `docs/`, `README.md`, `ROADMAP.md`, or `CLAUDE.md` unless explicitly instructed.
> - Write only to the locations specified per task.
> - Preserve all existing comments and docstrings unrelated to your changes.
> - Do NOT fabricate file paths or function names — if you can't find something, say so.

---

## AGENT 1 — BUG FIXES (Critical + High severity)

You are a senior TypeScript/Next.js engineer. Your mission is to fix the **critical and high-severity bugs** found in the OpenVPM AI codebase audit.

Read these files before touching any code:
- `artifacts/feature-map-2026-09-12/REORGANIZATION-FINDINGS.md` (full)
- `artifacts/feature-map-2026-09-12/domains/ai-agent.md` §C, §E
- `artifacts/feature-map-2026-09-12/domains/i18n-localization.md` §E
- `artifacts/feature-map-2026-09-12/domains/inventory-pharmacy.md` §E3, §B1

Then fix the following issues **in this order**, committing after each:

---

### BUG-1 [CRITICAL]: Broken agent context role injection [AI-COLLISION-1]
**Location:** `apps/web/server/routers/agent.ts` and/or `apps/web/lib/agent/`
**Finding:** All 26 AI agent tools are inoperable in production due to broken context injection.
**Task:**
1. Read `domains/ai-agent.md` §C, §E for the exact diagnosis.
2. Find the broken injection point.
3. Fix the role context injection so agent tools receive the correct `ctx.session.user.role` value.
4. Add a unit test covering the fix.

---

### BUG-2 [CRITICAL]: Drug safety checker false-negative risk [AI-COLLISION-2]
**Location:** `apps/web/lib/ai/` or `apps/web/server/routers/agent.ts`
**Finding:** Drug safety checker may miss dangerous drug interactions.
**Task:**
1. Read `domains/ai-agent.md` §C for the diagnosis.
2. Fix the false-negative condition.
3. Add a test case with a known dangerous drug combination that should trigger a warning.

---

### BUG-3 [CRITICAL]: REST API foreign key syntax error [AI-COLLISION-3]
**Location:** `apps/web/app/api/v1/`
**Finding:** A REST API endpoint has a foreign key syntax error causing runtime failures.
**Task:**
1. Read `domains/integrations-api.md` §D for the exact endpoint and error.
2. Fix the FK constraint syntax.
3. Verify with a quick integration test or curl command.

---

### BUG-4 [HIGH]: Marketing content generation bypasses billing gates [Finding #9, AI-COLLISION-4]
**Location:** `apps/web/server/routers/extensions/marketing.ts` and `apps/web/lib/ai/alibaba-proxy.ts`
**Finding:** `generatePostVisual`, `generatePostContent`, `generateImage`, `submitVideo` have NO rate limiting and NO billing entitlement checks. A single user can exhaust AI API budget.
**Task:**
1. Read `domains/ai-agent.md` §C.3, §E6 and `domains/marketing-communications.md` §C.2.
2. Add `readHostedAiAccess` billing check (same pattern as agent runner) to all 4 endpoints before calling the Alibaba proxy.
3. Apply per-practice rate limiting: 20 calls/minute, same as agent runner.
4. Return a `402 Payment Required` with a clear error message if the check fails.

---

### BUG-5 [HIGH]: 12 missing i18n keys — hardcoded Slovak for all users [Finding #7, I18N-COLLISION-1]
**Location:** `apps/web/messages/sk.json`, `apps/web/messages/en.json`
**Finding:** 12 of 19 custom-nav i18nKeys are missing from both dictionaries. When missing, the hardcoded Slovak `label` fallback is shown to ALL users regardless of language setting.
**Task:**
Add the following keys to BOTH `sk.json` and `en.json`:

| i18nKey | Slovak value | English value |
|---|---|---|
| `nav.marketingPlan` | Plán obsahu | Content Plan |
| `nav.marketingHandouts` | Letáky | Handouts |
| `nav.marketingMessages` | Správy & SMS | Messages & SMS |
| `nav.marketingWebsite` | Web kliniky | Clinic Website |
| `nav.waitingRoomTv` | Čakáreň TV | Waiting Room TV |
| `nav.marketingAutomations` | Automatizácie | Automations |
| `nav.marketingConsents` | Súhlasy & skripty | Consents & Scripts |
| `nav.marketingWellness` | Wellness balíčky | Wellness Packages |
| `nav.remoteSupport` | Vzdialená Podpora | Remote Support |
| `nav.adminSupport` | Admin Podpora | Admin Support |
| `nav.collapseMenu` | Zbaliť menu | Collapse menu |
| `nav.expandMenu` | Rozbaliť menu | Expand menu |

After adding, verify that `apps/web/config/custom-nav.ts` references these keys correctly via `t(item.i18nKey, item.label)`.

---

### BUG-6 [HIGH]: PDF sanitizeForPdf() strips Slovak diacritics [I18N-COLLISION-5]
**Location:** Likely `apps/web/lib/` — search for `sanitizeForPdf` function
**Finding:** The sanitization function converts č→c, š→s, ä→a, ž→z, etc., stripping all Slovak diacritics from exported PDFs.
**Task:**
1. Find `sanitizeForPdf()`.
2. Determine whether the stripping is due to font encoding limitation (WinAnsi) or an overly aggressive replace call.
3. If font limitation: switch to a Unicode-compatible font (e.g., Helvetica replacement with full Latin Extended-A support, or embed a custom font).
4. If aggressive replace: remove or narrow the character substitution to only characters truly unsupported by the target encoder.
5. Test with a PDF export containing: `č, š, ž, ý, á, í, ä, ú, ô, ľ, ĺ, ŕ, ń, ď, ť`.

---

### BUG-7 [MEDIUM]: Wellness nav label misleads users [Finding #2, WELLNESS-COLLISION-1]
**Location:** `apps/web/config/custom-nav.ts`
**Finding:** Nav item "Wellness balíčky" points to `/marketing/wellness` which only shows **benefit redemption tracking**, not wellness plan management (which lives in Settings). The label implies plan management.
**Task:**
1. In `custom-nav.ts`, change the label for the `/marketing/wellness` nav item from `"Wellness balíčky"` to `"Čerpanie benefitov"`.
2. Update the i18nKey if one is used (add `nav.wellnessRedemptions` to sk.json and en.json: SK: `"Čerpanie benefitov"`, EN: `"Benefit Redemptions"`).
3. Move the nav item from the Marketing section to either the Clinical section or create a new "Preventive Programs" section — read `wellness.md` §E for the rationale.

---

### BUG-8 [MEDIUM]: Portal session timeout with no self-service recovery [Finding #16]
**Location:** `apps/web/lib/portal/` and portal session middleware
**Finding:** After 30-minute idle timeout, clients are locked out with no recovery path — they need a new bootstrap token from staff (which is already consumed). No "still there?" warning exists.
**Task:**
1. Read `domains/clients-portal.md` §E9, §B for exact constants.
2. Add a client-side idle warning at `PORTAL_SESSION_IDLE_TTL_MS - 5min` (25 minutes) that prompts "Still there? Click to extend your session."
3. On confirm: make a lightweight tRPC call (`portal.extendSession`) to reset the idle timer server-side.
4. Extend `PORTAL_SESSION_IDLE_TTL_MS` from 30 to 60 minutes.

---

### BUG-9 [LOW]: Branding leak — "VET.IS Cloud" string [Finding #6]
**Location:** `apps/web/lib/platform-admin.ts` and `apps/web/app/(dashboard)/admin/page.tsx`
**Finding:** The string `"VET.IS Cloud"` appears in 2 files. Official branding is `"VET.IS"`.
**Task:** Replace all occurrences of `"VET.IS Cloud"` with `"VET.IS"` in both files.

---

### BUG-10 [LOW]: Auth token TTL inconsistency [Finding #14]
**Location:** `apps/web/lib/auth-tokens.ts` lines 10–13
**Finding:** Password reset TTL is 1 hour — too short for veterinary practitioners who may be with animals and check email infrequently.
**Task:** Change `password_reset` TTL from `1h` to `4h`. Do not change other TTLs.

---

## AGENT 2 — FEATURE COMPLETION (Medium priority)

You are a senior TypeScript/Next.js/tRPC/Drizzle engineer. Your mission is to complete **partially built features** identified in the audit. Read the relevant domain files before writing any code.

---

### FEAT-1: Wire up wholesaler delivery-note import [Finding #13, INVENTORY-COLLISION-1]
**Prior art:** `artifacts/feature-map-2026-09-12/domains/inventory-pharmacy.md` §B.1, §E3

**Context:** A robust 10-wholesaler delivery-note parser (`apps/web/lib/inventory/wholesaler-import.ts`, 418 LoC) exists with 10+ test cases and auto-detection for Cymedica, Pharmos, Samohýl, Henry Schein, Biopharm, Komvet, SG-Vet (XML), Sanvet, Phramed, and Generic CSV. The parser handles Slovak decimal commas and DD.MM.YYYY dates.

**The schema is already ready:** `products` table has `externalSource`, `externalId`, `importFingerprint` (SHA-256, unique index) columns.

**Missing pieces:**
1. A tRPC mutation `inventory.importDeliveryNote(file: File): ImportResult` that:
   - Accepts a multipart upload or base64 string
   - Calls the existing parser (`autoDetectAndParse()`)
   - Returns a dry-run preview (parsed rows, detected wholesaler, SKU matches vs new items)
   - On confirm: upserts products using `importFingerprint` for deduplication
2. An upload button + preview table in the inventory dashboard (`apps/web/app/(dashboard)/inventory/page.tsx`)
3. A loading state during parse + a confirm/cancel step before committing (satisfying the README claim "Every import shows a dry run first")
4. Update ROADMAP.md: change the wholesaler import checkbox from `[x]` to reflect "parser ✅, integration ✅ (after this PR)"

---

### FEAT-2: Add real-time whiteboard via SSE [Finding #15]
**Prior art:** `artifacts/feature-map-2026-09-12/domains/scheduling-front-desk.md` §E1

**Context:** Whiteboard currently uses `refetchInterval: 30000` (30s polling). UI shows a misleading pulsing green dot labelled "Auto-refreshes every 30s". Two staff can act on the same patient simultaneously within the 30s window.

**Task:**
1. Create an SSE endpoint `GET /api/whiteboard/stream` that streams whiteboard state changes.
2. Use Drizzle's change detection or a simple in-memory pub/sub (if no Supabase Realtime) to push events.
3. Replace `useQuery` with `refetchInterval` in the whiteboard component with an SSE client hook (`useWhiteboardStream`).
4. Update the UI label from "Auto-refreshes every 30s" to "Live" (with the pulsing green dot retained).
5. Apply the same SSE pattern to portal messaging (`clients-portal.md` §E6).

---

### FEAT-3: Complete KVEPIS B2G transport layer [Findings #5, #11]
**Prior art:** `artifacts/feature-map-2026-09-12/domains/statutory-compliance.md` §B, §C

**Context:** The KVEPIS submission pipeline is complete through DRAFT → VALIDATED → SIGNED → SUBMITTED lifecycle. However, `submitSubmission` only records a local timestamp and synthetic MessageID — no actual HTTP call to ŠVPS SR is made. The data model is ready; only the transport is missing.

**Task:**
1. Read `statutory-compliance.md` §C for the exact stubbed function and expected API contract.
2. Implement the actual HTTPS POST to ŠVPS SR's B2G endpoint (URL from environment variable `KVEPIS_B2G_URL`).
3. Handle the response: on success, store the official MessageID returned by ŠVPS SR; on failure, transition to an `ERROR` state with the error body stored in `lastError`.
4. Add an environment variable `KVEPIS_REAL_MODE=false` — when false, the existing simulation runs (safe for dev/demo); when true, real transport is used.
5. Update the statutory compliance page to show a clear "⚠️ Simulation mode — not connected to ŠVPS SR" banner when `KVEPIS_REAL_MODE=false`.

---

### FEAT-4: Rename visit-treatment-plans → treatment-estimates [Finding #10]
**Prior art:** `artifacts/feature-map-2026-09-12/domains/core-clinical.md` §E1

**Context:** `visit_treatment_plans` is architecturally unrelated to `treatment_plans` (longitudinal care plans). The name creates genuine confusion — new developers expect them to be related. `visit_treatment_plans` is actually a client-facing treatment estimate/proposal with SHA-256 sealed revisions.

**Task:**
1. Create a Drizzle migration renaming `visit_treatment_plans` table to `treatment_estimates`.
2. Update the router from `visit-treatment-plans.ts` to `treatment-estimates.ts`.
3. Update all imports and references throughout `apps/web/`.
4. Update the tRPC router key in `_app.ts` from `visitTreatmentPlans` to `treatmentEstimates`.
5. Preserve all existing functionality — this is a pure rename.
6. Update any UI labels that reference "visit treatment plan" to "treatment estimate" or "treatment proposal".

---

### FEAT-5: Disclose simulated integrations in UI [Finding #11]
**Prior art:** `artifacts/feature-map-2026-09-12/domains/statutory-compliance.md` §E, `domains/insurance.md` §C2

**Context:** Several integrations are simulated but not disclosed to users:
- KVEPIS B2G: synthetic MessageID, no real ŠVPS SR connection (see FEAT-3)
- CRSZ lookup: `lookupCrszOnline()` uses prefix-based simulation, never contacts real registry
- KEP signing: modeled as enum values, no actual signing integration
- Generali/Union insurance: claimed in docs, no code exists
- e-Kasa: not formally certified by FR SR

**Task:**
1. Add a `SimulationBadge` component that renders a yellow ⚠️ pill with tooltip text.
2. Display it on:
   - KVEPIS submission screen when `KVEPIS_REAL_MODE=false`
   - CRSZ lookup result when returned from simulation
   - Insurance module header for Generali/Union integrations
3. In the insurance module, add a clearly marked "Available integrations" section distinguishing: ✅ PetExpert (implemented), 🔜 Generali (planned v0.8), 🔜 Union (planned v0.8).
4. Do NOT change any backend logic — UI disclosure only.

---

## AGENT 3 — USER MANUAL (English)

You are a senior technical writer specializing in veterinary practice management software. Your mission is to write the **English version of the user manual** for OpenVPM AI.

**Read before writing:**
- `artifacts/feature-map-2026-09-12/USER-MANUAL-PROPOSAL.md` (full — this is your IA blueprint)
- `artifacts/feature-map-2026-09-12/domains/*.md` — §F sections contain per-domain outlines
- Existing `docs/help/*.md` files — match their style (short, task-oriented, 1–2 minute reads)

**Output location:** `docs/help/en/` (create the directory)

**Style rules:**
- Match the style of existing `docs/help/your-day.md` and `docs/help/client-portal.md`
- Task-oriented: "How to X" not "X is a feature that..."
- Short: 200–400 words per page maximum
- Use the actual English UI label for every button/tab/menu item (verify in `messages/en.json`)
- When a feature is NOT live yet (ASPIRATIONAL), add a callout: `> **Coming soon:** This feature is planned for a future release.`
- When an integration is simulated, add: `> **Note:** This integration is currently in guided/simulation mode. Live connectivity is planned.`

**Write these pages (priority order):**

### Tier 1 — Critical gaps (zero coverage today)

1. `docs/help/en/billing-invoices.md` — Creating, editing, voiding invoices; marking as paid; payment methods
   *(Source: `domains/billing-finance.md` §F, sections 1–2)*

2. `docs/help/en/billing-ekasa.md` — e-Kasa compliance for Slovak fiscal law; daily closure; export
   *(Source: `domains/billing-finance.md` §F, section 3; note: not FR SR certified — include disclosure)*

3. `docs/help/en/auth-getting-started.md` — First login, creating a practice, inviting staff, roles & permissions
   *(Source: `domains/auth-onboarding.md` §F, sections 1–4 + 8)* 

4. `docs/help/en/auth-demo-mode.md` — Demo/evaluation account access, role switching
   *(Source: `domains/auth-onboarding.md` §F, section 6)*
5. `docs/help/en/inventory-stock.md` — Managing products, stock levels, reorder points
   *(Source: `domains/inventory-pharmacy.md` §F.1)*

6. `docs/help/en/inventory-controlled-substances.md` — Controlled drug wasting, witness signatures, audit log
   *(Source: `domains/inventory-pharmacy.md` §F.2 — flag as regulatory-reference format)*

7. `docs/help/en/reports-overview.md` — Navigating reports, date ranges, export formats
   *(Source: `domains/reports.md` §F, sections 1 + 8)*

8. `docs/help/en/marketing-care-reminders.md` — Setting up automated recall, vaccination due, follow-up reminders
   *(Source: `domains/marketing-communications.md` §F)*

9. `docs/help/en/admin-settings-overview.md` — 13-tab Settings overview; Guides viewer (confirmed IMPLEMENTED); quick start walkthroughs
   *(Source: `domains/admin-settings.md` §F.1–F.2)*

10. `docs/help/en/wellness-plans.md` — Creating wellness plans, enrolling clients, tracking redemptions
    *(Source: `domains/wellness.md` §F; clarify: plan setup = Settings tab, redemptions = /marketing/wellness)*

### Tier 2 — Extension of existing coverage

11. `docs/help/en/soap-notes.md` — Writing SOAP notes, templates, finalize, addendum, correction
    *(Source: `domains/core-clinical.md` §F.1)*

12. `docs/help/en/prescriptions.md` — Creating prescriptions, safety checks, refills
    *(Source: `domains/core-clinical.md` §F.4)*

13. `docs/help/en/lab-results.md` — Uploading lab results, linking to patient, reference ranges, AI flags
    *(Source: `domains/lab-imaging.md` §F)*

14. `docs/help/en/insurance-module.md` — Adding a pet insurance policy, creating a claim, tracking status
    *(Source: `domains/insurance.md` §F.1; note: PetExpert only, Generali/Union planned)*

15. `docs/help/en/api-keys.md` — Creating API keys, rotation, webhook setup
    *(Source: `domains/integrations-api.md` §F)*

### Tier 3 — Statutory (reference format, not quick guide)

16. `docs/help/en/statutory-kvepis.md` — KVEPIS B2G submission workflow; **include transparency section** from Finding #11
    *(Source: `domains/statutory-compliance.md` §F, sections 2 + 7)*

17. `docs/help/en/statutory-crsz.md` — CRSZ animal registration, PetPass; **include simulation disclosure**
    *(Source: `domains/statutory-compliance.md` §F, section 5)*

---

## AGENT 4 — USER MANUAL (Slovak)

You are a senior technical writer specializing in veterinary practice management software. Your mission is to write the **Slovak version of the user manual** for OpenVPM AI.

**Read before writing:**
- Everything Agent 3 reads (same sources)
- `artifacts/feature-map-2026-09-12/domains/i18n-localization.md` §E — language strategy findings
- Existing `docs/help/*.md` — note: these are English prose; your SK pages will REPLACE the mental translation gap

**Output location:** `docs/help/sk/` (create the directory)

**Style rules:**
- Mirror Agent 3's pages exactly — same structure, same sections, Slovak prose
- Use the actual Slovak UI label for every button/tab/menu item (verify in `messages/sk.json` and `apps/web/config/custom-nav.ts`)
- When `custom-nav.ts` uses a hardcoded Slovak label (not i18n-keyed), use that exact string — do NOT invent your own translation
- Flag known i18n limitations with: `> **Poznámka:** Tento prvok navigácie je momentálne zobrazený vždy v slovenčine bez ohľadu na nastavenie jazyka.`
- For PDF export pages: always include `> **Obmedzenie:** PDF export momentálne neobsahuje diakritiku (č→c, š→s atď.). Oprava je v príprave.`

**Write the same 17 pages as Agent 3**, with these Slovak filenames:
1. `docs/help/sk/fakturácia-faktúry.md`
2. `docs/help/sk/fakturácia-ekasa.md`
3. `docs/help/sk/začiatok-prvé-prihlásenie.md`
4. `docs/help/sk/začiatok-demo-režim.md`
5. `docs/help/sk/sklad-zásoby.md`
6. `docs/help/sk/sklad-omamné-látky.md`
7. `docs/help/sk/výkazy-prehľad.md`
8. `docs/help/sk/marketing-automatické-pripomienky.md`
9. `docs/help/sk/nastavenia-prehľad.md`
10. `docs/help/sk/wellness-plány.md`
11. `docs/help/sk/klinické-záznamy-soap.md`
12. `docs/help/sk/klinické-záznamy-predpisy.md`
13. `docs/help/sk/lab-výsledky.md`
14. `docs/help/sk/poistenie.md`
15. `docs/help/sk/api-kľúče.md`
16. `docs/help/sk/legislatíva-kvepis.md`
17. `docs/help/sk/legislatíva-crsz.md`

---

## ORCHESTRATION NOTES

These 4 agents can run **fully in parallel** — they touch different parts of the codebase:
- Agent 1 (Bugs): `apps/web/server/`, `apps/web/lib/`, `apps/web/config/custom-nav.ts`, `apps/web/messages/`
- Agent 2 (Features): `apps/web/server/routers/`, `apps/web/app/(dashboard)/`, migrations
- Agent 3 (Docs EN): `docs/help/en/` (new directory, no conflicts)
- Agent 4 (Docs SK): `docs/help/sk/` (new directory, no conflicts)

**Agent 1 caveat:** BUG-5 (i18n keys) and BUG-7 (wellness label) both touch `custom-nav.ts` and `messages/*.json`. If running Agent 2 in parallel, coordinate so Agent 2's FEAT-1 doesn't conflict with Agent 1's i18n changes — run Agent 1 BUG-5 and BUG-7 first, then Agent 2.

**Commit strategy:** Each bug/feature/doc page = 1 atomic commit. Prefix: `fix:`, `feat:`, `docs:`.

---

## SELF-CHECK (for each agent before finalizing)

- [ ] Did you read the domain audit file(s) before writing code/docs?
- [ ] Does every code change have a corresponding test or at minimum a manual verification step?
- [ ] Did you use `[VERIFIED: path:Lnn]` tags where you cite specific code locations?
- [ ] Did you NOT modify `apps/`, `packages/`, existing `docs/`, `README.md`, `ROADMAP.md`, or `CLAUDE.md` beyond what the task explicitly permits?
- [ ] For docs: did you verify every UI label against `messages/sk.json` or `messages/en.json`?
- [ ] Did you carry the MVP/Phase2/simulated distinction — nothing planned documented as live?
