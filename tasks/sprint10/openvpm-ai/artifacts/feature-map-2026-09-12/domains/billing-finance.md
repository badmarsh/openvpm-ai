# Domain: Billing & Finance
Commit: 23f23a3

## A. Feature inventory

| Feature | Entry point(s) | Roles | DB tables | Lifecycle state | Source tag |
|---|---|---|---|---|---|
| **Invoice CRUD** (draft→sent→paid→overdue→void) | `billingRouter.createInvoice`, `listInvoices`, `getInvoice`, `updateInvoiceStatus`, `voidInvoice` | admin, veterinarian, front_desk (void: admin/admin) | `invoices`, `invoiceItems` | **live** | [VERIFIED: apps/web/server/routers/billing.ts:2849,2414,2505,2583,4159] |
| **Estimate→Invoice conversion** | `billingRouter.convertEstimateToInvoice` | admin, front_desk | `invoices`, `products` (stock deduction) | **live** | [VERIFIED: apps/web/server/routers/billing.ts:4288] |
| **Payment recording** (cash, card, check, online, other) | `billingRouter.recordPayment`, `listPayments`, `refundPayment` | admin, front_desk | `payments` | **live** | [VERIFIED: apps/web/server/routers/billing.ts:3225,3402,3443] |
| **Invoice adjustments** (credits, write-offs) | `billingRouter.applyInvoiceAdjustment`, `listAdjustments` | admin, front_desk | `invoiceAdjustments` | **live** | [VERIFIED: apps/web/server/routers/billing.ts:3977,3946] |
| **Card payment via Stripe Checkout** (manual capture) | `billingRouter.createCardPaymentCheckout`, `cardPaymentStatus` | admin, front_desk | `payments` (external_id = `stripe:checkout:*` or `stripe:connect:*`) | **live** | [VERIFIED: apps/web/server/routers/billing.ts:3781,3915] |
| **Stripe Connect** (clinic-owned accounts) | `billingRouter.createPaymentAccountOnboarding`, `refreshPaymentAccount`, `openPaymentAccountDashboard`, `paymentAccountStatus` | admin | `practicePaymentAccounts` | **live** | [VERIFIED: apps/web/server/routers/billing.ts:1725,1795,1840,1714] |
| **Service catalog** (billable services) | `billingRouter.listServices`, `createService`, `updateService`, `listArchivedServices` | admin | `services` | **live** | [VERIFIED: apps/web/server/routers/billing.ts:2668,2693,2722,2679] |
| **Product catalog** (inventory items with stock) | `billingRouter.listProducts` | all (read); admin (write via inventory module) | `products` | **live** | [VERIFIED: apps/web/server/routers/billing.ts:3199] |
| **Dispense charge queue** (medication billing) | `billingRouter.listDispenseChargeQueue`, `createDispenseChargeInvoice`, `waiveDispenseCharge`, `reopenDispenseCharge` | admin, front_desk (waive: admin only) | `dispenseChargeQueue` | **live** | [VERIFIED: apps/web/server/routers/billing.ts:1866,1933,2174,2287] |
| **AR summary** (outstanding, overdue, collected MTD) | `billingRouter.arSummary` | all | `invoices`, `payments`, `invoiceAdjustments` | **live** | [VERIFIED: apps/web/server/routers/billing.ts:3731] |
| **Subscription plans** (hosted SaaS) | `subscriptionRouter.get`, `createCheckout`, `openBillingPortal` | admin | `practices` (subscriptionTier, billingStatus, trialEndsAt, stripeCustomerId, stripeSubscriptionId) | **live** | [VERIFIED: apps/web/server/routers/subscription.ts:52-265] |
| **e-Kasa receipt issuance** | `ekasaRouter.createReceipt`, `createReceiptFromPayment`, `createPosSale`, `retryReceipt` | admin, veterinarian, front_desk | `ekasaReceipts`, `ekasaConfig` | **live (flag-gated)** | [VERIFIED: apps/web/server/routers/extensions/ekasa.ts:144,309,415,192] |
| **e-Kasa storno/correction** | `ekasaRouter.stornoReceipt` | admin, veterinarian (NOT front_desk) | `ekasaReceipts` | **live (flag-gated)** | [VERIFIED: apps/web/server/routers/extensions/ekasa.ts:252-298] |
| **e-Kasa receipt printing** (thermal 58mm/80mm) | `ekasaRouter.printReceipt` | all authenticated | `ekasaReceipts` | **live** | [VERIFIED: apps/web/server/routers/extensions/ekasa.ts:300-356] |
| **e-Kasa daily closures** (Z-report) | `ekasaRouter.performDailyClosure`, `getDailyClosureSummary`, `getDailyClosures` | admin, veterinarian, front_desk | `ekasaDailyClosures` | **live** | [VERIFIED: apps/web/server/routers/extensions/ekasa.ts:856-950] |
| **e-Kasa monthly accountant export** | `ekasaRouter.getAccountantExport` | all authenticated | `ekasaDailyClosures` | **live** | [VERIFIED: apps/web/server/routers/extensions/ekasa.ts:952-1004] |
| **e-Kasa config management** | `ekasaRouter.getConfig`, `updateConfig` | admin | `ekasaConfig` | **live** | [VERIFIED: apps/web/server/routers/extensions/ekasa.ts:82-120] |
| **Walk-in POS sale** (pultový predaj) | `ekasaRouter.createPosSale` | admin, veterinarian, front_desk | `invoices`, `invoiceItems`, `ekasaReceipts`, `products` (stock deduction) | **live** | [VERIFIED: apps/web/server/routers/extensions/ekasa.ts:415-855] |
| **Accounting export — Pohoda XML** | `accountingRouter.exportData` (format=pohoda_xml) | admin, veterinarian | `invoices`, `invoiceItems`, `ekasaReceipts` | **live** | [VERIFIED: apps/web/server/routers/extensions/accounting.ts:26-163] |
| **Accounting export — KROS Omega CSV** | `accountingRouter.exportData` (format=kros_omega) | admin, veterinarian | `invoices`, `invoiceItems`, `ekasaReceipts` | **live** | [VERIFIED: apps/web/server/routers/extensions/accounting.ts:26-163] |
| **ISDOC 6.0.2 export** (CZ/SK e-invoice) | `accountingRouter.exportIsdoc` | admin, veterinarian | `invoices`, `invoiceItems` | **live** | [VERIFIED: apps/web/server/routers/extensions/accounting.ts:165-252] |
| **Suppliers & Purchase Orders** | Schema only; no dedicated router procedures found | — | `suppliers`, `purchaseOrders` | **schema-only (no router)** | [VERIFIED: packages/db/schema/billing.ts:307-341] |
| **Wellness billing panel** | `billing/` page: `<WellnessBillingPanel>` component | admin, front_desk | [INFERRED] | **UI partial** | [VERIFIED: apps/web/app/(dashboard)/billing/page.tsx — component referenced; implementation in separate file] |

