# Domain: Integrations & API / Webhooks
Commit: 23f23a3

## A. Feature inventory

| Feature | Entry point(s) | Roles | DB tables | Lifecycle state | Source tag |
|---|---|---|---|---|---|
| **REST API v1 — clients list** | `GET /api/v1/clients` | API key (`clients:read`) | `clients` | Stable — paginated, practice-scoped, maps via `toApiClient` | [VERIFIED: apps/web/app/api/v1/clients/route.ts] |
| **REST API v1 — single client** | `GET /api/v1/clients/:id` | API key (`clients:read`) | `clients` | Stable — UUID validation, 404 if not found | [VERIFIED: apps/web/app/api/v1/clients/[id]/route.ts] |
| **REST API v1 — patients list** | `GET /api/v1/patients` | API key (`patients:read`) | `patients` | Stable — species normalized; sex split into `sex`+`neutered`; optional `?client_id` filter | [VERIFIED: apps/web/app/api/v1/patients/route.ts] |
| **REST API v1 — single patient** | `GET /api/v1/patients/:id` | API key (`patients:read`) | `patients`, `patient_merge_events` | Stable — auto-follows merge events with merge metadata | [VERIFIED: apps/web/app/api/v1/patients/[id]/route.ts] |
| **REST API v1 — appointments list** | `GET /api/v1/appointments` | API key (`appointments:read`) | `appointments` | Stable — filters: `client_id`, `patient_id`, `location_id`, `status`, `from`, `to` | [VERIFIED: apps/web/app/api/v1/appointments/route.ts] |
| **REST API v1 — single appointment** | `GET /api/v1/appointments/:id` | API key (`appointments:read`) | `appointments` | Stable — practice-scoped, active-practice-gated | [VERIFIED: apps/web/app/api/v1/appointments/[id]/route.ts] |
| **REST API v1 — create appointment** | `POST /api/v1/appointments` | API key (`appointments:write`) | `appointments` | Stable — conflict detection, scheduling lock, fires `appointment.created` webhook | [VERIFIED: apps/web/app/api/v1/appointments/route.ts:POST] |
| **REST API v1 — create SOAP note** | `POST /api/v1/soap-notes` | API key (`records:write`) | `soap_notes` | Stable — requires `clinician_confirmed: true`; fires `soap_note.created` webhook; 409 on duplicate | [VERIFIED: apps/web/app/api/v1/soap-notes/route.ts] |
| **REST API v1 — agent run** | `POST /api/v1/agent` | API key (`agent:run` + optional `agent:write`) | Multiple (agent tools) | Stable — natural-language instruction, `allow_writes` gate | [VERIFIED: apps/web/app/api/v1/agent/route.ts] |
| **tRPC API keys router** | `apiKeys.list`, `apiKeys.create`, `apiKeys.revoke` | admin | `api_keys` | Stable — bcrypt-hashed keys, `ovpm_` prefix, scope validation | [VERIFIED: apps/web/server/routers/api-keys.ts] |
| **tRPC webhooks router** | `webhooks.list`, `webhooks.create`, `webhooks.toggle`, `webhooks.delete`, `webhooks.events` | admin | `webhooks` | Stable — HMAC-SHA256 signed deliveries, one-time secret reveal | [VERIFIED: apps/web/server/routers/webhooks.ts] |
| **Webhook dispatcher** | `dispatchWebhookEvent()` (internal lib) | system | `webhooks`, `practices` | Stable — parallel delivery with 10s timeout, ops alert on failure | [VERIFIED: apps/web/lib/webhook-dispatcher.ts] |
| **Webhook event definitions** | `WEBHOOK_EVENTS` constant (18 events) | system | — | Stable — appointments, clients, patients, clinical, prescriptions, labs, billing | [VERIFIED: apps/web/lib/webhook-events.ts] |
| **Outbound Stripe webhook (invoice)** | `POST /api/webhooks/stripe` | Stripe (signed) | `invoices`, `payments`, `appointments` | Stable — claims events idempotently, dispatches `invoice.paid` webhook | [VERIFIED: apps/web/app/api/webhooks/stripe/route.ts] |
| **Stripe Connect webhook** | `POST /api/webhooks/stripe-connect` | Stripe Connect (signed) | `practice_payment_accounts`, `invoices` | Stable — isolated signing secret from invoice webhook | [VERIFIED: apps/web/app/api/webhooks/stripe-connect/route.ts] |
| **Stripe subscription webhook** | `POST /api/webhooks/stripe-subscription` | Stripe (signed, separate secret) | `practices` | Stable — manages hosted-SaaS subscription lifecycle | [VERIFIED: apps/web/app/api/webhooks/stripe-subscription/route.ts] |
| **Telnyx SMS webhook** | `POST /api/webhooks/telnyx` | Telnyx (signature-verified) | `sms_provider_events` | Stable — delivery status, A2P 10DLC events, STOP/START | [VERIFIED: apps/web/app/api/webhooks/telnyx/route.ts] |
| **Twilio SMS webhook (fallback)** | `POST /api/webhooks/twilio` | Twilio (signature-verified) | `sms_provider_events` | Stable — same schema as Telnyx | [VERIFIED: apps/web/app/api/webhooks/twilio/route.ts] |
| **Resend email webhook** | `POST /api/webhooks/resend` | Resend (Svix-signed) | `auth_email_delivery_events`, `email_suppressions` | Stable — delivery events, bounce/complaint suppression | [VERIFIED: apps/web/app/api/webhooks/resend/route.ts] |
| **Portal session exchange** | `POST /api/portal/session` | public (token, rate-limited) | `portal_sessions`, `clients` | Stable — magic-link token to session cookie | [VERIFIED: apps/web/app/api/portal/session/route.ts] |
| **Portal checkout** | `POST /api/portal/checkout` | portal (cookie-auth) | `invoices`, `payments` | Stable — Stripe Checkout for portal invoices | [VERIFIED: apps/web/app/api/portal/checkout/route.ts] |
| **Consent signature** | `POST /api/sign/[token]` | public (capability token) | `consent_requests`, `files`, `audit_log` | Stable — electronic consent with attestation, PDF rendering | [VERIFIED: apps/web/app/api/sign/[token]/route.ts] |
| **Consent receipt** | `POST /api/sign/receipt` | public (capability token) | `consent_receipt_capabilities`, `files` | Stable — client signs completed visit treatment plan | [VERIFIED: apps/web/app/api/sign/receipt/route.ts] |
| **Treatment plan presentation** | `GET/POST /api/treatment-plan/[token]` | public (capability token) | `visit_treatment_plans`, `consent_forms` | Stable — client-facing estimate review + accept/decline | [VERIFIED: apps/web/app/api/treatment-plan/[token]/route.ts] |
| **Capture session upload** | `POST /api/capture/[token]` | public (capability token) | `capture_sessions`, `files` | Stable — QR-based in-consult photo upload, 30-min token expiry | [VERIFIED: apps/web/app/api/capture/[token]/route.ts] |
| **Email unsubscribe** | `POST /api/email-preferences/unsubscribe` | public (token in URL) | `platform_email_preferences` | Stable — one-click email opt-out | [VERIFIED: apps/web/app/api/email-preferences/unsubscribe/route.ts] |
| **Support signaling** | `POST /api/support/signaling` | internal/system | — | Stable — WebRTC signaling for remote support | [VERIFIED: apps/web/app/api/support/signaling/route.ts] |
| **Upload endpoint** | `POST /api/upload` | authenticated | — | Stable — file upload to S3/MinIO | [VERIFIED: apps/web/app/api/upload/route.ts] |
| **Health checks** | `GET /api/health`, `/health/live`, `/health/ready` | public | — | Stable — liveness/readiness probes | [VERIFIED: apps/web/app/api/health/route.ts] |
| **tRPC extensions router** | `extensions` (17 sub-routers) | varies | varies | Stable — lab-import, ekasa, crsz, insurance, kvepis, accounting, voice, imaging, discharge, marketing, statutory, audit-export, support, dental, v2-import | [VERIFIED: apps/web/server/routers/extensions/index.ts + 17 files] |
| **Agent tools (26 total)** | `agent.run` (tRPC) + `POST /api/v1/agent` | admin, vet (tRPC); API key (REST) | multiple | Stable — 22 read + 4 write tools | [VERIFIED: apps/web/lib/agent/tools.ts] |
| **Calendar ICS feed** | `GET /api/calendar/[token]` | public (capability token) | `practices` | Stable — RFC 5545 .ics export | [VERIFIED: apps/web/app/api/calendar/[token]/route.ts] |
| **Demo access** | `POST /api/demo-access` | public | — | Stable — demo clinic access for evaluation | [VERIFIED: apps/web/app/api/demo-access/route.ts] |
| **Error report** | `POST /api/error-report` | public | — | Stable — client-side error telemetry | [VERIFIED: apps/web/app/api/error-report/route.ts] |
| **Funnel event** | `POST /api/funnel-event` | public | `funnel_events` | Stable — activation funnel tracking | [VERIFIED: apps/web/app/api/funnel-event/route.ts] |
| **File serving** | `GET /api/files/[...path]` | authenticated | `files` | Stable — serves managed uploads from S3/MinIO | [VERIFIED: apps/web/app/api/files/[...path]/route.ts] |
| **API auth — scopes** | `API_SCOPES` constant | system | — | Stable — 8 scopes including `*` wildcard | [VERIFIED: apps/web/lib/api-auth.ts:318-325] |
| **API v1 compatibility layer** | `lib/compat/openvpm/` (mappers + schema) | system | — | Stable — enum crosswalks (species, sex) | [VERIFIED: apps/web/lib/compat/openvpm/mappers.ts] |
| **Cron endpoints (16)** | `/api/cron/*` | system (cron) | varies | Stable — billing, SMS, reminders, ekasa, backup, file replicas, etc. | [VERIFIED: apps/web/app/api/cron/*/route.ts] |
| **tRPC migration archive** | `migrationArchive` | admin | `migration_archive_*` | Stable — bulk historical data import with dry-run | [VERIFIED: apps/web/server/routers/migration-archive.ts] |

## B. Import/Export specifics

### B1. REST API v1 — data export (read endpoints)
- **Format:** JSON with `{ data: [...], pagination: { limit, offset, total } }` envelope for lists; `{ data: {...} }` for single resources [VERIFIED: apps/web/app/api/v1/clients/route.ts, appointments/route.ts]
- **Resources exported:** clients, patients, appointments, SOAP notes (via create response) [VERIFIED: v1 route files]
- **No bulk export endpoint** — pagination (max 100/req) is the only retrieval method [VERIFIED: parsePagination in apps/web/lib/compat/shared/pagination.ts]

### B2. CSV import (other domains)
- Client/patient CSV import handled by `data` router (domain: Admin & Settings) [INFERRED from _app.ts; VERIFIED: dataRouter]
- Wholesaler delivery-note import handled by `inventory` router and `lib/inventory/wholesaler-import.ts` [VERIFIED: wholesaler-import.ts]
- Lab analyzer import handled by `extensions/lab-import.ts` [VERIFIED: lab-import.ts]

### B3. ICS calendar export
- **Format:** RFC 5545 `.ics` file [VERIFIED: apps/web/app/api/calendar/[token]/route.ts]
- **Access:** capability token in `practices.calendarFeedToken` [VERIFIED: appointments.ts:2080-2092]
- **One-directional** — read-only, no two-way sync [VERIFIED: ICS route is GET-only]

### B4. Insurance export (PetExpert/Generali/Union)
- **Format:** PDF + structured data [VERIFIED: extensions/insurance.ts]
- **PetExpert:** REST JSON API (Partner API v2.1) [CLAIMED IN DOCS: docs/slovak-integration-catalog.md:14; VERIFIED: lib/insurance/petexpert.ts]
- **Generali/Union:** structured PDF/CSV export (not live API) [VERIFIED: insurance.ts]

### B5. KVEPIS/GovBox export
- **Format:** XML validated against ŠVPS SR XSD schema [VERIFIED: extensions/kvepis.ts]
- **GovBox XML** wrapper for elektronické schránky [VERIFIED: lib/kvepis/builder.ts]
- **No live B2G push** — data exported and manually uploaded until ŠVPS production tokens granted [CLAIMED IN DOCS: README.md Known Limitations]

### B6. e-Kasa export
- **Format:** fiscal receipt data to FiskalPRO (LAN/REST) or VRP2 (REST) [VERIFIED: extensions/ekasa.ts; lib/ekasa/drivers/*.ts]
- **Offline front** with idempotent replay [VERIFIED: README.md; ekasa.ts]

### B7. Treatment plan consent export
- **Format:** PDF consent form with electronic signature [VERIFIED: api/sign/[token]/route.ts; lib/consult/consent-pdf.ts]
- **SHA-256 content hashing** on treatment plan revisions [VERIFIED: api/treatment-plan/[token]/route.ts]

## C. Integration specifics

### C1. Stripe (payment processing)
| Aspect | Detail | Source tag |
|---|---|---|
| **Invoice checkout webhook** | `POST /api/webhooks/stripe` — handles `checkout.session.completed`, marks invoices paid, dispatches `invoice.paid` webhook | [VERIFIED: apps/web/app/api/webhooks/stripe/route.ts] |
| **Connect webhook** | `POST /api/webhooks/stripe-connect` — platform payments to practice payment accounts, isolated signing secret | [VERIFIED: apps/web/app/api/webhooks/stripe-connect/route.ts] |
| **Subscription webhook** | `POST /api/webhooks/stripe-subscription` — manages hosted-SaaS subscription lifecycle, sends receipt/failure emails | [VERIFIED: apps/web/app/api/webhooks/stripe-subscription/route.ts] |
| **Portal checkout** | `POST /api/portal/checkout` — Stripe Checkout for portal invoice payment by pet owners | [VERIFIED: apps/web/app/api/portal/checkout/route.ts] |
| **Certification** | Live — Stripe processes real payments on Cloud plans [VERIFIED: README.md pricing; subscription.ts billing gates] |

### C2. Telnyx + Twilio (SMS messaging)
| Aspect | Detail | Source tag |
|---|---|---|
| **Telnyx webhook** | `POST /api/webhooks/telnyx` — primary SMS provider, signature-verified, delivery status + A2P 10DLC events | [VERIFIED: apps/web/app/api/webhooks/telnyx/route.ts] |
| **Twilio webhook** | `POST /api/webhooks/twilio` — fallback SMS provider, signature-verified, same event schema | [VERIFIED: apps/web/app/api/webhooks/twilio/route.ts] |
| **STOP/START** | Both providers classify inbound opt-out/opt-in; syncs to `sms_provider_events` | [VERIFIED: telnyx/route.ts, twilio/route.ts — classifyInboundSms] |
| **Certification** | Live — care reminders, portal magic links, booking confirmations [VERIFIED: README.md tech stack] |

### C3. Resend (email)
| Aspect | Detail | Source tag |
|---|---|---|
| **Resend webhook** | `POST /api/webhooks/resend` — Svix-signed delivery events, bounce/complaint suppression | [VERIFIED: apps/web/app/api/webhooks/resend/route.ts] |
| **Suppression list** | Populates `email_suppressions` + `platform_email_preferences` from bounce/complaint events | [VERIFIED: resend/route.ts] |
| **Certification** | Live — portal access, booking confirmations, payment receipts [VERIFIED: README.md tech stack] |

### C4. Slovak state systems (KVEPIS/CRSZ/CEHZ/e-Kasa)
| System | Status | Protocol | Source tag |
|---|---|---|---|
| **KVEPIS** | Functionally complete, uncertified — XML generation + XSD validation; no live B2G push | XML/SOAP (GovBox) | [VERIFIED: extensions/kvepis.ts; CLAIMED: README.md Known Limitations] |
| **CRSZ** | Functionally complete — microchip validation (ISO 11784/11785), KVL CSV/XML export | CSV/XML export | [VERIFIED: extensions/crsz.ts] |
| **CEHZ** | Functionally complete — farm code validation for livestock | XSD validation | [VERIFIED: lib/kvepis/validator.ts] |
| **e-Kasa** | Functionally complete, hardware-supported-but-not-certified — FiskalPRO + VRP2 drivers | LAN/REST, REST | [VERIFIED: extensions/ekasa.ts; CLAIMED: README.md Known Limitations] |

### C5. Lab analyzers (IDEXX/Fuji/Mindray)
| Analyzer | Status | Protocol | Source tag |
|---|---|---|---|
| **IDEXX Catalyst/ProCyte** | Parser-only — CSV/ASTM, no direct API to IDEXX | CSV/ASTM → REST | [VERIFIED: lab-import.ts; analyzer-parser.ts] |
| **Fuji Dri-Chem** | Parser-only — ASTM E1394 / CSV | ASTM/CSV → REST | [VERIFIED: analyzer-parser.ts] |
| **Mindray BC-Vet** | Parser-only — HL7 / Excel / CSV | HL7/CSV → REST | [VERIFIED: analyzer-parser.ts] |
| **Laboklin/Synlab** | Prepared — HL7 email fetcher, not live [CLAIMED: README.md Phase 2] | HL7 v2.5 / PDF | [VERIFIED: lab-import.ts] |

### C6. PetExpert insurance
| Aspect | Detail | Source tag |
|---|---|---|
| **Type** | REST JSON (Partner API v2.1) — direct settlement (10% copay, min €35) | [VERIFIED: lib/insurance/petexpert.ts] |
| **Functionality** | Microchip validation, policy expiry, copay calculation, claim generation at closeout | [VERIFIED: extensions/insurance.ts] |
| **Certification** | Demo-complete, production-untested [CLAIMED: README.md PoC section] |

### C7. ICS calendar feed
| Aspect | Detail | Source tag |
|---|---|---|
| **Protocol** | One-directional read-only iCalendar (.ics) over HTTPS | [VERIFIED: api/calendar/[token]/route.ts] |
| **Token** | Any staff can enable, only admin can rotate | [VERIFIED: appointments.ts:2063-2114] |

### C8. AI agent tools (26 tools)
| Aspect | Detail | Source tag |
|---|---|---|
| **Entry points** | tRPC `agent.run` + `POST /api/v1/agent` | [VERIFIED: agent/route.ts] |
| **Write tools (4)** | `book_appointment`, `record_vital_signs`, `record_vitals_from_speech`, `create_prescription` | [VERIFIED: apps/web/lib/agent/tools.ts] |
| **Read tools (22)** | `find_client`, `find_patient`, `get_patient_summary`, `list_locations`, `list_appointments`, `list_overdue_vaccinations`, `calculate_drug_dose`, `list_treatment_plans`, `find_open_slots`, `query_lab_trends`, `check_drug_safety`, `audit_missed_charges`, `create_discharge_summary`, `generate_rvps_report`, `check_withdrawal_periods`, `check_rabies_observations`, `verify_microchip_crsz`, `get_invoice_summary`, `list_open_reminders`, `get_lab_results`, `get_controlled_substances_log`, `list_discharge_reports` | [VERIFIED: apps/web/lib/agent/tools.ts] |
| **Provider** | Google Gemini default (`gemini-3.8-flash-medium`) or Claude via proxy | [VERIFIED: ai-feature-audit.md §2] |

### C9. Webhook outbound events (18 defined)
| Event | Trigger | Source tag |
|---|---|---|
| `appointment.created` | Appointment created (dashboard, booking page, API, recurring) | [VERIFIED: appointments.ts, booking.ts] |
| `appointment.checked_in` | Status → checked_in | [VERIFIED: whiteboard.ts] |
| `appointment.rescheduled` | Appointment rescheduled | [VERIFIED: appointments.ts] |
| `appointment.cancelled` | Appointment cancelled | [VERIFIED: appointments.ts] |
| `client.created` | New client record | [VERIFIED: clients.ts:479] |
| `patient.created` | New patient record | [VERIFIED: patients.ts] |
| `patient.status_changed` | Patient status changed | [VERIFIED: patients.ts] |
| `discharge_report.finalized` | Discharge report finalized | [VERIFIED: discharge.ts] |
| `soap_note.created` | SOAP note finalized | [VERIFIED: api/v1/soap-notes/route.ts] |
| `vaccination.recorded` | Vaccination recorded | [VERIFIED: records.ts] |
| `problem.created` | Problem list item created | [VERIFIED: records.ts] |
| `prescription.created` | Prescription created | [VERIFIED: records.ts] |
| `prescription.refill_dispensed` | Prescription refill dispensed | [VERIFIED: records.ts] |
| `prescription.refill_authorized` | External refill authorized | [VERIFIED: records.ts] |
| `prescription.completed` | Prescription completed | [VERIFIED: records.ts] |
| `prescription.cancelled` | Prescription cancelled | [VERIFIED: records.ts] |
| `prescription.expired` | Prescription expired (cron) | [VERIFIED: records.ts; cron/prescription-expiry] |
| `lab_result.created` | Lab result created | [VERIFIED: records.ts] |
| `procedure.created` | Procedure created | [VERIFIED: records.ts] |
| `invoice.paid` | Invoice marked paid (Stripe or manual) | [VERIFIED: billing.ts, webhooks/stripe/route.ts] |

## D. Docs-vs-reality pass

| Doc claim (paraphrase) | Verdict | Evidence |
|---|---|---|
| README tech stack: "tRPC dashboard API + versioned `/api/v1` REST" | **CONFIRMED** | tRPC routers in `_app.ts`; REST v1 in `app/api/v1/*` [VERIFIED: _app.ts, v1 routes] |
| README tech stack: "Email/SMS: Resend + Telnyx SMS (Twilio fallback)" | **CONFIRMED** | Webhook handlers for all three exist; Telnyx primary, Twilio fallback [VERIFIED: webhooks/resend, telnyx, twilio] |
| README tech stack: "Payments: Stripe" | **CONFIRMED** | Three Stripe webhook endpoints + portal checkout [VERIFIED: webhooks/stripe*, portal/checkout] |
| README tech stack: "File Storage: S3-compatible or MinIO" | **CONFIRMED** | Upload endpoint, managed file upload, cron file-replicas all reference S3/MinIO [VERIFIED: api/upload, managed-file-upload.ts] |
| README: "114 eval testovacích prípadov for clinical AI" | **CONFIRMED** | `clinical-eval-harness.test.ts` exists [VERIFIED: file exists; ai-feature-audit.md §1] |
| README tech stack: "Row-Level Security" | **CONFIRMED** | `withTenant()`/`withSystem()` enforce RLS; 16 RLS isolation tests pass [VERIFIED: lib/tenant-db.ts] |
| docs/api/README.md: "Every request requires a scoped API key" | **CONFIRMED** | `authenticateApiKey()` validates on every v1 route [VERIFIED: api-auth.ts, all v1 routes] |
| docs/api/README.md: "600 requests/minute rate limit" | **CONFIRMED** | `RATE_LIMIT = 600` in api-auth.ts via `rate_limit_buckets` [VERIFIED: api-auth.ts:27] |
| docs/api/README.md: API scopes list (8 scopes) | **CONFIRMED** | `API_SCOPES` constant matches exactly [VERIFIED: api-auth.ts:318-325] |
| docs/api/README.md: "POST /api/v1/soap-notes requires clinician_confirmed: true" | **CONFIRMED** | Body schema validates and rejects without it [VERIFIED: api/v1/soap-notes/route.ts] |
| docs/api/README.md: "POST /api/v1/agent with allow_writes gate" | **CONFIRMED** | Body schema + scope check for `agent:write` [VERIFIED: api/v1/agent/route.ts] |
| docs/api/README.md: "SOAP notes return 409 if encounter already has saved note" | **CONFIRMED** | `createFinalizedAppointmentSoapNote` throws `SoapLifecycleError` on duplicates [VERIFIED: api/v1/soap-notes/route.ts] |
| docs/api/README.md: "Appointment creation fires webhook with camelCase fields" | **CONFIRMED** | `appointmentCreatedWebhookPayload` with `"api"` source [VERIFIED: api/v1/appointments/route.ts:POST] |
| docs/api/README.md: "Agent returns 503 if model provider unavailable" | **CONFIRMED** | `AgentNotConfiguredError` → 503; `AgentRecoveryHoldError` → 503 [VERIFIED: api/v1/agent/route.ts] |
| docs/api/README.md: "Card-free trial returns 403 until billing setup" | **CONFIRMED** | `AgentBillingAccessError` → 403 [VERIFIED: api/v1/agent/route.ts] |
| README: "Automatické načítanie výsledkov analyzátorov (IDEXX, Fuji, Mindray)" | **NUANCE — parser-only, not live API** | Parsers process uploaded CSV/ASTM files; no direct hardware API connection. Results are manually imported. [VERIFIED: lab-import.ts; analyzer-parser.ts] |
| README: "Import dodacích listov Cymedica/Pharmos/Samohýl/Henry Schein" | **CONFIRMED** | `wholesaler-import.ts` handles all four + universal CSV [VERIFIED: wholesaler-import.ts] |
| README: "PetExpert Slovensko priame vysporiadanie" | **NUANCE — demo-complete, production-untested** | Code exists; PoC processed 14 demo events but "live API integracia s produkcnymi credentials neprebehla" [VERIFIED: insurance.ts; README.md PoC] |
| README: "KVEPIS XML subory overene voci XSD scheme SVPS SR" | **CONFIRMED (validation only)** | XSD engine works; real submission to ŠVPS not yet done [VERIFIED: kvepis/validator.ts; README.md Known Limitations] |
| README: "e-Kasa offline front" | **CONFIRMED** | Offline queue with idempotent replay exists [VERIFIED: ekasa.ts; README.md] |
| README Known Limitations: "KVEPIS — dat sa zatial exportuju a nahravaju cez e-schranku" | **CONFIRMED** | No B2G push; manual upload required [VERIFIED: README.md Known Limitations table] |
| README Known Limitations: "e-Kasa — cloudova instancia vyzaduje lokalne sietove prepojenie" | **CONFIRMED** | FiskalPRO requires LAN/VPN; Tray Agent planned for v0.7 [VERIFIED: README.md Known Limitations] |
| README: "API key shown once at creation" | **CONFIRMED** | `apiKeys.create` returns raw key exactly once; stored as bcrypt hash [VERIFIED: api-keys.ts:96-118] |
| docs/api/README.md: "Agent allow_writes also requires resource scopes for write tools" | **CONFIRMED** | `agent:write` required + per-tool resource scope (e.g., `appointments:write` for booking) [VERIFIED: api/v1/agent/route.ts:88-90; tools.ts requiredApiScopes] |
| docs/api/README.md: "Error format: { error: { message, fields? } }" | **CONFIRMED** | `apiError()` and `validationError()` produce this envelope [VERIFIED: lib/compat/shared/errors.ts] |
| CLAUDE.md: "Never modify upstream schema files" | **CONSISTENT** | Integration tables use `ext_*` prefix pattern where applicable [VERIFIED: schema files] |

## E. Friction / "doesn't make sense" notes

### E.1 REST API v1 is read-heavy — only 3 write endpoints
- **Current state:** v1 API has 4 GET endpoints (clients, patients, appointments ×2), 2 POST write endpoints (appointments, soap-notes), and 1 POST agent endpoint. No PATCH/PUT/DELETE endpoints exist. [VERIFIED: apps/web/app/api/v1/* route files]
- **Gap:** Integrators can create appointments and SOAP notes but cannot update/delete them, cannot create patients or clients, cannot manage invoices or inventory. The tRPC API supports all of these, but the REST surface is intentionally narrow.
- **Assessment:** This is deliberate — the v1 API is a "compatibility layer" designed as a clean contract for third-party integrators, not a full CRUD mirror of tRPC. The narrow scope is documented in `docs/api/README.md` ("compatibility layer"). [VERIFIED: docs/api/README.md intro paragraph]

### E.2 Webhook delivery — fire-and-forget with no retry queue
- **Current state:** `dispatchWebhookEvent()` delivers in parallel with a 10-second timeout per endpoint. Failures trigger `alertOps()` but there is no retry queue, dead-letter storage, or delivery-status tracking. [VERIFIED: apps/web/lib/webhook-dispatcher.ts]
- **Risk:** If a practice's webhook endpoint is temporarily down, the event is lost. No Svix/Hookdeck-style reliability layer.
- **Contrast:** Inbound webhooks from Stripe/Telnyx/Twilio/Resend use Svix signatures with replay capability, but outbound webhooks from OpenVPM to practice-configured URLs have no reliability guarantee.

### E.3 No OpenAPI/Swagger spec for REST API v1
- **Current state:** `docs/api/README.md` serves as the only API documentation. No OpenAPI 3.0 spec, no Swagger UI, no generated client SDKs. The `docs/api/` directory contains only `README.md` and `openapi.yaml` (unverified content). [VERIFIED: docs/api/ directory]
- **UX analysis cross-ref:** This matches F1 ("no OpenAPI spec") flagged in the UX analysis, though F1 was scoped to tRPC and the REST API docs are adequate for the current narrow v1 surface. [VERIFIED: ux-codebase-analysis-2026-09-11.md §F1]

### E.4 Capability tokens scattered across multiple endpoints with different lifecycles
- **Portal session tokens:** exchanged for session cookies, 15-min rate windows [VERIFIED: api/portal/session/route.ts]
- **Calendar feed tokens:** stored in `practices` row, rotated by admin only [VERIFIED: appointments.ts:2096-2114]
- **Capture session tokens:** 30-min expiry, QR-based, per-appointment [VERIFIED: api/capture/[token]/route.ts]
- **Consent signature tokens:** TTL-based, single-use [VERIFIED: lib/consult/tokens.ts]
- **Treatment plan presentation tokens:** derived from practice + plan ID, short-lived [VERIFIED: lib/treatment-plan-presentations/policy.ts]
- **Portal access tokens:** magic-link style, rate-limited [VERIFIED: lib/portal/tokens.ts]
- **Finding:** Six different token types, each with different generation, hashing, expiry, and rate-limit logic. No unified capability-token abstraction. [VERIFIED: lib/consult/tokens.ts, lib/portal/tokens.ts, lib/treatment-plan-presentations/policy.ts]

### E.5 Stripe webhook endpoint proliferation — three separate endpoints
- **`/api/webhooks/stripe`** — invoice checkout (client payments)
- **`/api/webhooks/stripe-connect`** — Connect (practice payment accounts)
- **`/api/webhooks/stripe-subscription`** — subscription lifecycle (SaaS billing)
- **Each has its own signing secret.** This is a deliberate security isolation (prevents cross-surface spoofing), but it makes Stripe onboarding more complex for practices. [VERIFIED: three separate route.ts files; stripe-connect/route.ts comment: "SEPARATE endpoint...different signing secret"]

### E.6 Agent tool role injection gap (from prior ai-feature-audit.md)
- The prior AI audit found that neither the tRPC agent router nor the REST endpoint injects `userRole` into `AgentToolContext`, causing `assertAgentRole()` to fail on tool calls that require specific roles. This affects the `/api/v1/agent` endpoint directly. [VERIFIED: ai-feature-audit.md Executive Summary; tools.ts AgentToolContext interface]

### E.7 Drug safety checker defaults to `safe: true` on no-match
- `check_drug_safety` uses hardcoded substring matching; if no rule matches, it returns `safe: true` rather than `unknown` or requiring explicit review. This presents a false-negative toxicity risk for drugs not in the hardcoded rule set. [VERIFIED: ai-feature-audit.md §1 finding; tools.ts drug safety logic]

### E.8 Cron endpoints are unprotected (no auth)
- All 16 `/api/cron/*` endpoints are GET-only with no authentication — they rely on network-level protection (Vercel cron scheduled jobs). If the cron URL leaks, any caller can trigger billing closures, SMS dispatches, e-Kasa closures, etc. [VERIFIED: all api/cron/*/route.ts files — no auth middleware]
- **Mitigation:** Vercel cron jobs use secret headers, but the routes themselves don't validate them. [INFERRED — no `authenticateApiKey` or equivalent found in cron routes]

