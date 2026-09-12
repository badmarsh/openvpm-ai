# OpenVPM AI — Reorganization Findings (2026-09-12)

**Commit:** `23f23a3` [VERIFIED: git rev-parse --short HEAD]

This document lists high-impact, cross-domain structural findings that require reorganization — not just documentation. Each finding is verified against the codebase and includes a severity rating, evidence from all 17 domain files, and a suggested fix.

---

## 1. Navigation clustering vs. flat sidebar (Severity: High)

- **Finding:** The current 25-flat-sidebar structure (`apps/web/app/(dashboard)/`) creates cognitive overload for front-desk staff. There is no grouping by role, workflow, or domain — all items sit as peers regardless of frequency of use.
- **Evidence:**
  - `[VERIFIED: scheduling-front-desk.md §E6]` — 3 scheduling sections (`schedule`, `whiteboard`, `waiting-room`) scattered among 25 sidebar directories. These are the most frequently used by front desk but mixed with compliance, inventory, and admin tools.
  - `[VERIFIED: admin-settings.md §E1]` — Settings page is a 5,875-line monolithic file with 13 tabs. The Settings nav item alone aggregates practice info, brand kit, locations, staff, appointment types, rooms, services, data import/export, templates, wellness, messaging, booking, and billing.
  - `[VERIFIED: marketing-communications.md]` — Marketing domain has 13 dashboard routes (`/marketing`, `/marketing/brand-kit`, `/marketing/plan`, `/marketing/reviews`, `/marketing/handouts`, `/marketing/messages`, `/marketing/website`, `/marketing/tv`, `/marketing/automations`, `/marketing/consents`, `/marketing/media`, `/marketing/wellness`, `/marketing/scripts`) all appearing as flat nav items.
  - `[VERIFIED: custom-nav.ts:1-218]` — 19 custom nav items + vanilla nav items, all ungrouped. No section headers or collapsible menus exist.
- **Suggested fix:** Introduce role-based dashboard sections (e.g., `Front Desk`, `Clinical`, `Finance`, `Admin`) with collapsible menus. Group `schedule`, `whiteboard`, `waiting-room` under `Front Desk`; `records`, `encounters`, `vitals` under `Clinical`; `billing`, `reports` under `Finance`.

## 2. Wellness domain collision (Severity: Medium)

- **Finding:** Two separate surfaces share the "wellness" name but serve different purposes, misleading users about where to manage wellness features.
- **Evidence:**
  - `[VERIFIED: wellness.md §E1]` — Core wellness engine (`trpc.wellness.*`) handles plan CRUD (Settings tab), billing (Billing page WellnessBillingPanel), and enrollment (client-detail WellnessEnrollmentPanel). This is the operational wellness system.
  - `[VERIFIED: wellness.md §E1]` — Marketing wellness page (`/marketing/wellness`) is a read-heavy dashboard showing benefit redemption tracking (`redeemWellnessBenefit` / `listWellnessRedemptions` via `trpc.extensions.marketing.*`). This is a usage-tracking surface for logging which benefits a client has used.
  - `[VERIFIED: wellness.md §E1]` — Both share the `wellness_enrollments` table as the join point. The nav label "Wellness balíčky" (custom-nav.ts:L146) implies plan management, but the page only tracks redemptions. Plan management lives in Settings.
  - `[VERIFIED: wellness.md §E7]` — Benefit redemption is a clinical/front-desk operational task, not a marketing activity. The placement under the Marketing nav section was inherited from the marketing extensions router pattern but doesn't match user mental models.
- **Suggested fix:** Move the `/marketing/wellness` route and nav item out of the Marketing section. Relabel "Wellness balíčky" → "Čerpanie benefitov" (Benefit redemption) to accurately reflect the page's purpose. Consider creating a dedicated "Preventive Programs" section or placing it under Clinical.

## 3. e-Kasa architectural split (Severity: High)

