# Wellness Plans — Domain Feature Map

> **Anchor commit:** `23f23a3` (2026-09-12)
>
> **Scope:** `wellness` tRPC router, `/marketing/wellness` route, wellness billing panel, client-detail enrollment, settings management, wellness benefit redemptions, and supporting DB schema.

---

## §0 Grounding key

| Tag | Meaning |
|---|---|
| `[VERIFIED: path/to/file.ts:L42]` | read this exact line/function |
| `[VERIFIED: path/to/file.ts]` | read the file, no specific line |
| `[INFERRED]` | reasonable deduction, not directly seen |
| `[CLAIMED IN DOCS]` | from README/docs, not confirmed in code |
| `[UNVERIFIED — could not access]` | could not check at all |

---

## A. Feature inventory table

| Feature | Entry point(s) | Roles that can reach it | DB tables touched | Lifecycle state | Source tag |
|---|---|---|---|---|---|
| **List wellness plans** | `trpc.wellness.listPlans` (tRPC query) | `protectedProcedure` (any authenticated role) | `wellness_plans` | Implemented — MVP | `[VERIFIED: apps/web/server/routers/wellness.ts]` |
| **Create wellness plan** | `trpc.wellness.createPlan` (tRPC mutation) | `admin` only | `wellness_plans` | Implemented — MVP | `[VERIFIED: apps/web/server/routers/wellness.ts]` |
| **Deactivate / reactivate plan** | `trpc.wellness.setPlanActive` (tRPC mutation) | `admin` only | `wellness_plans` | Implemented — MVP | `[VERIFIED: apps/web/server/routers/wellness.ts]` |
| **Enroll client/patient in plan** | `trpc.wellness.enroll` (tRPC mutation) | `admin`, `front_desk` | `wellness_plans`, `wellness_enrollments`, `clients`, `patients` | Implemented — MVP | `[VERIFIED: apps/web/server/routers/wellness.ts]` |
| **List due enrollments (billing)** | `trpc.wellness.listDue` (tRPC query) | `admin`, `front_desk` | `wellness_enrollments`, `wellness_plans`, `clients`, `patients` | Implemented — MVP | `[VERIFIED: apps/web/server/routers/wellness.ts]` |
| **Generate due wellness invoices** | `trpc.wellness.generateDueInvoices` (tRPC mutation) | `admin`, `front_desk` | `wellness_enrollments`, `wellness_plans`, `invoices`, `invoice_items`, `clients`, `patients`, `practices` | Implemented — MVP | `[VERIFIED: apps/web/server/routers/wellness.ts]` + `[VERIFIED: apps/web/lib/wellness/invoicing.ts]` |
| **Mark billed (manual reconcile)** | `trpc.wellness.markBilled` (tRPC mutation) | `admin`, `front_desk` | `wellness_enrollments`, `wellness_plans` | Implemented — MVP | `[VERIFIED: apps/web/server/routers/wellness.ts]` |
| **Cancel enrollment** | `trpc.wellness.cancel` (tRPC mutation) | `admin`, `front_desk` | `wellness_enrollments` | Implemented — MVP | `[VERIFIED: apps/web/server/routers/wellness.ts]` |
| **List enrollments (with filters)** | `trpc.wellness.listEnrollments` (tRPC query) | `protectedProcedure` (any authenticated role) | `wellness_enrollments`, `wellness_plans`, `clients`, `patients` | Implemented — MVP | `[VERIFIED: apps/web/server/routers/wellness.ts]` |
| **Wellness plan management UI** | `/settings` → "Wellness Plans" tab | `admin` (create/edit), read for all | — | Implemented — UI | `[VERIFIED: apps/web/app/(dashboard)/settings/page.tsx:L4990-L5232]` |
| **Wellness billing panel** | `/billing` → `WellnessBillingPanel` component | `admin`, `front_desk` (generate), read for all | — | Implemented — UI | `[VERIFIED: apps/web/app/(dashboard)/billing/page.tsx:L977-L1145]` |
| **Client-detail enrollment panel** | `/clients/[id]` → `WellnessEnrollmentPanel` | `admin`, `front_desk` (write), read for others | — | Implemented — UI | `[VERIFIED: apps/web/app/(dashboard)/clients/[id]/page.tsx:L574-L881]` |
| **Marketing wellness page (redemptions)** | `/marketing/wellness` → `MarketingWellnessPage` | `admin`, `veterinarian`, `front_desk` | `ext_marketing_wellness_redemptions`, `wellness_enrollments`, `wellness_plans` | Implemented — UI | `[VERIFIED: apps/web/app/(dashboard)/marketing/wellness/page.tsx]` |
| **List wellness redemptions** | `trpc.extensions.marketing.listWellnessRedemptions` | `protectedProcedure` (any authenticated) | `ext_marketing_wellness_redemptions` | Implemented — MVP | `[VERIFIED: apps/web/server/routers/extensions/marketing.ts:L1375]` |
| **Redeem wellness benefit** | `trpc.extensions.marketing.redeemWellnessBenefit` | `admin`, `veterinarian`, `front_desk` | `ext_marketing_wellness_redemptions`, `wellness_enrollments` | Implemented — MVP | `[VERIFIED: apps/web/server/routers/extensions/marketing.ts:L1389]` |
| **Compute next billing date** | `lib/wellness/billing.ts` → `computeNextBillingDate()` | internal utility | — | Implemented — unit-tested | `[VERIFIED: apps/web/lib/wellness/billing.ts]` + `[VERIFIED: apps/web/lib/wellness/__tests__/billing.test.ts]` |
| **Generate due wellness invoices (lib)** | `lib/wellness/invoicing.ts` → `generateDueWellnessInvoices()` | internal (called by router) | `invoices`, `invoice_items`, `wellness_enrollments` | Implemented — unit-tested | `[VERIFIED: apps/web/lib/wellness/invoicing.ts]` + `[VERIFIED: apps/web/lib/wellness/__tests__/invoicing.test.ts]` |
| **Wellness policy constants** | `lib/wellness/policy.ts` | internal utility | — | Implemented | `[VERIFIED: apps/web/lib/wellness/policy.ts]` |

