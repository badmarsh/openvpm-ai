# Domain: Client Portal
Commit: 23f23a3

## A. Feature inventory

| Feature | Entry point(s) | Roles | DB tables | Lifecycle state | Source tag |
|---|---|---|---|---|---|
| **Portal access token issuance** (single-use bootstrap link) | `clientsRouter.rotatePortalAccessToken` | admin (via `clientManagerProcedure`) | `clients` (accessToken, portalAccessTokenExpiresAt, portalAccessTokenUsedAt) | **live** | [VERIFIED: apps/web/server/routers/clients.ts:899-942] |
| **Portal access token revocation** (invalidate all sessions) | `clientsRouter.rotatePortalAccessToken` | admin | `clients` + `portalSessions` (revokedAt, revokedReason=staff_access_reset) | **live** | [VERIFIED: apps/web/server/routers/clients.ts:916-924] |
| **Portal session exchange** (token → HttpOnly cookie session) | `POST /api/portal/session` | public (client with valid bootstrap token) | `clients` (portalAccessTokenUsedAt set) + `portalSessions` | **live** | [VERIFIED: apps/web/app/api/portal/session/route.ts:54-110] |
| **Portal session logout** | `DELETE /api/portal/session` | authenticated portal session | `portalSessions` (revokedAt=client_logout) | **live** | [VERIFIED: apps/web/app/api/portal/session/route.ts:112-136] |
| **Portal home dashboard** (pet list, quick links) | `/portal` → `trpc.portal.getClient` | portal session | `clients`, `patients`, `practices`, `locations` | **live** | [VERIFIED: apps/web/app/portal/[token]/page.tsx; apps/web/server/routers/portal.ts:331-391] |
| **Pet detail view** (vitals, allergies, history) | `/portal/pets/[petId]` → `trpc.portal.getPetDetail` | portal session | `patients`, `patientWeights`, `patientAllergies`, `vaccinationRecords`, `prescriptions`, `clinicalRecordCorrections` | **live** | [VERIFIED: apps/web/app/portal/[token]/pets/[petId]/page.tsx; apps/web/server/routers/portal.ts:393-589] |
| **Vaccination records** (client-facing view) | `getPetDetail` → vaccinations tab | portal session (read-only) | `vaccinationRecords` (filtered by patient + corrections exclusion) | **live** | [VERIFIED: apps/web/server/routers/portal.ts:517-553] |
| **Vaccination certificate PDF generation** | `trpc.portal.getVaccinationCertificateData` + client-side PDF gen | portal session | `vaccinationRecords`, `patients`, `practices` | **live** | [VERIFIED: apps/web/app/portal/[token]/pets/[petId]/page.tsx:63-106; apps/web/server/routers/portal.ts:591-673] |
| **Patient allergies** (alert display) | `getPetDetail` → allergy banner | portal session (read-only) | `patientAllergies` (filtered by corrections exclusion) | **live** | [VERIFIED: apps/web/server/routers/portal.ts:475-515] |
| **Active prescriptions** (client-facing view) | `getPetDetail` → prescriptions tab | portal session (read-only) | `prescriptions` (status=active, endDate >= today or null) | **live** | [VERIFIED: apps/web/server/routers/portal.ts:555-587] |
| **Weight history** (trend display with kg/lbs) | `getPetDetail` → weights tab | portal session (read-only) | `patientWeights` (ordered by recordedAt DESC) | **live** | [VERIFIED: apps/web/server/routers/portal.ts:450-473] |
| **Appointment list** (upcoming + past) | `/portal/appointments` → `trpc.portal.getAppointments` | portal session (read-only) | `appointments`, `patients`, `users`, `appointmentTypes`, `locations` | **live** | [VERIFIED: apps/web/app/portal/[token]/appointments/page.tsx; apps/web/server/routers/portal.ts:675-750] |
| **Self-service appointment booking** | `/portal/book` → `trpc.portal.requestAppointment` | portal session | `appointments` (status=scheduled, notes="[Portal request] ...") | **live** | [VERIFIED: apps/web/app/portal/[token]/book/page.tsx; apps/web/server/routers/portal.ts:1227-1443] |
| **Appointment type listing** (visit reasons) | `trpc.portal.getAppointmentTypes` | portal session (read-only) | `appointmentTypes` (active, non-deleted) | **live** | [VERIFIED: apps/web/server/routers/portal.ts:1090-1114] |
| **Available slot suggestions** | `trpc.portal.availableSlots` | portal session (read-only) | `appointments`, `appointmentTypes`, `users` (provider availability) | **live** | [VERIFIED: apps/web/server/routers/portal.ts:1116-1225] |
| **Portal messaging** (inbox + compose) | `/portal/messages` → `trpc.portal.getMessages` / `createMessage` | portal session | `communications` (channel=portal, direction=inbound/outbound) | **live** | [VERIFIED: apps/web/app/portal/[token]/messages/page.tsx; apps/web/server/routers/portal.ts:751-834] |
| **Auto-mark messages read** | `trpc.portal.markMessagesRead` | portal session | `communications` (status=read, readAt set for outbound) | **live** | [VERIFIED: apps/web/server/routers/portal.ts:835-864] |
| **Invoice list** (billing overview) | `/portal/invoices` → `trpc.portal.getInvoices` | portal session (read-only) | `invoices`, `invoiceAdjustments`, `patients`, `practices` | **live** | [VERIFIED: apps/web/app/portal/[token]/invoices/page.tsx; apps/web/server/routers/portal.ts:980-1088] |
| **Online invoice payment** (Stripe Checkout) | `POST /api/portal/checkout` | portal session OR invoice payment token | `invoices`, `clients`, `practices`, `patients`, `invoiceAdjustments` | **live** | [VERIFIED: apps/web/app/api/portal/checkout/route.ts:102-385] |
| **Invoice payment token** (email magic link, 30-day TTL) | `lib/billing/invoice-payment-tokens.ts` | public (HMAC-signed credential) | N/A (stateless signed token) | **live** | [VERIFIED: apps/web/lib/billing/invoice-payment-tokens.ts:1-130] |
| **Portal branding** (practice logo, brand color) | `PortalShell` + `practicePortalProfile` | portal session | `practices` (name, logoUrl, settings.brandColor) | **live** | [VERIFIED: apps/web/components/portal/portal-shell.tsx; apps/web/server/routers/portal.ts:225-249] |
| **Portal session security** (idle + absolute TTL) | `resolvePortalSession` | system (internal) | `portalSessions` (lastSeenAt, expiresAt, revokedAt) | **live** | [VERIFIED: apps/web/lib/portal/session.ts:69-140] |
| **Rate limiting** (per-session + per-IP) | All portal procedures | system (internal) | In-memory rate limiter (Redis-compatible) | **live** | [VERIFIED: apps/web/server/routers/portal.ts:85-120] |
| **Billing enforcement gate** (subscription check) | `assertPortalWriteAccess` | system (internal) | `practices` (subscriptionTier, billingStatus, trialEndsAt) | **live** | [VERIFIED: apps/web/server/routers/portal.ts:279-308] |
| **Webhook dispatch** (appointment.created) | `dispatchAppointmentWebhookAfterCommit` | system (internal) | `webhooks` (events include appointment.created) | **live** | [VERIFIED: apps/web/server/routers/portal.ts:1400-1443] |