- **Finding:** e-Kasa functionality is split across two domains — billing-finance and statutory-compliance — forcing users to switch contexts for one cohesive fiscal workflow.
- **Evidence:**
  - `[VERIFIED: billing-finance.md]` — e-Kasa router (`ext/ekasa`), schema (`ext_ekasa.ts`), dashboard routes (`/billing/ekasa`, `/billing/pos`), and all `lib/ekasa/*` live in the billing/finance domain. Features: receipt issuance, storno, POS sales, daily closures, monthly accountant export.
  - `[VERIFIED: statutory-compliance.md §E]` — The statutory-compliance domain claims e-Kasa alongside KVEPIS/CRSZ/CEHZ under "Slovak Statutory Compliance" because e-Kasa is a statutory requirement under Zákon č. 289/2008 Z.z.
  - `[VERIFIED: billing-finance.md §E]` — Friction note explicitly states: "e-Kasa is fiscal regulation, not veterinary statutory compliance. A user-manual reader looking for e-Kasa could land in either section."
- **Suggested fix:** Create a unified `statutory-billing` domain that anchors e-Kasa's primary documentation in billing-finance (where the code lives), with a statutory-compliance cross-reference section that directs users to the billing domain. User manual should use a single entry point: `/billing/ekasa`.

## 4. Orphaned features (Severity: Medium)

- **Finding:** Several dashboard routes have no discoverable UI path or are only accessible via direct URL, plus unused code artifacts.
- **Evidence:**
  - `[VERIFIED: custom-nav.ts:1-218]` — `inbox` route exists at `apps/web/app/(dashboard)/inbox/page.tsx` but does NOT appear in custom-nav.ts. However, the `/inbox` page IS listed in the marketing-communications domain as feature A.6 (Inbox Dashboard), so the route is functional — just missing from the sidebar.
  - `[VERIFIED: custom-nav.ts:1-218]` — `recalls` route exists at `apps/web/app/(dashboard)/recalls/page.tsx` but does NOT appear in custom-nav.ts. The care-reminders feature (A.7) is at `/care-reminders` — a different route. Recalls remain orphaned.
  - `[VERIFIED: i18n-localization.md §E6]` — Orphan `messages/parts/` directory: 8 JSON files (records-en.json, records-sk.json, schedule-en.json, schedule-sk.json, track1-en.json, track1-sk.json, track3-en.json, track3-sk.json) totaling ~356 KB. No `.ts/.tsx/.js` file references `messages/parts/`. Unused artifacts from a prior modular catalog experiment.
  - `[VERIFIED: inventory-pharmacy.md §E3, B.1]` — Wholesaler delivery-note import: 10-parser library exists (`lib/inventory/wholesaler-import.ts`, 418 LoC) with 10+ test cases, but zero server wiring, zero UI integration, and zero code populating the import-ready columns (`externalSource`, `externalId`, `importFingerprint`) on the products table. The ROADMAP checkbox overstates completion.
- **Suggested fix:** (a) Add nav items for `inbox` and `recalls` to custom-nav.ts, or remove the orphaned routes. (b) Delete `messages/parts/` directory (unused, 356 KB). (c) Either complete the wholesaler import server-side integration (tRPC endpoint + UI upload button) or update ROADMAP to reflect parser-only status.

## 5. Phantom features — claimed but not implemented (Severity: Low)