### DB schema

| Table | Purpose | Source tag |
|---|---|---|
| `wellness_plans` | Plan definitions (name, price, interval, active flag) | `[VERIFIED: packages/db/schema/wellness.ts]` |
| `wellness_enrollments` | Client/patient enrollment records with billing dates | `[VERIFIED: packages/db/schema/wellness.ts]` |
| `ext_marketing_wellness_redemptions` | Benefit redemption log (free nail trim, vaccine discount, etc.) | `[VERIFIED: packages/db/schema/ext_marketing.ts:L163]` |

---

## B. Import / Export specifics

**No dedicated import or export surface exists for the wellness domain.**

- Plans are created manually via the Settings UI or the tRPC `createPlan` mutation.
- Enrollments are created manually via the client-detail `enroll` mutation.
- Invoices generated by `generateDueInvoices` are written directly to the `invoices` / `invoice_items` tables — no CSV or file export is produced as part of the wellness flow itself. However, invoices can be exported via the general billing/export functionality.
- No migration importer exists specifically for wellness plans.
- **Finding BILLING-01 / WELLNESS-01:** Unlike the general billing module (which has invoice CSV/XLSX export), wellness has no standalone export of enrollments or plan definitions. `[INFERRED]`

---

## C. Integration specifics

| External system | Protocol / format | Certification reality | Source tag |
|---|---|---|---|
| **Stripe checkout** | Invoice payment via existing billing/Stripe integration | Wellness invoices are paid through the same Stripe checkout paths as regular invoices; no card-on-file subscription or autopay. Explicitly stated: "staff still collect payment on each invoice" / "saved cards are not auto-charged." | `[VERIFIED: apps/web/app/(dashboard)/billing/page.tsx:L1085]` + `[VERIFIED: apps/web/messages/sk.json:901]` |
| **Sympathy Gate (deceased patients)** | Internal safety check via `assertPatientNotDeceased` | Blocks benefit redemption for deceased patients; also blocks enrollment of deceased patients (`"Sympathy Gate: Cannot enroll a deceased patient in a wellness plan."`). | `[VERIFIED: apps/web/server/routers/wellness.ts:L138]` + `[VERIFIED: apps/web/server/routers/extensions/marketing.ts:L1403]` |