---

## B. Import/Export specifics

### Portal access token lifecycle
- **Single-use bootstrap credential**: Staff generates a random 64-hex token via `generatePortalAccessToken()`. The SHA-256 hash is stored in `clients.accessToken`; the raw token is returned once to staff for sharing with the client. [VERIFIED: apps/web/server/routers/clients.ts:900-902]
- **Token TTL**: 15 minutes from issuance (`PORTAL_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000`). After first use, `portalAccessTokenUsedAt` is set, invalidating further exchanges. [VERIFIED: apps/web/lib/portal/tokens.ts:4]
- **DB constraint**: `clients_portal_access_token_state_check` ensures token fields are either ALL NULL (never issued) or ALL populated with a valid 64-hex token + expiry. [VERIFIED: packages/db/schema/clients.ts:106-115]
- **Session revocation on rotation**: When staff rotates a token, ALL existing `portalSessions` for that client are revoked with `revokedReason = "staff_access_reset"`. [VERIFIED: apps/web/server/routers/clients.ts:916-924]

### Portal session lifecycle
- **Session token**: Random 64-hex, stored as SHA-256 hash in `portalSessions.tokenHash`. Browser receives an HttpOnly, Secure, SameSite=lax cookie. [VERIFIED: apps/web/lib/portal/session.ts:29-37; apps/web/app/api/portal/session/route.ts:88-97]
- **Absolute TTL**: 7 days (`PORTAL_SESSION_ABSOLUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000`). [VERIFIED: apps/web/lib/portal/tokens.ts:6]
- **Idle TTL**: 30 minutes (`PORTAL_SESSION_IDLE_TTL_MS = 30 * 60 * 1000`). Sessions are touched at most every 5 minutes. [VERIFIED: apps/web/lib/portal/tokens.ts:7-8]
- **Privacy**: IP addresses and user agents are HMAC-hashed before storage (`createdIpHash`, `userAgentHash`). Raw values are never persisted. [VERIFIED: apps/web/app/api/portal/session/route.ts:94-97; apps/web/lib/portal/tokens.ts:34-42]
- **Logout**: `DELETE /api/portal/session` revokes the session with `revokedReason = "client_logout"` and clears the cookie. [VERIFIED: apps/web/app/api/portal/session/route.ts:112-136]