### Dashboard routes
| Route | Purpose | Source tag |
|---|---|---|
| `/billing` | Invoice list with status tabs, AR KPIs, dispense charge queue, accounting export dialog | [VERIFIED: apps/web/app/(dashboard)/billing/page.tsx] |
| `/billing/new` | Create new invoice/estimate | [VERIFIED: apps/web/app/(dashboard)/billing/new/page.tsx] |
| `/billing/ekasa` | e-Kasa receipts list + daily closures (tab) | [VERIFIED: apps/web/app/(dashboard)/billing/ekasa/page.tsx] |
| `/billing/pos` | Fast checkout POS (walk-in sales) | [VERIFIED: apps/web/app/(dashboard)/billing/pos/page.tsx] |

---

## B. Import/Export specifics

### Accounting export (ext/accounting)
- **Pohoda XML 2.0** — Generates `<dat:dataPack>` with `<inv:invoice>` (issued invoices) and `<vch:voucher>` (e-Kasa cash receipts with VAT breakdown). Compatible with STORMWARE Pohoda. [VERIFIED: apps/web/lib/accounting/export.ts:60-168]
- **KROS Omega CSV** — BOM-prefixed UTF-8 CSV with 13-column format: `Druh;CisloDokladu;Datum;Partner;Text;Zaklad_23;DPH_23;Zaklad_19;DPH_19;Zaklad_5;DPH_5;Oslobodene_0;Spolu`. Rows tagged `FA` (invoice) or `PD` (cash receipt). [VERIFIED: apps/web/lib/accounting/export.ts:170-208]
- **ISDOC 6.0.2 XML** — CZ/SK standard for electronic invoices. Compatible with Pohoda, Omega, Money S3, ABRA. Supports multi-VAT-rate TaxTotal grouping. Supplier/customer party with IČO, DIČ, address. [VERIFIED: apps/web/lib/accounting/isdoc-export.ts:1-142]
- **Date filtering**: All exports use `Europe/Bratislava` timezone-aware date truncation. [VERIFIED: apps/web/server/routers/extensions/accounting.ts:43-47]
- **Tax config**: Practice `.ico` and `.vatNumber` fields read from `practices` table for supplier identity. `currency` (default EUR) used in ISDOC. [VERIFIED: apps/web/server/routers/extensions/accounting.ts:36,131,207]