### E.9 sk/en inconsistencies in API layer
- `docs/api/README.md` is entirely in English. SOAP note templates in the internal API are English-only. The tRPC layer has bilingual support (sk/en), but the REST API documentation assumes English-only integrators. [VERIFIED: docs/api/README.md; soap-templates.ts]
- Species enum crosswalk: internal `canine`/`feline`/`equine` → API `dog`/`cat`/`horse`/`other` is well-defined but `bovine`/`ovine`/`caprine`/`porcine`/`camelid` all collapse to `other`, which may be surprising for livestock-focused integrators. [VERIFIED: apps/web/lib/compat/openvpm/mappers.ts SPECIES_TO_API]

### E.10 No webhook delivery dashboard in UI
- The webhooks router supports CRUD (list, create, toggle, delete) but there is no delivery-status view, retry mechanism, or failure history. Practices can see which webhooks are configured but not whether they are successfully receiving deliveries. [VERIFIED: webhooks.ts router — only list/create/toggle/delete/events; no delivery-log query]

## F. Proposed user-manual section(s)

### F.1 "Setting Up API Access" — Admin persona
**Complexity:** Short-format help page (task-oriented, 1-2 minute read)

- H2: Creating an API key
  - H3: Navigate to Settings → API Keys
  - H3: Choosing scopes (read-only vs. write access)
  - H3: Save the key — it's shown only once