### Invoice payment tokens (email magic links)
- **Stateless HMAC-signed credentials**: Tokens encode `{invoiceId, clientId, practiceId, issuedAt, expiresAt, nonce}` as base64url, signed with HMAC-SHA256 using `NEXTAUTH_SECRET`. [VERIFIED: apps/web/lib/billing/invoice-payment-tokens.ts:60-80]
- **TTL**: 30 days (`INVOICE_PAYMENT_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000`). [VERIFIED: apps/web/lib/billing/invoice-payment-tokens.ts:5]
- **Timing-safe verification**: `timingSafeEqual` prevents timing attacks on signature comparison. [VERIFIED: apps/web/lib/billing/invoice-payment-tokens.ts:116-119]
- **Two payment paths**: Portal session cookie (browser-based) OR payment token (email link). Both converge on the same `/api/portal/checkout` endpoint with identical scoping. [VERIFIED: apps/web/app/api/portal/checkout/route.ts:155-200]

### Accounting export — none
- The client portal has **no export functionality**. Clients cannot download invoices, vaccination records, or medical history as files (except vaccination certificate PDFs). [VERIFIED: no export routes found in portal routes or pages]

---

## C. Integration specifics

### Stripe — client-facing payments
- **Checkout flow**: Portal clients initiate payment via `POST /api/portal/checkout`, which creates a Stripe Checkout Session and redirects to the hosted Stripe page. [VERIFIED: apps/web/app/api/portal/checkout/route.ts:340-380]
- **Connect direct charges**: On hosted deployments, payments route to the clinic's own Stripe Connect account (`connectedAccountId`), never to the platform account. Platform charges would misdirect clinic revenue. [VERIFIED: apps/web/app/api/portal/checkout/route.ts:330-348]
- **Application fee**: Platform fee configured via `STRIPE_CONNECT_APPLICATION_FEE_BPS`. If Connect is configured but application fee is not, checkout fails with 503. [VERIFIED: apps/web/app/api/portal/checkout/route.ts:349-356]
- **Currency**: Practice's configured currency (region-aware, defaults to USD). [VERIFIED: apps/web/app/api/portal/checkout/route.ts:313-325]
- **Recovery hold**: Practices under `recoveryHold` cannot process online payments (503). [VERIFIED: apps/web/app/api/portal/checkout/route.ts:313-325]
- **Return URLs**: Success/cancel redirects return to `/portal/invoices?payment=success|cancelled&invoice=<id>`. SSRF guard validates return URLs against the request origin. [VERIFIED: apps/web/lib/portal/payments.ts:18-34]