### e-Kasa document export
- **Monthly CSV** via `ekasaRouter.getAccountantExport`: aggregates daily closures into monthly totals with per-VAT-rate breakdown (23/19/5/0%). [VERIFIED: apps/web/server/routers/extensions/ekasa.ts:952-1004]
- **Thermal receipt HTML**: Generated for 58mm or 80mm paper widths via `generateReceiptHtml()`. [VERIFIED: apps/web/server/routers/extensions/ekasa.ts:300-356]

---

## C. Integration specifics

### Stripe — subscription billing
- **Status**: Live production integration with API version `2026-07-29.dahlia`. [VERIFIED: apps/web/lib/stripe.ts:19]
- **Three webhook endpoints**: Main (`STRIPE_WEBHOOK_SECRET`), Connect (`STRIPE_CONNECT_WEBHOOK_SECRET`), Subscription (`STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`). Each has its own signing secret. [VERIFIED: apps/web/lib/stripe-config.ts:14-30]
- **Stripe Connect**: Clinic-owned destination-charge accounts via controller-based onboarding. Platform fee configurable via `STRIPE_CONNECT_APPLICATION_FEE_BPS`. Clinics get full Stripe Dashboard. [VERIFIED: apps/web/lib/stripe.ts:247-295]
- **Checkout capture mode**: Manual (`manual_v1`). Webhook locks/revalidates invoice balance before capture. Partial capture releases unused authorization to prevent overpayment. [VERIFIED: apps/web/lib/stripe.ts:16, 89-135]
- **Refund safety**: Full refund with `refund_application_fee` on Connect charges. Idempotency keys scoped to `openvpm:refund:<key>`. [VERIFIED: apps/web/lib/stripe.ts:238-270]
- **Invalid checkout resolution**: Abandoned manual authorizations canceled; captured funds refunded with stable idempotency. [VERIFIED: apps/web/lib/stripe.ts:138-218]
- **Hosted subscription billing**: Gated by `HOSTED_BILLING_ENABLED`. Off by default (self-host ungated). [VERIFIED: apps/web/lib/billing/plans.ts:283-285]
- **Tax**: Optional Stripe Tax via `STRIPE_TAX_ENABLED` env flag. [VERIFIED: apps/web/lib/stripe.ts:13, apps/web/lib/stripe.ts:352-365]
- **Client invoice payment tokens**: `lib/billing/invoice-payment-tokens.ts` exists for portal-based payment via magic links. [INFERRED from file inventory]