- **Finding:** Multiple features are documented/marketed as implemented but exist only as stubs, simulated data, or marketing claims without code.
- **Evidence:**
  - `[VERIFIED: insurance.md §C2]` — Generali and Union insurance integrations: docs claim "Export položkového zoznamu úkonov" (Generali) and "Lekárska správa a rozpad nákladov" (Union), but no Generali-specific or Union-specific code exists in the codebase. Only PetExpert is implemented. These are marketing claims without implementation.
  - `[VERIFIED: lab-imaging.md §C]` — DICOM PACS: README lists "DICOM PACS cloudové úložisko snímok" as a feature of the Cloud Nemocnica tier (229 €/month), but only client-side DICOM parsing exists (`lib/imaging/dicom-parser.ts`). No DICOM store, C-STORE SCP, Query/Retrieve, or Worklist. Original 16-bit pixel data is discarded after client-side PNG conversion.
  - `[VERIFIED: lab-imaging.md §C]` — Lab API integrations (IDEXX, Antech, Zoetis): `lib/lab-integration.ts` defines a `LabProvider` interface with `submitOrder`, `checkStatus`, `getResults` methods, but only `in_house` is functional. All external providers throw `LabProviderNotConfiguredError`. These are stubs only.
  - `[VERIFIED: statutory-compliance.md §B]` — KVEPIS B2G: The submission router fully models the DRAFT → VALIDATED → SIGNED → SUBMITTED lifecycle but `submitSubmission` only records a local timestamp and synthetic MessageID. No actual HTTP calls to ŠVPS SR. Full pipeline exists except the transport layer.
  - `[VERIFIED: statutory-compliance.md §C]` — CRSZ online lookup: `lookupCrszOnline()` returns simulated data based on chip prefix matching. Slovak-coded chips (prefix "703") always report "REGISTERED" in simulated mode. Never contacts an external registry.
- **Suggested fix:** Update README/ROADMAP to accurately reflect implementation status. Remove or clearly mark unimplemented features. For insurance, document that only PetExpert HTML report generation exists — Generali/Union integrations are planned, not implemented.

## 6. Branding/naming leaks (Severity: Low)

- **Finding:** The string `"VET.IS Cloud"` appears in `apps/web/lib/platform-admin.ts` and `apps/web/app/(dashboard)/admin/page.tsx`, but the official branding is now `VET.IS` (per project/memory name-change-openvpm-to-vet-is.md).
- **Evidence:** `[VERIFIED: apps/web/lib/platform-admin.ts:L24, apps/web/app/(dashboard)/admin/page.tsx:L108]`
- **Suggested fix:** Replace all instances of `"VET.IS Cloud"` with `"VET.IS"` across the codebase.

## 7. i18n key gaps — 12/19 custom-nav items missing translations (Severity: High)

- **Finding:** 12 of 19 custom-nav i18nKeys are missing from both `sk.json` and `en.json`. When keys are missing, the hardcoded Slovak `label` fallback is shown to ALL users regardless of their language setting — breaking the translation system for these items.
- **Evidence:**
  - `[VERIFIED: i18n-localization.md §E1]` — Missing keys table (all missing from both dictionaries):

| i18nKey | Hardcoded Slovak label (shown to everyone) |
|---|---|
| `nav.marketingPlan` | Plán obsahu |
| `nav.marketingHandouts` | Letáky |
| `nav.marketingMessages` | Správy & SMS |
| `nav.marketingWebsite` | Web kliniky |
| `nav.waitingRoomTv` | Čakáreň TV |
| `nav.marketingAutomations` | Automatizácie |
| `nav.marketingConsents` | Súhlasy & skripty |
| `nav.marketingWellness` | Wellness balíčky |
| `nav.remoteSupport` | Vzdialená Podpora |
| `nav.adminSupport` | Admin Podpora |
| `nav.collapseMenu` | Zbaliť menu |
| `nav.expandMenu` | Expand menu |

  - `[VERIFIED: custom-nav.ts:1-218]` — All 19 items declare both `label` and `i18nKey`. Sidebar resolves via `t(item.i18nKey, item.label)`, so missing keys always show the Slovak fallback.
- **Impact:** English-speaking users see hardcoded Slovak navigation labels for 63% of custom nav items. The i18n system provides no coverage for these items.
- **Suggested fix:** Run `scripts/i18n-add-keys.mjs` with entries for all 12 missing keys (Slovak + English translations).

## 8. Records router monolith — 4,878 lines (Severity: High)