### Stripe — invoice payment token flow
- **Email payment links**: Staff can generate magic links for specific invoices via `createInvoicePaymentToken()`. These are HMAC-signed, 30-day TTL, and scope to exactly one client/practice/invoice. [VERIFIED: apps/web/lib/billing/invoice-payment-tokens.ts:60-80]
- **Token URL pattern**: `/pay/<token>?payment=success|cancelled`. Separate from the portal session flow (`/portal/invoices`). [VERIFIED: apps/web/lib/portal/payments.ts:28-34]

### Webhook dispatch
- **Appointment created**: Portal booking fires `appointment.created` webhook with the new appointment payload. Dispatch occurs after commit via `dispatchAppointmentWebhookAfterCommit`. [VERIFIED: apps/web/server/routers/portal.ts:1400-1443]
- **Funnel analytics**: Portal booking also triggers `recordActivationAfterAppointmentCreated` for conversion tracking. [VERIFIED: apps/web/server/routers/portal.ts:1405]

### Communications → portal messaging
- **Channel enum**: `comm_channel` includes `portal` alongside `phone`, `sms`, `email`. Portal messages are stored in the shared `communications` table. [VERIFIED: packages/db/schema/communications.ts:19]
- **Direction**: Inbound = client→clinic, outbound = clinic→client. [VERIFIED: packages/db/schema/communications.ts:23]
- **Auto-read**: Portal auto-marks outbound messages as read when the client views the messages page. [VERIFIED: apps/web/server/routers/portal.ts:845-859]

### Tenant isolation — multi-tenant security model
- **Session scoping**: Every portal procedure resolves `getClientForPortalSession()` which verifies the client belongs to the session's practice AND that the practice is active (not deleted). [VERIFIED: apps/web/server/routers/portal.ts:192-212]
- **Patient scoping**: All patient queries include `eq(patients.clientId, client.id)` + `eq(patients.practiceId, client.practiceId)` — clients can only see their own pets. [VERIFIED: apps/web/server/routers/portal.ts:410-420]
- **Invoice scoping**: Invoice queries filter by `eq(invoices.clientId, client.id)` + `eq(invoices.practiceId, client.practiceId)`. [VERIFIED: apps/web/server/routers/portal.ts:1009-1018]
- **Cross-tenant adversarial test**: Dedicated test suite verifies portal sessions cannot be hijacked across practices. [VERIFIED: apps/web/server/__tests__/adversarial-tenant-isolation.test.ts:759-780]
- **System-context operations**: Session exchange and checkout run in `withSystem()` context (RLS bypass) but re-verify client/practice membership before any data access. [VERIFIED: apps/web/app/api/portal/session/route.ts:72-106; apps/web/app/api/portal/checkout/route.ts:156-200]

### Portal branding — practice-customizable
- **Brand color**: Stored in `practices.settings.brandColor` as hex string. Normalized via `normalizePortalBrandColor()` to `#RRGGBB` format or null. [VERIFIED: apps/web/lib/portal/branding.ts:1-16]
- **Default color**: `#0d9488` (teal) when no brand color is configured. [VERIFIED: apps/web/lib/portal/branding.ts:1]
- **CSS variables**: `--primary` and `--ring` set via inline style on the PortalShell. [VERIFIED: apps/web/components/portal/portal-shell.tsx:25-28]
- **Logo**: `practices.logoUrl` displayed in header; falls back to initials or default paw mark. [VERIFIED: apps/web/components/portal/portal-shell.tsx:42-62]
- **Footer branding**: "Powered by VET.IS" with privacy policy link. [VERIFIED: apps/web/components/portal/portal-shell.tsx:88-96]