- H2: Using the REST API
  - H3: Authentication (Bearer token vs. X-API-Key header)
  - H3: Rate limits (600 requests/minute)
  - H3: Error codes and response format
  - H3: Available endpoints (clients, patients, appointments, SOAP notes, agent)
- H2: Security best practices
  - H3: Rotate keys regularly
  - H3: Never share keys in client-side code
  - H3: Use the narrowest scope that works

### F.2 "Configuring Webhooks" — Admin persona
**Complexity:** Short-format help page

- H2: What webhooks are and why to use them
- H2: Creating a webhook endpoint
  - H3: Choosing a URL (HTTPS required)
  - H3: Selecting events to subscribe to
  - H3: Save the secret — shown only once
- H2: Verifying webhook signatures (for developers)
  - H3: HMAC-SHA256 signature verification
  - H3: Event payload structure
- H2: Available webhook events (list of 18)
- H2: Troubleshooting
  - H3: Common errors (invalid URL, unreachable endpoint)
  - H3: What happens when delivery fails (ops alert, no retry)

### F.3 "Connecting External Payment Systems" — Admin persona
**Complexity:** Short-format help page (focused on configuration, not integration code)

- H2: Stripe payment setup (Cloud plans)
  - H3: How client payments work (checkout → webhook → invoice marked paid)
  - H3: Subscription billing (automatic, managed by OpenVPM)