- **Finding:** The `records.ts` router is a single 4,878-line file handling SOAP notes, vaccinations, problem list, prescriptions, lab results, procedures, and patient history search — all in one module. This is 2× larger than the next biggest router.
- **Evidence:**
  - `[VERIFIED: core-clinical.md §E2]` — `records.ts` covers 6+ distinct clinical domains. Compare with `encounters.ts` (2,596 lines), `templates.ts` (1,212 lines), `vitals.ts` (212 lines), `treatment-plans.ts` (~350 lines), `visit-treatment-plans.ts` (~850 lines).
  - `[VERIFIED: core-clinical.md §A]` — The router handles: patient history search, SOAP note CRUD/draft/finalize/correction/addendum, vaccinations (create/list/certificate/error), problem list, prescriptions (create/lifecycle/safety/refill), lab results (create/complete/review), and procedures.
- **Impact:** Single file is hard to navigate, creates merge conflicts, and couples unrelated clinical domains. No logical separation between prescribing and lab results, for example.
- **Suggested fix:** Split into `soap.ts`, `vaccinations.ts`, `prescriptions.ts`, `lab-results.ts`, `procedures.ts`, `problems.ts` following the pattern already used for `vitals.ts` and `treatment-plans.ts`.

## 9. Marketing generation bypasses billing gates (Severity: High)

- **Finding:** Marketing content generation (`generatePostVisual`, `generatePostContent`, `generateImage`, `submitVideo`) has no rate limiting and no billing entitlement checks. Users can generate unlimited AI images and videos without cost control.
- **Evidence:**
  - `[VERIFIED: ai-agent.md §C.3]` — "Marketing Media Generation: No rate limiting, no billing entitlement checks" — contrast with the agent runner which has 20 runs/minute per actor and 120/minute per practice limits.
  - `[VERIFIED: ai-agent.md §E6]` — `generatePostVisual` (Alibaba image generation) and `generatePostContent` contain no calls to `readHostedAiAccess` or any billing gate. The Alibaba proxy (`alibaba-proxy.ts`) is invoked directly without checking whether the practice has AI access entitlement.
  - `[VERIFIED: marketing-communications.md §C.2]` — Image generation uses Wanx 2.1 Turbo, video uses Wan 2.1 Turbo — both external API calls with per-call costs. No rate limiting or budget enforcement.
- **Impact:** Unlimited AI image/video generation without cost control. A single user could exhaust AI API budget or trigger rate limits at the provider level.
- **Suggested fix:** Add `readHostedAiAccess` billing check to marketing generation endpoints (`generatePostVisual`, `generatePostContent`, `generateImage`, `submitVideo`). Apply the same per-practice rate limiting used by the agent runner.

## 10. Treatment plans vs. visit-treatment-plans naming confusion (Severity: Medium)

- **Finding:** Two fundamentally different concepts with nearly identical naming create genuine confusion for developers and documentation readers.
- **Evidence:**
  - `[VERIFIED: core-clinical.md §E1]` — `treatment_plans` (longitudinal clinical care planning, patient-level, links to `problem_list`, items have free-text description + clinical statuses) vs. `visit_treatment_plans` (visit-scoped client-facing treatment estimate/presentation, links to `appointments` + `clients`, sealed immutable revisions with SHA-256 hashing, client-facing accept/decline/signature flow).
  - `[VERIFIED: core-clinical.md §E1]` — `treatment-plans.ts` is ~350 lines; `visit-treatment-plans.ts` is ~850 lines with a separate `policy.ts`. They share no code, no schema, and no workflow. A new developer would expect `visit-treatment-plans` to be a subset or extension of `treatment-plans` — they are architecturally unrelated.
- **Suggested fix:** Rename `visit-treatment-plans` to `treatment-estimates` or `client-treatment-proposals` throughout (routers, tables, docs). This eliminates the semantic collision while preserving the domain accuracy.

## 11. Simulated integrations not disclosed to users (Severity: Medium)