---

## D. Docs-vs-reality pass

| Doc claim (paraphrase) | Verdict | Evidence |
|---|---|---|
| README: "Client portal — zdieľajte zdravotné záznamy s klientmi" | **CONFIRMED (partial)** | Portal shares vaccinations, prescriptions, weights, allergies, and appointment history. Does NOT share SOAP notes, lab results, or problem lists. [VERIFIED: portal.ts getPetDetail query shape — no SOAP/lab/problem fields] |
| README: "Online booking pre klientov" | **CONFIRMED** | Full self-service booking flow at `/portal/book` with slot suggestions, type selection, and patient verification. Requests create appointments with status=scheduled and "[Portal request]" prefix. [VERIFIED: portal.ts requestAppointment] |
| ROADMAP: "Portal s brandovaním kliniky" | **CONFIRMED** | PortalShell renders practice logo, name, and brand color from `practices` table. [VERIFIED: portal-shell.tsx; practicePortalProfile] |
| ROADMAP: "Platby cez Stripe" | **CONFIRMED** | Stripe Checkout integration via `/api/portal/checkout` with Connect direct charges for hosted clinics. [VERIFIED: checkout/route.ts] |
| "Portal je plnohodnotný EMR pre klientov" | **OVERSTATED** | Portal is read-only for clinical data (no editing). Write access limited to: messaging, appointment requests. No lab results, no SOAP notes, no problem list, no treatment plans visible. [VERIFIED: getPetDetail query shape] |
| "Portal session je trvalý" | **MISLEADING** | Sessions have 7-day absolute TTL + 30-minute idle timeout. Token exchange is single-use. Staff can revoke all sessions by rotating the access token. [VERIFIED: portal/session.ts; tokens.ts] |
| "Portal messaging je plnohodnotný chat" | **PARTIALLY ACCURATE** | Portal messaging is basic: text-only, no attachments, no read receipts for inbound messages, no typing indicators. Auto-marks outbound as read on page load. 30-second polling for new messages. [VERIFIED: messages/page.tsx refetchInterval: 30000] |
| CLAUDE.md: "Never expose accessToken in API responses" | **CONFIRMED** | `redactClientPortalAccessToken()` strips the hashed token from all client queries. Only `rotatePortalAccessToken` returns the raw token (once, to staff). [VERIFIED: clients.ts:191-220; clients.ts:938-940] |
| "Portal invoices include e-Kasa receipts" | **NOT FOUND** | No e-Kasa integration in the portal. Invoices show status, amounts, and payment buttons only. No fiscal receipt data exposed. [VERIFIED: getInvoices query shape — no ekasa fields] |
| "Portal supports multiple clients per household" | **CONFIRMED** | `getClient` returns all active patients for the client. Each pet has its own detail page. [VERIFIED: getClient query — clientPatients selects all non-deleted active patients] |

---

## E. Friction notes

### E.1 Portal access token is single-use and 15-minute TTL
The bootstrap token expires after 15 minutes AND after first use. If a client doesn't click the link within 15 minutes, staff must regenerate. For elderly or less tech-savvy clients, this window may be too tight. [VERIFIED: tokens.ts PORTAL_ACCESS_TOKEN_TTL_MS]

**Impact**: Low-severity support burden. Staff may need to re-issue tokens frequently.
**Fix effort**: Low — configurable TTL env var would allow clinics to adjust.

### E.2 No portal onboarding flow for first-time users
After exchanging the token, clients land on `/portal` with no tutorial, no explainer, and no "what can I do here" guidance. The home page assumes clients understand the UI. [VERIFIED: portal/[token]/page.tsx — no onboarding/tour]

**Impact**: Medium for adoption. Clients who receive a link without context may not understand what to do.
**Fix effort**: Medium — an intro modal or guided tour.