### Certification status

- **No external certification bodies are involved** (wellness plans are an internal practice-management feature, not a statutory/regulatory requirement like e-Kasa or CRSZ).
- **No lab/device integrations.** Wellness is purely an internal billing/membership system.

---

## D. Docs-vs-reality pass

| Doc claim | Verdict | Evidence | Source tag |
|---|---|---|---|
| Help content (`/marketing/wellness`): "Tvorba a manažment preventívnych balíkov celoročnej starostlivosti" — plan creation and benefit tracking | `IMPLEMENTED-PARTIAL` — plan CRUD exists in Settings; benefit redemption tracking exists in `/marketing/wellness`; but the help page describes "definovanie wellness balíka" with "zahrnuté výkony a tovary" (included services/goods), which is NOT implemented. Plans only have name, description, price, and billing interval — no itemized benefit list. | Settings page shows plan form with name, price, interval, description only. No schema or UI for listing included services. `[VERIFIED: apps/web/app/(dashboard)/settings/page.tsx:L5090-L5135]` + `[VERIFIED: packages/db/schema/wellness.ts]` |
| Help content: "Priradenie pacienta k plánu, nastavenie periodicity platieb, vygenerovanie zmluvy" — contract generation | `STALE-OR-CONTRADICTED-BY-CODE` — no contract/PDF generation exists for wellness enrollments. Enrollment is created with start date and plan assignment only. | No file in the codebase generates a wellness contract or zmluva. `[VERIFIED: absence across codebase]` |
| Help content: "Automatické upomienky čerpania" — automatic reminders for unused benefits | `ASPIRATIONAL-ONLY` — no automated reminder system exists for wellness benefits. Redemptions are manually logged; no scheduling engine sends reminders. | No code sends wellness benefit reminders. Recall schedules (`extMarketingRecallSchedules`) exist but are not wired to wellness. `[INFERRED]` |
| Help content: "Systém pripomenie majiteľovi nevyčerpané preventívne prehliadky pred koncom platnosti ročného plánu" | `ASPIRATIONAL-ONLY` — same as above. No expiration tracking or reminder system. | `[INFERRED]` |
| Help content: "Pacienti zaradení do wellness plánov navštevujú ambulanciu priemerne 3,5-krát častejšie" | `CLAIMED IN DOCS` — this is a marketing/statistical claim in the help text, not a code behavior. Not verified in code. | `[CLAIMED IN DOCS: apps/web/components/help/help-content.ts:L1851]` |
| README.md / ROADMAP.md / CLAUDE.md: no mention of wellness | `[INFERRED]` — wellness is not mentioned in any top-level documentation files. It was not part of the upstream OpenVPM scope and is an OpenVPM-AI addition. | `[VERIFIED: grep of README.md, ROADMAP.md, CLAUDE.md — 0 matches]` |
| sk.json i18n: "Wellness plány & programy" / "Preventívne programy kliniky a evidencia čerpania benefitov" | `IMPLEMENTED-VERIFIED` — i18n keys exist and match the `/marketing/wellness` page UI. | `[VERIFIED: apps/web/messages/sk.json:L4632-L4633]` |
| Help content: "Senior Wellness plán pre 10-ročného labradora" example with "2x biochemický profil krvi, kontrolný RTG hrudníka a kĺbov a 10 % zľava na lieky proti artróze" | `ASPIRATIONAL-ONLY` — the example describes itemized benefits and discounts that are not modeled in the schema. Plans have only a flat price. | `[VERIFIED: packages/db/schema/wellness.ts — no benefits/items table for plans]` |

---