### e-Kasa — SK financial administration
- **Legal basis**: Zákon č. 289/2008 Z. z. (and č. 384/2025 Z. z. for closures). [VERIFIED: packages/db/schema/ext_ekasa.ts:155, ROADMAP.md:24]
- **Fiscalization**: Gated behind `EKASA_FISCALIZATION_ENABLED=true` + RSA private key. When disabled, receipts are stored offline-only with zero outbound egress. [VERIFIED: apps/web/lib/ekasa/fiscal.ts:6-13, scripts/staging-smoke-test.mjs:667]
- **SSRF guard**: Only `ekasa.financnasprava.sk` allowed; HTTPS enforced; no credentials in URL allowed. [VERIFIED: apps/web/lib/ekasa/fiscal.ts:39-56]
- **Cryptographic signing**: PKP (RSA-SHA256, base64), OKP (SHA-1). Private key from `ekasaConfig.certBase64` (PEM, base64-encoded). [VERIFIED: apps/web/lib/ekasa/fiscal.ts:14-33, packages/db/schema/ext_ekasa.ts:83]
- **ROADMAP claim**: "Hardware-supported-but-not-certified" — integration driver implemented and tested; formal certification with FR SR has not been completed. **VERIFIED ACCURATE**. [VERIFIED: ROADMAP.md:24-25, 75]
- **Offline front**: Functional offline transaction queue with idempotency. Tested during simulated 45-min outage. [VERIFIED: ROADMAP.md:130, scripts/staging-smoke-test.mjs:588-710]
- **Hardware drivers**: FiskalPRO (VX520, VX675, N5, T2 — LAN/REST/USB), VRP2 (virtual register). [VERIFIED: docs/slovak-integration-catalog.md:73-75]
- **Payment terminals**: Nexi/SLSP/ČSOB POS integration claimed in docs as "prepojenie cez FiskalPRO COM/LAN" — appears to be FiskalPRO-mediated, not direct API integration. [VERIFIED: docs/slovak-integration-catalog.md:76]
- **Tray Agent**: Planned for v0.7 — local system-tray process for USB FiskalPRO connectivity. Not yet implemented. [VERIFIED: ROADMAP.md:52]
- **Gap issues**: P0-G08 (void flow in FRSR test env), P1-L02 (certified ORP device list), P2-L01-void (document void/correction procedures). [VERIFIED: scripts/create-gap-issues.sh:72-82,122-124]
- **VAT rate support**: Slovak 2025 rates — 23% (STANDARD_23), 19% (REDUCED_19), 5% (REDUCED_5), 0% (ZERO). Legacy rates REDUCED (10%) and STANDARD (20%) retained in enum. [VERIFIED: packages/db/schema/ext_ekasa.ts:22-30]

### Accounting — external systems
- **Pohoda, Omega, Money S3, ABRA**: All supported via ISDOC 6.0.2 or Pohoda XML export. No direct API integrations. [VERIFIED: apps/web/lib/accounting/isdoc-export.ts:2-5]
- **CSV export**: KROS Omega/Alfa CSV format with per-VAT-rate columns. [VERIFIED: apps/web/lib/accounting/export.ts:170-208]
- **No automated scheduled export**: User manually triggers export from `/billing` → "Účtovný export" button. [VERIFIED: apps/web/app/(dashboard)/billing/page.tsx — AccountingExportDialog component]

---

## D. Docs-vs-reality pass