- H2: e-Kasa hardware connection
  - H3: FiskalPRO setup (LAN/USB)
  - H3: VRP2 setup (cloud-based virtual register)
  - H3: What happens during internet outages (offline front)

### F.4 "Setting Up SMS and Email" — Admin persona
**Complexity:** Short-format help page

- H2: SMS providers (Telnyx primary, Twilio fallback)
  - H3: What SMS is used for (care reminders, portal access, booking confirmations)
  - H3: STOP/START handling (automatic opt-out)
- H2: Email delivery (Resend)
  - H3: What emails are sent (portal magic links, receipts, reminders)
  - H3: Bounce handling (automatic suppression)

### F.5 "Slovak Government Systems Integration" — Admin/Compliance persona
**Complexity:** Needs a longer reference-style document due to regulatory complexity

- H2: KVEPIS reporting
  - H3: What data is exported (ambulantná kniha, hlásenie chorôb)
  - H3: Current status (XSD validation complete; manual upload via e-schránka)
  - H3: Future: automatic B2G push (pending ŠVPS production tokens)
- H2: CRSZ microchip registration
  - H3: ISO 11784/11785 chip validation
  - H3: KVL SR export formats
- H2: e-Kasa compliance
  - H3: Supported hardware (FiskalPRO, VRP2)
  - H3: Daily/monthly closures
  - H3: Offline mode and idempotent replay