## E. Friction / "doesn't make sense" notes

### E1. Navigation collision: `wellness` router vs. `/marketing/wellness` route **[WELLNESS-COLLISION-1]**

**Two distinct surfaces share the "wellness" name but serve different purposes:**

1. **Core wellness engine** (`trpc.wellness.*`) — plan CRUD (Settings), billing (Billing page), enrollment (client detail). This is the *operational* wellness system: create plans, enroll clients, generate invoices, cancel enrollments. `[VERIFIED: apps/web/server/routers/wellness.ts]`

2. **Marketing wellness page** (`/marketing/wellness`) — a read-heavy dashboard showing active plans summary, enrolled patients, and a **benefit redemption** panel (`redeemWellnessBenefit` / `listWellnessRedemptions` via `trpc.extensions.marketing.*`). This is a *usage-tracking* surface for logging which benefits a client has used during visits. `[VERIFIED: apps/web/app/(dashboard)/marketing/wellness/page.tsx]`

**Conclusion:** These are **two complementary facets of the same feature**, not two different features. The core engine (`wellness` router) handles plan management and billing; the marketing page (`/marketing/wellness`) handles benefit redemption tracking. They share `wellness_enrollments` as the join table. The naming collision is intentional in spirit but confusing in practice:

- `/marketing/wellness` lives under the Marketing nav section, which suggests it's about marketing campaigns — but it's really about **benefit redemption tracking** (a clinical/operational activity).
- The nav label "Wellness balíčky" (`custom-nav.ts:L146`) implies plan management, but this page does NOT manage plans — it tracks redemptions. Plan management lives in Settings.

**Severity:** Medium. The collision doesn't cause functional errors but misleads users about where to go. A receptionist looking to enroll a client goes to `/clients/[id]`; to create a plan goes to Settings; to track benefit usage goes to `/marketing/wellness`. The label "Wellness balíčky" in the Marketing section is misleading — "Čerpanie benefitov" (Benefit redemption) would be more accurate.

### E2. Benefit redemption has no plan-to-benefit mapping **[WELLNESS-02]**

`ext_marketing_wellness_redemptions` has `benefit_key` (free-text string), `notes`, and `appointmentId`, but there is no FK or schema linking redemptions to specific plan-defined benefits. A plan does not declare "this plan includes 2 free nail trims and 1 blood test" — staff just type any `benefit_key` when redeeming.

**Severity:** Medium. The system trusts staff to enter accurate benefit names. There's no validation that a redeemed benefit is actually included in the enrolled plan. `[VERIFIED: packages/db/schema/ext_marketing.ts:L163-L172]` + `[VERIFIED: apps/web/server/routers/extensions/marketing.ts:L1389-L1418]`

### E3. No enrollment limits per plan or per patient **[WELLNESS-03]**

The only uniqueness constraint is "one active enrollment per plan+client(+optional patient)" at enrollment time. There's no limit on how many plans a single patient can be enrolled in, and no cap on benefit redemptions per period. `[VERIFIED: apps/web/server/routers/wellness.ts:L253-L270]`

### E4. Help content describes features not in code **[WELLNESS-04]**

The `/marketing/wellness` help page describes contract generation, benefit lists per plan, and automated reminders — none of which exist. This will confuse users who expect these features. `[VERIFIED: apps/web/components/help/help-content.ts:L1821-L1860]`

### E5. Wellness not mentioned in README/ROADMAP/CLAUDE **[WELLNESS-05]**

The entire wellness domain (plans, enrollments, billing, redemptions) is absent from all top-level documentation. Neither README.md, ROADMAP.md, nor CLAUDE.md mentions wellness. This means it was not part of the upstream OpenVPM and is an OpenVPM-AI/Slovak-market addition, but the provenance is undocumented. `[VERIFIED: grep of README.md, ROADMAP.md, CLAUDE.md]`

### E6. i18n key naming inconsistency **[WELLNESS-06]**