### E.3 Portal messaging lacks attachments
Clients cannot attach photos (e.g., wound photos, rash photos) to portal messages. The `communications` table has no attachment support, and the UI is text-only. [VERIFIED: communications schema — no attachment columns; messages/page.tsx — textarea only]

**Impact**: High for clinical utility. Photo attachments are a common client request in veterinary practice.
**Fix effort**: Medium — requires file upload handling + storage integration.

### E.4 Portal does not show lab results or SOAP notes
Despite being marketed as a "health record portal", clients cannot view lab results or SOAP notes. The `getPetDetail` query explicitly excludes these domains. [VERIFIED: portal.ts getPetDetail — no lab_results or soap_notes joins]

**Impact**: Medium for client expectations vs. reality.
**Fix effort**: Medium — requires new portal procedures with appropriate scoping.

### E.5 Appointment requests are NOT confirmed instantly
Portal booking creates appointments with status=scheduled and a "[Portal request]" prefix. Staff must manually confirm the booking. Clients see "Requested — awaiting confirmation" until staff action. [VERIFIED: appointments/page.tsx formatStatusLabel; portal.ts requestAppointment]

**Impact**: Low — this is by design (clinic-controlled scheduling), but clients may expect instant confirmation.
**Fix effort**: N/A — design decision, not a bug.

### E.6 Portal uses 30-second polling for messages
The messages page polls `trpc.portal.getMessages` every 30 seconds (`refetchInterval: 30000`). This is the same polling pattern as the staff whiteboard, flagged in the UX analysis as F2. [VERIFIED: messages/page.tsx:20]

**Impact**: Medium — delayed message delivery, unnecessary server load.
**Fix effort**: Medium — replace with SSE or WebSockets.

### E.7 Portal rate limits may be aggressive for large practices
Portal read rate limit: 120 requests per 15 minutes per session. For clients with many pets reviewing multiple tabs, this could be hit. IP rate limit: 300 per 15 minutes shared across all sessions from one IP. [VERIFIED: portal.ts PORTAL_READ_RATE_LIMIT, PORTAL_READ_IP_RATE_LIMIT]

**Impact**: Low for typical usage; Medium for power users.
**Fix effort**: Low — increase limits or make configurable.

### E.8 Portal payment requires Stripe Connect setup
Online payments only work if the practice has a configured Stripe Connect account. Without it, the "Pay" button shows "Online payment is temporarily unavailable." [VERIFIED: invoices/page.tsx PaymentUnavailable; checkout/route.ts:340-356]

**Impact**: Medium for clinics that haven't completed Stripe onboarding.
**Fix effort**: N/A — business decision, not a bug.

### E.9 Portal session idle timeout is 30 minutes
After 30 minutes of inactivity, the session expires and the client must re-enter their bootstrap token (which is likely already consumed). This means a session timeout is effectively a logout with no self-service recovery. [VERIFIED: tokens.ts PORTAL_SESSION_IDLE_TTL_MS]

**Impact**: Medium — clients who leave the tab open and return later are locked out.
**Fix effort**: Medium — could extend idle timeout or add a "still there?" prompt.

### E.10 Portal has no dark mode
The staff dashboard supports dark mode (via next-themes), but the portal is hardcoded to `bg-white` with no theme toggle. [VERIFIED: portal-shell.tsx:32 — `className="min-h-screen bg-white"`]

**Impact**: Low — accessibility/nice-to-have.
**Fix effort**: Low — add theme provider to PortalShell.

### E.11 Portal vaccination certificate PDF lacks practice signature
The generated PDF includes practice name, address, phone, email, but no digital signature or QR code for verification. This could be a concern for official submissions (e.g., travel, boarding). [VERIFIED: pdf.ts generateVaccinationCertificatePdf — no signature/QR fields]

**Impact**: Low for local use; Medium for inter-jurisdiction travel.
**Fix effort**: Medium — add QR code with verification URL.

---

## F. Proposed user-manual section(s)