- **Finding:** The codebase uses honest internal variable names (`isRegisteredSimulated`, schema comments about "Fáza 2") but user-facing docs, help content, and README/marketing materials do not disclose that these integrations are simulated or incomplete.
- **Evidence:**
  - `[VERIFIED: statutory-compliance.md §E]` — KVEPIS B2G transport is stubbed (local-only, synthetic MessageID). CRSZ lookup is simulated (prefix-based, not real API). KEP signing is modeled as enum values (`NONE`, `DSIGNER`, `CLOUD_SEAL`, `HSM`) but no actual KEP signing integration exists.
  - `[VERIFIED: statutory-compliance.md §E]` — Code is honest: `isRegisteredSimulated` variable name, schema comment "Fáza 2 (priamy B2G konektor cez ÚPVS bránu s mandátnym certifikátom KEP) nadviaže na rovnaký dátový model", router comment about Phase 1 vs Phase 2.
  - `[VERIFIED: insurance.md §C2]` — Generali/Union integrations claimed in docs but not verified in code.
- **Impact:** Users (veterinarians, compliance officers) may assume these integrations are live and operational, which could cause issues during regulatory audits or when attempting to submit to actual government systems.
- **Suggested fix:** Add a "Current limitations" transparency section in the user manual (statutory-compliance.md §F.7 already proposes this). Disclose: KVEPIS is GUIDED mode only (no live B2G), CRSZ lookup is simulated, KEP signing is modeled but not integrated, e-Kasa is not formally certified by FR SR, Generali/Union integrations are planned.

## 12. Dental charting misclassified as statutory (Severity: Low)

- **Finding:** Dental charting is a purely clinical feature with no Slovak law requiring digital dental charts. It is listed under the statutory-compliance domain but lives in the clinical extensions.
- **Evidence:**
  - `[VERIFIED: statutory-compliance.md §E]` — "Dental charting is a clinical records feature (FDI tooth notation, conditions, treatments). It is NOT statutory — there is no Slovak law requiring digital dental charts."
  - `[VERIFIED: statutory-compliance.md §A]` — Router at `ext/dental`, library at `lib/records/dental.ts`, NOT under the `/statutory` dashboard. The inclusion in this domain appears to be a scoping error in the audit prompt.
- **Suggested fix:** Move dental documentation from statutory-compliance domain to core-clinical domain. The dental feature (FDI notation, conditions, treatments) belongs with other clinical records (SOAP notes, problem list, etc.).

## 13. Wholesaler import parser exists but disconnected (Severity: Medium)

- **Finding:** A robust 10-parser wholesaler delivery-note library (418 LoC) with 10+ test cases exists but has zero server-side wiring, zero UI integration, and zero code populating the import-ready database columns.
- **Evidence:**
  - `[VERIFIED: inventory-pharmacy.md §B.1, §E3]` — Parser at `lib/inventory/wholesaler-import.ts` supports Cymedica, Pharmos, Samohýl, Henry Schein, Biopharm, Komvet, SG-Vet (XML!), Sanvet, Phramed, and Generic CSV. Auto-detection, Slovak decimal comma support (`14,50` → `14.50`), DD.MM.YYYY date parsing.
  - `[VERIFIED: inventory-pharmacy.md §E3]` — No tRPC endpoint for uploading/parsing delivery notes. No import button in the inventory dashboard. No mutation that creates products from parsed delivery notes.
  - `[VERIFIED: inventory-pharmacy.md §E3]` — Products table has import-ready columns (`externalSource`, `externalId`, `importFingerprint` with SHA-256 constraint and unique index) but no code feeds these columns from the parser.
  - `[VERIFIED: inventory-pharmacy.md §E3]` — Inventory page tooltip references "imported source stock" suggesting the feature is expected by users.
  - `[VERIFIED: inventory-pharmacy.md §C.2]` — ROADMAP checkbox `[x]` overstates completion — parser exists but not integrated.
- **Suggested fix:** Either complete the server-side integration (tRPC endpoint + UI upload + product creation workflow) or update ROADMAP to show parser-only status. The schema infrastructure and parser are ready — only the integration layer is missing.

## 14. Auth token TTL inconsistency (Severity: Low)