In sk.json, the i18n keys mix English "Wellness" with Slovak descriptions:
- `"settings.wellness.newPlan": "Nový Wellness Plán"` — English word "Wellness" retained in Slovak UI label
- `"billing.wellness.toastGenerated": "{count} wellness faktúr"` — English word in Slovak sentence
- But client-detail uses `"wellnessMembership": "Preventívny program"` — fully Slovak

This is a broader repo-wide i18n inconsistency, not unique to wellness, but it's notable here because the help text and UI labels oscillate between "Wellness plán", "Preventívny program", and "Wellness balíčky."

### E7. Marketing nav section placement **[WELLNESS-07]**

The `/marketing/wellness` page (benefit redemption tracking) lives under the Marketing section (`section: "admin"` in `custom-nav.ts`). Benefit redemption is a clinical/front-desk operational task, not a marketing activity. This placement was inherited from the marketing extensions router pattern but doesn't match user mental models. Cross-reference: the marketing router handles redemptions (`listWellnessRedemptions`, `redeemWellnessBenefit`) as an "extension" feature rather than a core wellness feature. `[VERIFIED: apps/web/config/custom-nav.ts:L146-L152]`

### E8. Demo data seed uses wellness but help docs don't **[WELLNESS-08]**

`seed-marketing-demo.ts` seeds wellness enrollments and redemptions (section J), confirming the feature is live and demo-ready. Yet no `docs/help/*.md` file covers wellness. `[VERIFIED: packages/db/seed-marketing-demo.ts:L916-L937]`

---

## F. Proposed user-manual section(s)

### Target personas
- **Admin** — create/manage plans, deactivate plans with active enrollments
- **Front desk (recepcia)** — enroll clients, cancel enrollments, generate due invoices, redeem benefits
- **Veterinarian** — redeem benefits during visits (read-only for plans/billing)

### Format decision
Wellness is **too complex for the short `docs/help/*.md` task-oriented format** alone, because it spans three distinct surfaces (Settings, Billing, Marketing) and has a non-obvious billing model (scheduled invoices, not autopay subscriptions). It needs:

1. **A quick-reference page** (`docs/help/wellness.md`) — 1-2 minute read covering the most common tasks: "Create a wellness plan," "Enroll a client," "Generate due invoices."
2. **A reference-style document** (`docs/manual/wellness-billing.md`) — longer-form explaining the billing model (scheduled invoices vs. card-on-file subscriptions), the role split (who can do what), and the Sympathy Gate behavior for deceased patients.

### Proposed outline

#### `docs/help/wellness.md` (quick reference)

- **What are Wellness Plans?** (preventive care membership, flat monthly/annual fee)
- **Creating a wellness plan** (Settings → Wellness Plans tab → Add Plan → name, price, interval)
- **Enrolling a client** (Clients → [client] → Wellness section → select plan + patient → Enroll)
- **Generating due invoices** (Billing → Wellness invoices due → Generate invoices)
- **Tracking benefit usage** (Marketing → Wellness balíčky → select patient → redeem benefit)
- **Cancelling an enrollment** (Client detail → Cancel)
- **Deactivating a plan** (Settings → Deactivate — requires no active enrollments)

#### `docs/manual/wellness-billing.md` (reference)

- **How wellness billing works** (scheduled invoices, not subscriptions; staff collects payment per invoice via Stripe checkout)
- **Billing date math** (monthly advances 1 month, annual advances 1 year, handles month-end clamping)
- **Role permissions matrix** (admin: full CRUD on plans + billing; front_desk: enrollment + billing; vet: benefit redemption only)
- **Sympathy Gate** (deceased patients cannot be enrolled or redeem benefits)
- **Manual reconciliation** (`markBilled` — for charges handled outside OpenVPM)
- **What wellness plans do NOT include** (no itemized benefit lists, no automated reminders, no contract generation — flag aspirational vs. live features)

### Coverage gap
- **Current state:** Zero coverage. No `docs/help/wellness.md` exists; no `docs/` file mentions wellness.
- **Gap severity:** High — users have no documentation for a feature that handles billing, enrollments, and benefit tracking.