### Personas
- **Client (pet owner)**: View pet health records (vaccinations, prescriptions, weights, allergies), request appointments, send messages to the clinic, view and pay invoices online.
- **Staff (admin/front desk)**: Generate portal access links, rotate/revoke portal access, view client messages in shared inbox, confirm appointment requests.

### Complexity assessment
The client portal is **moderate-complexity** content. It needs:
- **Screen-by-screen walkthrough** for first-time portal access (token exchange → session creation → navigation).
- **Reference documentation** for billing (invoice statuses, payment methods, Stripe checkout).
- **FAQ section** for common issues (expired links, session timeouts, booking confirmations).

### Recommended section structure

#### F.1 "Getting Started with Your Pet Portal" — Client persona
**Complexity**: Fits short-format help page (screen-by-screen walkthrough)

- H2: What is the Pet Portal?
  - H3: Your secure window into your pets' health records
  - H3: What you can do: view records, book appointments, message your clinic, pay invoices
- H2: Opening your portal link for the first time
  - H3: Click the link from your clinic
  - H3: Tap "Continue securely" to create your session
  - H3: Your link is single-use — it expires after you open it
- H2: Navigating your portal
  - H3: Home — your pets at a glance
  - H3: Pet detail — vaccinations, prescriptions, weight history, allergies
  - H3: Appointments — upcoming, past, and request new ones
  - H3: Messages — chat with your clinic
  - H3: Invoices — view bills and pay online

#### F.2 "Requesting an Appointment" — Client persona
**Complexity**: Fits short-format help page

- H2: How online booking works
  - H3: Your request is not confirmed until the clinic reviews it
  - H3: Pick a pet, visit type, date, and time
  - H3: Suggested times are shown when available
- H2: What happens after you submit
  - H3: "Requested — awaiting confirmation" status
  - H3: The clinic will call or message you to confirm

#### F.3 "Paying Your Invoice Online" — Client persona
**Complexity**: Fits short-format help page

- H2: Viewing your invoices
  - H3: Status meanings: draft, sent, paid, overdue, void, estimate
  - H3: Understanding balances and adjustments
- H2: Paying with a card
  - H3: Click "Pay securely online" → Stripe Checkout
  - H3: Your clinic receives the payment directly
  - H3: What happens if payment fails

#### F.4 "Portal Link Expired? Here's What To Do" — Client FAQ
**Complexity**: Short FAQ

- Q: My portal link doesn't work anymore
  - A: Links expire after 15 minutes or after first use. Contact your clinic for a new link.
- Q: I got logged out of the portal
  - A: Sessions expire after 30 minutes of inactivity or 7 days total. Contact your clinic for a new link.
- Q: Can I access the portal from multiple devices?
  - A: Yes — each device needs its own portal link from your clinic.

#### F.5 "Managing Client Portal Access" — Staff persona
**Complexity**: Reference-style documentation

- H2: Generating a portal link for a client
  - H3: Navigate to the client detail page
  - H3: Click "Generate portal link" — the link appears once
  - H3: Share the link via email, SMS, or printed handout
- H2: Revoking a client's portal access
  - H3: Click "Rotate portal link" — all existing sessions are immediately revoked
  - H3: Generate a new link and share with the client
- H2: When to revoke access
  - H3: Client reports a lost phone or compromised link
  - H3: Client relationship has ended
  - H3: Regular access token rotation (best practice)

### Cross-domain links needed
- → **Scheduling/Front Desk (domain TBD)**: Appointment request confirmation flow, appointment types configuration, location setup.
- → **Billing/Finance (domain TBD)**: Invoice lifecycle, Stripe Connect setup, payment account onboarding, estimate-to-invoice conversion.
- → **Core Clinical/EMR (domain TBD)**: Vaccination record creation, prescription management, weight recording, allergy management — all feed into the portal view.
- → **Statutory Compliance (domain TBD)**: Rabies certificate data sourcing (KVEPIS/RVPS), withdrawal period visibility.