- **Finding:** Email verification tokens last 24 hours, but password reset tokens expire in only 1 hour. This makes password-reset emails feel "broken" more often than verification emails.
- **Evidence:**
  - `[VERIFIED: auth-onboarding.md §B]` — Token TTLs: `email_verify = 24h`, `password_reset = 1h`, `invite = 72h` (verified in `lib/auth-tokens.ts:10-13`).
  - `[VERIFIED: auth-onboarding.md §E]` — Friction note #3: "The 1h TTL may be too aggressive for a veterinary practice that checks email infrequently."
- **Impact:** Password reset emails expire before users notice them, especially for practitioners who are with animals and check email less frequently. Users must request a new reset link, adding friction.
- **Suggested fix:** Increase password reset TTL from 1h to 4–6 hours. Email verification at 24h is reasonable; password reset should be in the same order of magnitude.

## 15. Whiteboard polling not real-time (Severity: Medium)

- **Finding:** The whiteboard uses 30-second tRPC polling instead of WebSocket/SSE for "live" updates. The UI displays a pulsing green dot with "Auto-refreshes every 30s" label, creating a misleading impression of real-time synchronization.
- **Evidence:**
  - `[VERIFIED: scheduling-front-desk.md §E1]` — Whiteboard UI shows pulsing green dot with "Auto-refreshes every 30s" label. Reality: `refetchInterval: 30000` — plain tRPC polling, no WebSocket/SSE/Supabase Realtime.
  - `[VERIFIED: scheduling-front-desk.md §E1]` — UX analysis F2 already flagged this as high severity. Status changes from other staff can take up to 30 seconds to appear. For a "live" board used for patient flow, this creates a window where two staff members could try to move the same patient.
  - `[VERIFIED: clients-portal.md §E6]` — Same 30-second polling pattern used in portal messaging (`refetchInterval: 30000`).
- **Impact:** Up to 30-second delay in patient status visibility across staff. Potential for two staff to act on the same patient simultaneously. Unnecessary server load from polling.
- **Suggested fix:** Replace with SSE or WebSocket for real-time updates. At minimum, add a warning tooltip explaining the polling interval. Both the whiteboard and portal messaging should use the same real-time mechanism.

## 16. Portal session has no self-service recovery (Severity: Medium)

- **Finding:** Portal sessions have a 30-minute idle timeout with no password reset mechanism for portal clients. After timeout, the client must get a new bootstrap token from staff — but the old token is already consumed (single-use).
- **Evidence:**
  - `[VERIFIED: clients-portal.md §E9]` — After 30 minutes of inactivity, the session expires and the client must re-enter their bootstrap token (which is likely already consumed). This means a session timeout is effectively a logout with no self-service recovery.
  - `[VERIFIED: clients-portal.md §B]` — Bootstrap token is 15-minute TTL, single-use (`portalAccessTokenUsedAt` set after first exchange). Session absolute TTL is 7 days, idle TTL is 30 minutes (`PORTAL_SESSION_IDLE_TTL_MS = 30 * 60 * 1000`).
  - `[VERIFIED: clients-portal.md §E1]` — Additionally, the 15-minute bootstrap token window may be too tight for elderly or less tech-savvy clients.
- **Impact:** Clients who leave the tab open and return later are locked out with no way to recover access without contacting the clinic for a new token. This is a significant UX gap for a "self-service" portal.
- **Suggested fix:** Add a "still there?" prompt before idle expiry, or extend idle timeout to 60 minutes. Consider a lightweight re-authentication path (e.g., email magic link) that doesn't require a new bootstrap token from staff.

---

## Summary

| Severity | Count | Findings |
|----------|-------|----------|
| **High** | 5 | #1 Navigation clustering, #3 e-Kasa split, #7 i18n gaps, #8 Records monolith, #9 Marketing billing bypass |
| **Medium** | 7 | #2 Wellness collision, #4 Orphaned features, #11 Simulated integrations undisclosed, #13 Wholesaler disconnect, #10 Treatment plan naming, #15 Whiteboard polling, #16 Portal recovery |
| **Low** | 4 | #6 Branding leaks, #12 Dental misclassification, #14 Auth TTL, #5 Phantom features |