| Doc claim (paraphrase) | Verdict | Evidence |
|---|---|---|
| README: Cloud Solo = **49 € / mesiac** (490 € / rok) | **STALE** — Code says $79/mo ($790/yr) | [VERIFIED: apps/web/lib/billing/catalog.ts:26-27 vs README.md:88] |
| README: "Priame prepojenie s bankovými terminálmi Nexi, SLSP a ČSOB" | **OVERSTATED** — Payment terminals appear to be FiskalPRO-mediated only, not direct integrations. No dedicated terminal router found. | [VERIFIED: docs/slovak-integration-catalog.md:76 describes FiskalPRO COM/LAN bridging; no standalone terminal API found] |
| README: e-Kasa "hardvérová podpora != certifikovaná integrácia s FR SR; certifikácia prebieha" | **ACCURATE** — Matches ROADMAP and code reality. Fiscalization flag-gated. | [VERIFIED: ROADMAP.md:75, apps/web/lib/ekasa/fiscal.ts:6-13] |
| README: "Automatický export do účtovných softvérov POHODA, OMEGA, Money S3" | **PARTIALLY ACCURATE** — Export is manual (button-triggered), not automatic/scheduled. Formats are correct. | [VERIFIED: apps/web/server/routers/extensions/accounting.ts is manual-trigger only; no cron job for scheduled export] |
| ROADMAP: KVEPIS "XML-only export; priame podanie na SVPS SR v produkcii zatial neuskutocnene" | **ACCURATE** (not billing but adjacent) | [VERIFIED: ROADMAP.md:19-20] |
| ROADMAP: "Tray Agent pre e-Kasa (Windows/macOS)" planned for v0.7 | **ACCURATE** — Not yet implemented. Cloud clinics currently require local port mapping. | [VERIFIED: ROADMAP.md:52, README.md:192] |
| ROADMAP: "0 realnych transakcii v CHDU" | **ACCURATE** — No live e-Kasa submissions to FR SR production. | [VERIFIED: ROADMAP.md:76] |
| FEATURE MAP prompt: "billing, subscription routers" | **PARTIALLY ACCURATE** — `billingRouter` and `subscriptionRouter` exist but subscription is under `subscription`, not a sub-router of billing. No standalone `billing` or `subscription` routers at top-level `/server/routers/` — they're under `_app.ts` merging. | [VERIFIED: apps/web/server/routers/_app.ts:8,31,47,70] |
| README: "Storno dokladov" for e-Kasa | **ACCURATE** — `ekasaRouter.stornoReceipt` with STORNO and RETURN types, admin/veterinarian only. | [VERIFIED: apps/web/server/routers/extensions/ekasa.ts:252-298] |

---

## E. Friction notes

### e-Kasa overlaps with statutory-compliance domain (domain 8)
The e-Kasa feature set is physically split across two domains by the architecture:
- **Billing/finance domain (here)**: `ekasaRouter`, `packages/db/schema/ext_ekasa.ts`, dashboard routes under `/billing/ekasa`, all of `lib/ekasa/*`
- **Statutory-compliance domain (domain 8)**: The domain-audit prompt for domain 8 explicitly claims e-Kasa alongside KVEPIS/CRSZ/CEHZ/ÚPVS under "Slovak Statutory Compliance".

**Collision**: e-Kasa is fiscal regulation (Zákon 289/2008), not veterinary statutory compliance (Zákon 39/2007). The feature-map prompt names it under both domains. A user-manual reader looking for e-Kasa could land in either section. **Recommendation**: Cross-reference both domains but anchor e-Kasa's primary documentation in billing-finance, with a short statutory-compliance section that directs here.

### Invoice status lifecycle vs appointment status lifecycle
- **Invoices**: draft → sent → paid/overdue → void. Also: estimate converted to draft via `convertEstimateToInvoice`. [VERIFIED: packages/db/schema/billing.ts:22-27]
- **Appointments**: Separate lifecycle managed in scheduling domain. Invoices reference appointments via `appointmentId` (foreign key), with a unique constraint: one non-void, non-estimate active invoice per appointment. [VERIFIED: packages/db/schema/billing.ts:149-158]
- **Separation verified**: UX analysis claim "invoices are separate from appointments" is correct — invoices are a billing concern that can be linked to an appointment but have independent status management.

### Stripe webhook validation
- Webhook body size limited to 1MB (`STRIPE_WEBHOOK_BODY_MAX_BYTES`). Content-Length header checked before body read. [VERIFIED: apps/web/lib/stripe-webhook-limits.ts:1-14]
- Each webhook type (main, Connect, Subscription) has its own endpoint secret — no key reuse.

### Idempotency architecture
- Stripe operations use HMAC-SHA256 idempotency keys scoped as `openvpm:<scope>:<identity>:<digest>`, capped at 255 chars. [VERIFIED: apps/web/lib/stripe.ts:28-36]
- Invoice adjustments use `operationKey` with `balanceAfter` for deduplication. [VERIFIED: packages/db/schema/billing.ts:202-217]
- e-Kasa receipt-per-payment uses `pg_advisory_xact_lock` on `paymentId` to prevent race conditions. [VERIFIED: apps/web/server/routers/extensions/ekasa.ts:370-375]