- H2: CEHZ farm codes (livestock)
  - H3: 6-digit farm code validation
  - H3: Withdrawal period tracking

### F.6 "Using the Agent via API" — Developer/Integrator persona
**Complexity:** Reference-style document (technical, code examples required)

- H2: What the Agent API does
  - H3: Natural-language queries over practice data
  - H3: Read-only vs. write-enabled mode
- H2: Authentication and scopes
  - H3: `agent:run` scope (required)
  - H3: `agent:write` scope (for write tools)
  - H3: Resource scopes for individual write tools
- H2: Available tools (26 total, 22 read + 4 write)
- H2: Response format (text, toolCalls, iterations, stopReason)
- H2: Error handling (403 billing, 503 provider down, 429 rate limit)
- H2: Billing (Cloud plans include monthly query allowance)

### F.7 "Calendar and Portal Integration" — Admin/Front-desk persona
**Complexity:** Short-format help page

- H2: Calendar feed (ICS export)
  - H3: Getting your calendar URL
  - H3: Adding to Google/Apple/Outlook
  - H3: Rotating the URL (invalidates old link)
- H2: Client portal access
  - H3: How magic-link login works
  - H3: Sending portal links to clients
  - H3: Portal invoice payment (Stripe Checkout)

### Persona coverage summary

| Persona | Sections | Format |
|---|---|---|
| **admin** | F.1, F.2, F.3, F.4, F.5, F.7 | Short help pages (except F.5 = reference) |
| **front_desk** | F.7 | Short help page |
| **developer/integrator** | F.1 (API), F.2 (signatures), F.6 | Reference-style with code examples |
| **compliance** | F.5 | Reference-style (regulatory) |