### Billing enforcement model
- `HOSTED_BILLING_ENABLED` flag gates subscription enforcement. Off by default → self-host runs fully ungated (all features available). [VERIFIED: apps/web/lib/billing/plans.ts:283-285]
- `noCardTrialEnabled()`: Defaults to true. New practices get 14-day trial without entering card details. Can be disabled via `HOSTED_NO_CARD_TRIAL=false`. [VERIFIED: apps/web/lib/billing/plans.ts:244-248]
- Trial calendar days counted in `America/New_York` timezone (Stripe-aligned). [VERIFIED: apps/web/lib/billing/plans.ts:251]
- `hasHostedFullAccess`: active trial, active/past_due paid subscription, or billing not enforced → write access. Terminal `unpaid` → read-only. [VERIFIED: apps/web/lib/billing/plans.ts:259-276]

### Readiness gaps
- **No live e-Kasa CHDÚ submissions**: All e-Kasa testing has been simulated; no production FR SR submissions. [VERIFIED: ROADMAP.md:76]
- **e-Kasa void flow**: P0 gap — needs testing against FRSR test environment. [VERIFIED: scripts/create-gap-issues.sh:72]
- **Certified ORP device list**: Not yet published (P1). [VERIFIED: scripts/create-gap-issues.sh:79]
- **No external security audit**: Penetration testing planned Q4 2026. [VERIFIED: ROADMAP.md:86]

---

## F. Proposed user-manual section(s)

### Personas
- **Admin**: Full billing management — configure e-Kasa, manage Stripe Connect onboarding, create/edit/void invoices, record/refund payments, apply adjustments, export accounting data, manage subscription plan.
- **Veterinarian**: Create e-Kasa receipts, issue storno receipts, record payments, access accounting exports, view invoices.
- **Front desk**: Create invoices, record payments (cash/card), perform walk-in POS sales, execute daily closures, convert estimates. **Cannot void e-Kasa receipts** (reserved for admin/veterinarian per Zákon 289/2008 §8).

### Complexity assessment
Billing + e-Kasa is **high-complexity regulatory content**. It needs:
- **Reference-style documentation**, not a short help page.
- Separate sections for: invoicing basics, estimates, payments, Stripe card payments, e-Kasa configuration, e-Kasa receipt lifecycle, daily closures (Z-report), storno/correction procedures, accounting exports.
- **Multi-language**: Slovak primary (regulatory terms are Slovak — DPH, DIČ, IČ DPH, OKP, PKP, UID, storno, CHDÚ). English translations exist for UI labels but regulatory terminology must stay Slovak.

### Recommended section structure
1. **Invoicing** — Status lifecycle, creating invoices from services/products, estimates, converting estimates, voiding, AR overview.
2. **Payments** — Recording payments, payment methods, Stripe card checkout, refunds, adjustments (credits/write-offs).
3. **e-Kasa (Slovak fiscal compliance)** — Legal context (Zákon 289/2008), configuration prerequisites (DIČ, pokladnica ID, RSA certificate), receipt lifecycle (PENDING→SENT→CONFIRMED/FAILED/OFFLINE_STORED), storno/correction procedures, daily closures, offline mode, hardware requirements (FiskalPRO/VRP2).
4. **Subscription & Plans** — Hosted SaaS billing, plan tiers, trial period, managing subscription via Stripe Billing Portal, self-host vs. managed.
5. **Accounting exports** — Pohoda XML, KROS CSV, ISDOC 6.0.2, monthly e-Kasa summary CSV.

### Cross-domain links needed
- → Statutory compliance (domain 8): e-Kasa legal basis, KVEPIS/CRSZ export overlaps with billing data.
- → Inventory (domain TBD): Product catalog shared with billing; stock deductions on POS sale and estimate conversion.
- → Scheduling (domain TBD): Appointment→invoice linkage, visit reconciliation integrity.
- → Client portal (domain TBD): Client invoice viewing and card payment via magic-link tokens.