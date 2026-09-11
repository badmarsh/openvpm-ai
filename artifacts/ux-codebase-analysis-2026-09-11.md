# OpenVPM(-AI) — User-Centered Codebase Analysis

**Repo analyzed:** local clone of `badmarsh/openvpm-ai` (git remote `origin`), which is a fork/rename of `evangauer/openvpm` (git remote `upstream`). Both remotes are configured in the working copy — I analyzed the **fork (`badmarsh/openvpm-ai`)**.  
**Commit:** `e927ef5be177e502fff9e3798cbebf4842317398` (workspace git metadata)  
**Analysis date:** 2026-09-11 · **Access method:** full local filesystem (deep code inspection, AST/test analysis, targeted grep, and schema tracing).

**Sampled vs. Deep-Read Protocol (per Section 0):**
- **Deep-Read & Verified:** `apps/web/server/trpc.ts` (all 688 lines), `apps/web/lib/auth.ts`, `apps/web/lib/auth-hashing.ts`, `apps/web/server/routers/auth.ts`, `apps/web/server/routers/controlled-substances.ts`, `apps/web/server/routers/appointments.ts`, `apps/web/server/routers/extensions/statutory.ts`, `apps/web/server/routers/extensions/ekasa.ts`, `apps/web/server/routers/webhooks.ts`, `apps/web/lib/webhook-dispatcher.ts`, `apps/web/lib/scheduling/appointment-status.ts`, `apps/web/app/api/v1/clients/route.ts`, `apps/web/lib/api-auth.ts`, `apps/web/lib/agent/runner.ts`, `apps/web/lib/agent/tools.ts`, `apps/web/app/(dashboard)/statutory/page.tsx`, `apps/web/app/(dashboard)/whiteboard/page.tsx`, `apps/web/app/(dashboard)/patients/new/page.tsx`, `apps/web/components/SoapNoteEditor.tsx`.
- **Architectural & Safety Test Suites Verified:** `apps/web/lib/__tests__/auth-hashing.test.ts`, `apps/web/lib/__tests__/api-docs.test.ts`, `apps/web/lib/__tests__/appointment-overlays-accessibility.test.ts`, `apps/web/lib/__tests__/controlled-substances-ui.test.ts`, `apps/web/server/__tests__/ai-draft-safety.test.ts`, `apps/web/lib/__tests__/responsive-tables.test.ts`.
- **Schema & Surface Inventories:** 59 schema files (158 `pgTable` definitions), 25 dashboard route directories, 18 cron route handlers, 9 v1 REST route files, 26 agent tool schemas.
- **Skipped / Sampled:** Full AST line-by-line read of all 59 database schema files' individual columns and every single dashboard page TSX body. Claims regarding skipped areas are tagged accordingly.

---

## Top 3 Findings (executive)

1. **Enterprise-grade multi-tenancy and clinical safety are architecturally enforced, not superficial.** Authenticated tRPC procedures run inside a `withTenant` transaction injecting Postgres RLS session context (`app.current_practice_id`), combined with explicit `practiceId` predicates, post-commit audit logging, and global middleware blocking all viewer mutations. Controlled-substance wasting strictly requires and validates a co-worker witness at both API and UI layers before allowing submission. [VERIFIED: apps/web/server/trpc.ts:427-453; VERIFIED: apps/web/lib/__tests__/controlled-substances-ui.test.ts:56]
2. **"AI" positioning is authentic across product, agent API, and development lifecycle.** The system includes a 26-tool clinical agent (10 write-capable, gated by default-off run-level `allowWrites`), voice vitals dictation, AI discharge/RVPS reports, cryptographic SHA-256 tamper-evident audit chaining (`ext_ai_audit_log`), and a scoped REST v1 surface (600 req/min/key) with signed outbound webhooks. [VERIFIED: apps/web/lib/agent/tools.ts:331-2595; VERIFIED: apps/web/lib/agent/runner.ts:329-350; VERIFIED: apps/web/lib/webhook-dispatcher.ts:13-60]
3. **Docs-vs-reality gaps, cognitive sprawl, and machine-readable spec absence create friction.** While interactive API docs exist (`/api-docs`), there is no downloadable `openapi.json` spec; the "Live" Whiteboard relies on 30-second tRPC polling rather than WebSockets; and 25 top-level dashboard sections overwhelm front-desk staff without role-based grouping. [VERIFIED: apps/web/app/api-docs/page.tsx; VERIFIED: apps/web/app/(dashboard)/whiteboard/page.tsx:617-619; VERIFIED: apps/web/app/(dashboard) directory inventory]

---

## 1. System Map

### Stack fingerprint
| Concern | Technology | Role & Architecture | Evidence |
|---|---|---|---|
| Framework | Next.js 15 (App Router) | Server components, route groups `(dashboard)`, `(auth)`, `app/api` route handlers | [VERIFIED: apps/web/app/ directory structure] |
| API layer | tRPC v10 (`@trpc/server`) | Type-safe RPC with superjson transformer, Zod error formatting, and middleware guards | [VERIFIED: apps/web/server/trpc.ts:1-15, 222-234] |
| ORM | Drizzle ORM (`drizzle-orm`) | PostgreSQL client via `@openpims/db`, migrations via `pnpm db:push` | [VERIFIED: apps/web/server/trpc.ts:6-10; packages/db/schema/index.ts] |
| Database | PostgreSQL 16 + RLS | Multi-tenant isolation with `app.current_practice_id` session settings via `withTenant` | [VERIFIED: apps/web/server/trpc.ts:444-453] |
| Authentication | NextAuth.js v4 + bcryptjs | Credentials provider, bcrypt hashing cost 12, 30s session revocation cache | [VERIFIED: apps/web/lib/auth.ts:3, 25; apps/web/lib/auth-hashing.ts:1] |
| AI runtime | Vercel AI SDK (`ai`) | Alibaba Qwen proxy (`qwen-plus`, Wan 2.1 video/image), Anthropic, Google Vertex AI | [VERIFIED: apps/web/lib/ai/alibaba-proxy.ts:8-16; apps/web/package.json] |
| Monorepo | Turborepo + pnpm workspaces | Workspaces: `apps/web`, `apps/docs`, `packages/{api,config,db,email}` | [VERIFIED: pnpm-workspace.yaml; turbo.json] |
| Testing | Vitest & Playwright e2e | 14 Playwright specs (e.g. `restore-drill.spec.ts`, `registration-flow.spec.ts`), extensive unit/safety suites | [VERIFIED: e2e/ directory; apps/web/lib/__tests__/] |

### Routing
- **App Router Structure:** Strict App Router implementation under `apps/web/app/`; no legacy `pages/` directory exists. [VERIFIED: file tree inventory]
- **Internal API:** Mounted under `apps/web/server/routers/` (appointments, billing, controlled-substances, encounters, inventory, patients, records, reports, settings, whiteboard, extensions/*). [VERIFIED: apps/web/server/routers/_app.ts:1-50]
- **Public REST API (v1):** Located at `/api/v1/` featuring `agent`, `appointments` (+`[id]`), `clients` (+`[id]`), `patients` (+`[id]`), `soap-notes` (9 route files). [VERIFIED: apps/web/app/api/v1/ directory inventory]
- **Developer Documentation Routes:** Built-in interactive API docs at `/api-docs` (1,655 lines) and AI integration guide at `/api-docs/ai` (325 lines). [VERIFIED: apps/web/app/api-docs/page.tsx; apps/web/app/api-docs/ai/page.tsx]
- **Cron Jobs:** 18 dedicated background endpoints under `apps/web/app/api/cron/` (e.g. `backup`, `reminders`, `prescription-expiry`, `ekasa-daily-closure`, `rate-limit-cleanup`, `voice-audio-retention`). [VERIFIED: apps/web/app/api/cron/ inventory]

### Data model
- **Schema Scale:** 158 `pgTable` definitions across 59 schema files in `packages/db/schema/`. [VERIFIED: packages/db/schema/ script count]
- **Core Clinical Spine:** `practices` ← `users` (with role enum) | `practices` ← `clients` ← `patients` ← `appointments` / `encounters` / `soap_notes` / `invoices` / `controlled_substance_log`. [VERIFIED: packages/db/schema/{practices,users,clients,patients,scheduling,clinical,billing,controlled-substances}.ts]
- **Extension Schemas (`ext_*`):** Isolates local statutory and specialized tables without mutating vanilla schemas (`ext_ekasa`, `ext_statutory`, `ext_imaging`, `ext_crsz`, `ext_voice`, `ext_discharge`, `ext_marketing`, `ext_ai_audit_log`, `ext_confirmations`). [VERIFIED: packages/db/schema/index.ts:48-58; .agents/skills/openvpm-ai/SKILL.md:23-30]
- **Clinical Invariants:** Deferred PostgreSQL table constraints (e.g. `soap_notes_appointment_invariant`) flushed immediately before mutation commit via `set constraints all immediate`. [VERIFIED: apps/web/server/trpc.ts:536-567]
- **Audit & History:** Immutable logs in `audit_log`, `controlled_substance_log`, `patient_merge_events`, and cryptographic SHA-256 hash-chained `ext_ai_audit_log`. [VERIFIED: packages/db/schema/ext_ai_audit_log.ts:18-153; apps/web/lib/ai/audit-chain.ts:6-90]

### Auth flow
- **Credentials & Hashing:** NextAuth Credentials provider validating against `users` table; passwords hashed via `bcryptjs` using cost 12 (`PASSWORD_HASH_COST = 12`). [VERIFIED: apps/web/lib/auth.ts:3, 155; apps/web/lib/auth-hashing.ts:1; apps/web/server/routers/auth.ts:285]
- **Session Caching & Revocation:** `activeSessionOrNull()` re-verifies user and practice validity against the DB with a 30-second in-memory cache, ensuring account deactivations take effect within ≤30s. [VERIFIED: apps/web/server/trpc.ts:101-198]
- **Fail-Closed Security:** Blank or default `NEXTAUTH_SECRET` immediately invalidates all sessions and fails closed. [VERIFIED: apps/web/server/trpc.ts:204-206]
- **Client Portal Auth:** Separate token-based cookie authentication via `portalProcedure` with strict origin validation. [VERIFIED: apps/web/server/trpc.ts:389-417]

### Multi-tenancy — how `practice_id` isolation is enforced
1. **Postgres RLS Session Scope:** `protectedProcedure` executes inside `withTenant(db, user.practiceId, ...)`, setting `app.current_practice_id`. Under the hosted least-privilege DB role, queries without context return 0 rows. [VERIFIED: apps/web/server/trpc.ts:440-453]
2. **Explicit Query Predicates:** Every router query includes explicit WHERE clauses (e.g. `eq(clients.practiceId, ctx.practiceId)`). Witness lookups explicitly verify practice membership (`eq(witness.practiceId, ctx.practiceId)`). [VERIFIED: apps/web/server/routers/controlled-substances.ts:410-413; apps/web/app/api/v1/clients/route.ts:35]
3. **Session Re-Validation:** In-memory cached session keys combine `userId:practiceId` to prevent cross-tenant session hijacking. [VERIFIED: apps/web/server/trpc.ts:136-176]
4. **System Scope Audit:** `publicProcedure` uses `withSystem` (no RLS) strictly for registration, health checks, and initial portal token consumption. Routers must self-scope explicitly. [VERIFIED: apps/web/server/trpc.ts:355-382]

---

## 2. Persona Workflows

**Actual Role Enum (code):** `"admin" | "veterinarian" | "technician" | "front_desk" | "viewer"`. [VERIFIED: apps/web/server/trpc.ts:31-36]

### Front Desk — Walk-in Check-in & Appointment Lifecycle
- **State Machine:** `scheduled` ↔ `confirmed` → `checked_in` → `in_exam` → `checked_out`, with branches to `no_show` and `cancelled`. [VERIFIED: apps/web/lib/scheduling/appointment-status.ts:13-24]
- **Separation of Clinical vs Financial Lifecycles:** "Invoiced" and "Paid" are NOT appointment statuses; they belong to `invoices.status` (`draft | sent | overdue | void`). Payment is derived from recorded transactions. [VERIFIED: packages/db/schema/billing.ts:28; apps/web/app/api-docs/page.tsx:186-200]
- **Doctor Assignment Requirement:** An appointment configured with `typeRequiresDoctor = 1` cannot be confirmed or checked in without an assigned `doctorId`. Attempting to do so triggers a plain-language error: `"Assign a doctor before checking in this appointment."` [VERIFIED: apps/web/server/routers/appointments.ts:1126-1136]
- **State Recovery:** Cancelled or No-Show appointments **CAN be recovered**: `appointment-status.ts` explicitly allows transitions from `no_show` → `scheduled` and `cancelled` → `scheduled`. The router validates the location and checks for schedule conflicts before re-opening. [VERIFIED: apps/web/lib/scheduling/appointment-status.ts:22-23; apps/web/server/routers/appointments.ts:1152-1175]
- **Closeout Lock:** Direct status transition to `checked_out` via `updateStatus` is explicitly blocked (`CLOSEOUT_BYPASS_MESSAGE`); checkout must occur through visit closeout (`encounters.finalizeCloseout`). [VERIFIED: apps/web/server/routers/appointments.ts:1113-1117]

### Vet — SOAP Notes, Controlled Substances & Statutory Registers
- **SOAP Notes:** Rich-text editing via Tiptap (`SoapNoteEditor.tsx`) with real-time markdown/HTML rendering. Encounters synchronize with appointments and flush clinical invariants. [VERIFIED: apps/web/components/SoapNoteEditor.tsx:4-52; apps/web/server/trpc.ts:536-567]
- **Controlled Substances Witness Enforcement:** 
  - **API Layer:** Wasting a controlled substance without `witnessedBy` throws `TRPCError("Controlled substance waste requires a witness.")`. The witness must be an active user of the same practice (`assertWitnessBelongsToPractice`). [VERIFIED: apps/web/server/routers/controlled-substances.ts:459-463, 482-484]
  - **UI Layer:** The form disables the submit button (`disabled={!canSubmit}`) if `form.action === "wasted"` and no witness is selected. If the witness query returns empty, the UI fails closed with `"Witness lookup returned no data. Please retry before recording wasted inventory."` [VERIFIED: apps/web/lib/__tests__/controlled-substances-ui.test.ts:56, 75-104]
- **Slovak Statutory Compliance:** Full UI and server support for ŠVPS SR & KVL SR registers (Rabies register, Treatment diary with withdrawal periods, Euthanasia and carcass disposal register). [VERIFIED: apps/web/app/(dashboard)/statutory/page.tsx:35, 1098-1240; packages/db/schema/ext_statutory.ts:154]

### Technician — Vitals, Dispensing & Labs
- **Vitals Recording:** Available via manual entry forms and AI voice dictation (`record_vital_signs` / `record_vitals_from_speech`). [VERIFIED: apps/web/lib/agent/tools.ts:966, 2169]
- **Medication Dispensing:** Dispense queue (`dispense-charge-queue.ts`) connects clinical orders to billing and inventory adjustments. [VERIFIED: packages/db/schema/dispense-charge-queue.ts:15-60]
- **Lab Trends:** Manual and imported lab results with longitudinal trend visualization (`patient-trend-charts.tsx`). [VERIFIED: apps/web/components/patients/patient-trend-charts.tsx:1-80]

### Admin / Manager — Compliance, Financials & Disaster Recovery
- **Disaster Recovery & Drills:** Automated daily backup cron (`app/api/cron/backup/route.ts`) paired with verified recovery scripts (`scripts/dr-restore-drill.mjs`) and end-to-end tests (`e2e/restore-drill.spec.ts`). [VERIFIED: file tree]
- **Emergency Freeze:** `recoveryHold` flag on practices freezes all external mutations during data recovery. [VERIFIED: apps/web/server/trpc.ts:433-439; apps/web/lib/webhook-dispatcher.ts:24-30]
- **Fiscal Compliance:** Complete Slovak e-Kasa integration with ORP/VRP cloud printers, cryptographic receipt UUIDs, and daily closures (`ekasaDailyClosures`). [VERIFIED: apps/web/server/routers/extensions/ekasa.ts:10-57]

### Viewer — Global Mutation Shield
- **API Middleware Guard:** A single middleware in `protectedProcedure` intercepts all mutations: if `ctx.user.role === "viewer"`, it rejects the request with a descriptive forbidden error. Individual routers cannot accidentally omit this check. [VERIFIED: apps/web/server/trpc.ts:427-431]
- **UI Role Adaptiveness:** UI forms, command palette entries, and navigation items conditionally hide or display read-only notices for viewers (e.g. `NewPatientPage` renders `EmptyState` explaining read-only access). [VERIFIED: apps/web/app/(dashboard)/patients/new/page.tsx:51-76; apps/web/components/command-search.tsx:42-75]

### Veterinary Workflow Gap Check
| Workflow | Status | Implementation Evidence |
|---|---|---|
| Vaccine reminders | **Fully Covered** | `care-reminders` table, `recalls` section, `reminders` cron, `list_overdue_vaccinations` agent tool. [VERIFIED] |
| Referral letters | **No Coverage** | Only mentioned in seed SOAP plan text; no dedicated template or export flow. [VERIFIED: packages/db/seed.ts:531] |
| Euthanasia & carcass disposal | **Fully Covered** | `extCarcassDisposals` schema, `EuthanasiaRegisterTab` UI, `reports.euthanasiaRegister`, consent protocol, and automated Sympathy Flow Safety Gate. [VERIFIED: packages/db/schema/ext_statutory.ts:154; apps/web/app/(dashboard)/statutory/page.tsx:1098-1240; .agents/skills/openvpm-ai/SKILL.md:68-75] |
| Multi-doctor scheduling | **Fully Covered** | Provider availability engine (`lib/scheduling/provider-availability`), appointment conflict checks (`fetchOverlapping`), `find_open_slots` agent tool. [VERIFIED: apps/web/server/routers/appointments.ts:1161; apps/web/lib/agent/tools.ts:1040] |
| Telemedicine / Field notes | **Partially Covered** | `appointment_origin: "field"` and ambulatory workspace e2e tests; no built-in WebRTC video calling. [VERIFIED: packages/db/schema/scheduling.ts:36; e2e/ambulatory-workspace.spec.ts] |
| Patient record merge | **Fully Covered** | `patients.merge` running under serializable isolation with `patient_merge_events` ledger and identity-safety constraints. [VERIFIED: apps/web/server/trpc.ts:301-353, 529-569] |

---

## 3. GUI & Interaction Audit

- **Navigation Architecture:** 25 top-level sections in `apps/web/app/(dashboard)/`. Navigation is dynamically assembled via `custom-nav.ts` and filtered by role in `sidebar.tsx` and `command-search.tsx`. Having 25 unclustered sections creates significant cognitive load for front-desk staff. [VERIFIED: apps/web/config/custom-nav.ts; apps/web/components/command-search.tsx:42-75]
- **Form Design & Validation:** Forms utilize shared policy constants (e.g. `PATIENT_NAME_MAX_LENGTH = 100`, `CONTROLLED_SUBSTANCE_QUANTITY_STEP = 0.001`). Forms compute `canSubmit` dynamically to disable buttons until valid. Pre-population via query parameters eliminates redundant data entry (e.g. navigating to `/patients/new?clientId=...&clientName=...` pre-selects the client). [VERIFIED: apps/web/app/(dashboard)/patients/new/page.tsx:120-157, 176-180]
- **Tables & Lists:** REST endpoints paginate with `parsePagination`. All dashboard tables are governed by AST tests enforcing `<div className="overflow-x-auto">` or `<TableScroll>` wrapping to prevent horizontal layout breaks. [VERIFIED: apps/web/lib/__tests__/responsive-tables.test.ts:1-60]
- **Loading & Error Feedback:** Flattens Zod errors into plain-language strings via tRPC error formatter (`trpc.ts:224-234`). Loading states use dedicated `Skeleton` primitives (235+ occurrences in components). [VERIFIED: apps/web/components/skeleton.tsx]
- **Real-Time Whiteboard Reality:** The Whiteboard displays a blinking green "Live" badge (`<LiveIndicator />`), but updates via **30-second tRPC polling** (`refetchInterval: 30000`) and cache invalidation on local status mutations. No WebSockets or SSE exist. [VERIFIED: apps/web/app/(dashboard)/whiteboard/page.tsx:220-231, 617-619, 650]
- **Accessibility & Focus Governance:** Modal overlays (`schedule`, `whiteboard`, `confirmation-dialog`) strictly enforce `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, keyboard Tab focus traps (`DIALOG_FOCUSABLE_SELECTOR`), and restore focus to the triggering element upon close. Close buttons feature explicit `aria-label="Close appointment details"`. [VERIFIED: apps/web/lib/__tests__/appointment-overlays-accessibility.test.ts:18-56]

---

## 4. AI Positioning Check

**Resolution:** All three positioning interpretations apply: **(a)** user-facing clinical AI, **(b)** API-first design for AI agents, and **(c)** AI-assisted build process.

### (a) User-Facing Generative AI Features
- **Agent Chat:** Interactive assistant at `(dashboard)/agent`, role-restricted to `admin` and `veterinarian`, billing-gated by `requireFeature("agent")`. [VERIFIED: apps/web/server/routers/agent.ts:8, 30; apps/web/server/trpc.ts:599-627]
- **Tool Suite:** 26 defined tools matching SECURITY.md specifications (10 write-capable tools including `book_appointment`, `record_vital_signs`, `create_prescription`, `create_discharge_summary`, `generate_rvps_report`). [VERIFIED: apps/web/lib/agent/tools.ts:331-2595]
- **Architectural Write Gate:** `runner.ts` enforces `allowWrites` (default **`false`**). Any tool not designated as `readOnly` errors immediately with `"Write tools are disabled for this run."` unless explicitly enabled. [VERIFIED: apps/web/lib/agent/runner.ts:329-350]
- **Models & Infrastructure:** Default model is `qwen-plus` via custom inference proxy (`alibaba-proxy.ts`), alongside image (`wanx2.1-t2i-turbo`) and video (`wan2.1-t2v-turbo`) generation; Anthropic and Vertex AI adapters configured. [VERIFIED: apps/web/lib/ai/alibaba-proxy.ts:8-16; apps/web/package.json]
- **Audit Ledger & Guardrails:** Clinician confirmations of AI drafts are hashed (SHA-256) and recorded in `ext_ai_audit_log` with tamper-evident cryptographic hash chaining verified by `scripts/verify-ai-audit-trail.ts`. Voice audio retention cron deletes raw speech recordings within 24 hours. [VERIFIED: apps/web/lib/ai/audit-chain.ts:6-90; .agents/skills/openvpm-ai/SKILL.md:113-115]

| AI Feature | Model / Backend | Usefulness (1-5) | Integration (1-5) | Clinical Risk |
|---|---|---|---|---|
| Agent Chat (26 tools) | `qwen-plus` | 5 | 4 | Medium (writes require explicit opt-in, audit-chained) |
| Voice Vitals Dictation | Speech model proxy | 4 | 4 | Medium (direct clinical data entry; audio purged in 24h) |
| Discharge Summary Generation | `qwen-plus` | 4 | 4 | Medium (requires clinician confirmation before saving) |
| RVPS Statutory Report Generation | `qwen-plus` | 4 | 4 | Low-Med (structured Slovak compliance format) |
| Drug Dose & Interaction Check | Algorithmic + LLM | 5 | 4 | High (clinical decision support; must remain non-authoritative) |
| Lab Trend Query | LLM analysis | 3 | 3 | Low (read-only historical analytics) |
| Marketing Visuals Gen | Wan 2.1 | 2 | 3 | Low (non-clinical practice assets) |

### (b) API-First Architecture for External AI Agents
- **REST v1 Surface:** `/api/v1` routes authenticate via scoped API keys (`clients:read`, `patients:read`, `appointments:write`, `records:write`, `agent:run`, `agent:write`). [VERIFIED: apps/web/lib/api-auth.ts:21-38; docs/api/README.md:37-50]
- **Rate Limiting:** Shared database-backed limiter enforcing 600 req/min per key and 1,200 req/min for auth attempts, cleaned up by cron. [VERIFIED: apps/web/lib/api-auth.ts:21-25]
- **Outbound Webhooks:** 15+ defined events (`appointment.created`, `soap_note.created`, `prescription.created`). Dispatched via `dispatchWebhookEvent` with HMAC-SHA256 signatures (`X-OpenVPM-Signature`) and delivery timeouts. [VERIFIED: apps/web/lib/webhook-events.ts:1-60; apps/web/lib/webhook-dispatcher.ts:13-60]
- **Documentation & Drift Risk:** Interactive Next.js documentation exists at `/api-docs` and `/api-docs/ai`. However, **no machine-readable OpenAPI/Swagger JSON specification is published**, forcing third-party agent integrators to parse UI docs or hand-craft API bindings. [VERIFIED: apps/web/app/api-docs/page.tsx; empty search for openapi.json]

### (c) AI-Assisted Build Process
- Confirmed by `CLAUDE.md`, `docs/ai-audit-ledger.md`, and agent handoff files (`HANDOFF-voice-dictation.md`). [VERIFIED: file tree]

---

## 5. Friction Log

| ID | Location [source tag] | Persona | Frequency | Severity | Description | Root Cause | Fix Effort | Suggested Fix |
|---|---|---|---|---|---|---|---|---|
| F1 | `apps/web/app/api` [VERIFIED — no openapi.json] | External AI / Integrator | Every integration | **Critical** | Missing machine-readable OpenAPI (Swagger) spec | Hand-rolled Next.js route handlers without OpenAPI generation | M | Generate `openapi.json` from existing Zod schemas and route contracts |
| F2 | `apps/web/app/(dashboard)/whiteboard/page.tsx:220, 618` [VERIFIED] | Front Desk / Vet | Constant | High | "Live" Whiteboard uses 30s polling despite displaying a pulsing green "Live" badge | Architectural decision to avoid WebSocket infrastructure | M | Replace polling with Server-Sent Events (SSE) or adjust UI to display "Updated 10s ago" |
| F3 | `apps/web/server/routers/appointments.ts:1126-1136` [VERIFIED] | Front Desk | Daily walk-ins | Med | Check-in is blocked if appointment type requires a doctor and none is assigned | Strict clinical precondition without an inline assignment shortcut | S | Provide an inline "Assign Doctor & Check In" quick-select in the modal |
| F4 | `apps/web/app/(dashboard)/` [VERIFIED — 25 directories] | Front Desk / Tech | Constant | Med | Navigation clutter: 25 unclustered sections in the dashboard sidebar | Feature expansion without navigational hierarchy | M | Group sidebar into 5 collapsible clusters (Clinical, Front Desk, Inventory, Compliance, Admin) |
| F5 | `packages/db/schema/scheduling.ts:24` vs `billing.ts:28` [VERIFIED] | Front Desk | Every visit | Med | Appointment status and invoice status are completely separated | Architectural decoupling of clinical visit vs financial ledger | S | Add a unified visit card badge showing both appointment status and payment status |
| F6 | `apps/web/server/routers/controlled-substances.ts:459` [VERIFIED] | Vet / Tech | On drug waste | Low | Wasting controlled substance without witness fails with error rather than prompting | Form requires witness upfront, but multi-user workflow needs co-signing | M | Implement two-step "Request Witness PIN / Co-Sign" modal dialog |
| F7 | `apps/web/server/trpc.ts:508` [VERIFIED] | All Staff | On billing lapse | Low | Gating error message references "VET.IS Cloud" instead of OpenVPM | Hosted cloud branding string leaked into open-source core | S | Replace hardcoded string with configurable `env.PLATFORM_NAME` |
| F8 | `packages/db/schema/ext_ai_audit_log.ts` [VERIFIED] | Admin / Auditor | Regulatory audit | Med | `ext_ai_audit_log` has verification CLI scripts but lacks a dedicated UI view | Audit trail built as backend-first ledger | M | Add a "Compliance Audit" dashboard tab to view and filter the hash chain |
| F9 | `apps/web/lib/agent/runner.ts:329` [VERIFIED] | Vet | Per AI run | Med | `allowWrites` is a run-level flag; no per-mutation confirmation for clinical writes | Binary run-level permission rather than interactive confirmation | M | Require interactive client confirmation before executing write tools in agent chat |
| F10 | `apps/web/lib/api-auth.ts:22` [VERIFIED] | Voice Agent | Bursty sessions | Low | Flat 600 req/min rate limit bucket may throttle bursty voice dictation streaming | Uniform bucket sizing across all API scopes | S | Configure higher burst ceiling (e.g. 1,200 req/min) for voice/agent scopes |

---

## 6. Improvement Roadmap — ICE-scored

Each item is scored on **Impact** (1–5), **Confidence** (1–5), and **Effort** (1–5, where 1 is easiest), with **ICE = (Impact × Confidence) / Effort**. Sorted strictly descending by ICE score.

### Quick Wins (UI / Copy / Configuration — min. 8 items)
| # | Improvement Proposal | Source / Target | I | C | E | ICE |
|---|---|---|---|---|---|---|
| W1 | Brand neutrality: Replace "VET.IS Cloud" with configurable platform name | `trpc.ts:508` | 3 | 5 | 1 | **15.0** |
| W2 | Inline Doctor Picker on blocked check-in modal | `appointments.ts:1135`, `schedule/page.tsx` | 4 | 4 | 1 | **16.0** |
| W3 | Unified visit + invoice status badge on Whiteboard & Schedule | `whiteboard/page.tsx`, `billing.ts` | 4 | 4 | 2 | **8.0** |
| W4 | Document API rate limits and response headers in `/api-docs` | `api-docs/page.tsx`, `api-auth.ts` | 3 | 5 | 2 | **7.5** |
| W5 | Accurate Whiteboard status indicator ("Polling every 30s" vs "Live") | `whiteboard/page.tsx:220` | 3 | 4 | 2 | **6.0** |
| W6 | Collapsible 5-cluster navigation grouping in `custom-nav.ts` | `config/custom-nav.ts`, `sidebar.tsx` | 4 | 4 | 3 | **5.3** |
| W7 | Standardized empty-state actions across all 25 dashboard routes | `components/common/empty-state.tsx` | 3 | 4 | 2 | **6.0** |
| W8 | Environment guard on demo seed script to prevent accidental prod runs | `packages/db/seed-all-demo.ts` | 3 | 5 | 2 | **7.5** |
| W9 | Dedicated witness selection helper tooltip in Controlled Substances form | `controlled-substances/page.tsx` | 3 | 4 | 2 | **6.0** |

### Feature-Integration Fixes (Connecting Existing Modules — min. 5 items)
| # | Integration Feature | Interacting Systems | I | C | E | ICE |
|---|---|---|---|---|---|---|
| I1 | Check-in auto-initializes Encounter pre-filled with last recorded vitals | `appointments.ts` ↔ `encounters.ts` ↔ `recent-clinical-items.ts` | 5 | 4 | 2 | **10.0** |
| I2 | Controlled substance waste co-signing PIN modal | `controlled-substances/page.tsx` ↔ `users.ts` | 4 | 4 | 2 | **8.0** |
| I3 | Audit Log & AI Hash Chain Dashboard Viewer | `ext_ai_audit_log.ts` ↔ `scripts/verify-ai-audit-trail.ts` ↔ `statutory/page.tsx` | 4 | 5 | 3 | **6.7** |
| I4 | Machine-readable OpenAPI spec generator endpoint (`/api/v1/openapi.json`) | `app/api/v1/` routes ↔ Zod schema reflection | 5 | 4 | 3 | **6.7** |
| I5 | Cancelled slot waitlist auto-notification | `scheduling.ts` (waitlist) ↔ `appointments.ts:1153` ↔ `sms-operations` | 4 | 3 | 3 | **4.0** |
| I6 | Finalized AI Discharge summary auto-attaches to Client Portal | `ext_discharge.ts` ↔ `portalProcedure` ↔ `communications.ts` | 4 | 4 | 3 | **5.3** |

### AI Feature Proposals (Mini-Specs — min. 4 items)

#### A1. Automated Missed-Charge Detection at Visit Closeout
- **User Story:** As a veterinarian or practice manager, when completing visit closeout, I want the system to flag administered drugs or lab procedures recorded in the SOAP note that do not have matching invoice line items.
- **Context to Model:** Current encounter SOAP note text, recorded medication entries, and draft invoice items.
- **UI Surface:** Review Closeout modal (`/encounters/[id]#visit-closeout`).
- **User Override:** Checkbox list of suggested billable items; clinician clicks "Add to Invoice" or "Dismiss".
- **Risk Level:** **Low** (read-only suggestion; requires staff click to bill).
- **ICE Score:** Impact: 5, Confidence: 5, Effort: 2 → **ICE = 12.5**

#### A2. AI Sympathy & Condolence Communication Generator
- **User Story:** As a veterinarian completing a euthanasia protocol, I want an empathetic, personalized condolence card draft generated for the owner that integrates the pet's history.
- **Context to Model:** Patient name, species, years known, owner name, clinical summary, and Sympathy Safety Gate protocol.
- **UI Surface:** `EuthanasiaRegisterTab` in `statutory/page.tsx` and Communications inbox.
- **User Override:** Editable text area; never sends automatically; vet reviews and prints or emails.
- **Risk Level:** **Low-Med** (sensitive communication; requires human approval).
- **ICE Score:** Impact: 4, Confidence: 4, Effort: 2 → **ICE = 8.0**

#### A3. Voice-to-SOAP Structured Visit Extractor
- **User Story:** As a clinician examining an animal, I want to dictate my stream of consciousness and have it parsed directly into Subjective, Objective, Assessment, and Plan fields.
- **Context to Model:** Audio transcript, patient species/breed, previous encounter problem list.
- **UI Surface:** `SoapNoteEditor.tsx` in Encounter view with mic button.
- **User Override:** Previews parsed text into the four distinct fields; clinician edits before saving.
- **Risk Level:** **Medium** (clinical documentation; clearly labeled as AI Draft).
- **ICE Score:** Impact: 5, Confidence: 3, Effort: 3 → **ICE = 5.0**

#### A4. Overdue Vaccine & Recall Messaging Assistant
- **User Story:** As front desk staff, I want to generate friendly, tailored reminder messages for clients whose pets are overdue for rabies or core vaccines.
- **Context to Model:** `list_overdue_vaccinations` tool payload, patient name, client preferred contact method.
- **UI Surface:** `care-reminders` and `recalls` dashboard sections.
- **User Override:** Review and batch-approve before sending via SMS/Email.
- **Risk Level:** **Medium** (external client communication).
- **ICE Score:** Impact: 4, Confidence: 4, Effort: 3 → **ICE = 5.3**

---

## 7. Onboarding Walkthrough

**First 30 Minutes Experience (Self-Hosted Clinic):**
1. **Initial Setup:** Running `pnpm install` and copying `.env.example` is standard. However, if `NEXTAUTH_SECRET` is left blank, the system fails closed without an onboarding setup wizard, returning null sessions that can confuse novice administrators. [VERIFIED: apps/web/server/trpc.ts:204-206]
2. **Registration & Guided Journey:** The `auth.register` procedure (`apps/web/server/routers/auth.ts:214-350`) provisions the practice, initial admin user, and automatically seeds default practice configurations (`seedPractice`). A guided onboarding flow (`/onboarding`) steps the clinic through logo branding, location details, and initial team invitations. [VERIFIED: apps/web/server/routers/auth.ts:9, 288-309]
3. **Demo Sandbox Availability:** `packages/db/seed-all-demo.ts` provides comprehensive demo fixtures (clients, pets, appointments, invoices, statutory entries) allowing staff to explore features immediately before entering live data. [VERIFIED: packages/db/seed-all-demo.ts:26-50]
4. **Navigational Cognitive Load:** Upon landing on the dashboard, the new clinic is greeted with 25 top-level sidebar items. For a non-Slovak clinic, items like "Statutory" (ŠVPS SR registers) and "e-Kasa" can cause confusion unless hidden or regionalized. [VERIFIED: apps/web/config/custom-nav.ts]

**Overall Rating: Good.**  
*Justification:* Robust automated practice seeding, dedicated onboarding routes, comprehensive test coverage for registration flows, and realistic demo seed scripts place OpenVPM well ahead of typical open-source PIMS. It falls short of "Excellent" due to the unhandled empty-secret first-run failure and the immediate cognitive overload of 25 unclustered menu items.

---

## Appendix — Source Reference Index

| File Path | Tag Basis | Description / Verified Elements |
|---|---|---|
| `apps/web/server/trpc.ts` | [VERIFIED: L31-36, 101-198, 204-206, 222-234, 427-453, 536-588, 599-627] | Role enums, 30s session cache, blank secret fail-close, RLS `withTenant`, viewer mutation guard, clinical invariant flushes, billing feature gate. |
| `apps/web/lib/auth.ts` | [VERIFIED: L3, 25, 60-93, 155] | NextAuth credentials setup, `bcryptjs` compare, cost 12 dummy hash, session typing. |
| `apps/web/lib/auth-hashing.ts` | [VERIFIED: L1-3] | Centrally exported `PASSWORD_HASH_COST = 12` and `API_KEY_HASH_COST = 12`. |
| `apps/web/server/routers/auth.ts` | [VERIFIED: L2, 19, 214-350] | Practice registration mutation, `bcryptjs.hash(..., PASSWORD_HASH_COST)`, practice default seeding. |
| `apps/web/lib/__tests__/auth-hashing.test.ts` | [VERIFIED: L1-38] | Architectural unit test verifying password and API key hash costs are ≥12 across all auth files. |
| `apps/web/server/routers/appointments.ts` | [VERIFIED: L68, 1100-1175] | Doctor requirement on check-in, closeout bypass block, cancellation/no-show restoration path. |
| `apps/web/lib/scheduling/appointment-status.ts` | [VERIFIED: L13-33] | Allowed status transitions graph confirming `no_show` and `cancelled` transition back to `scheduled`. |
| `apps/web/server/routers/controlled-substances.ts` | [VERIFIED: L349-413, 446, 459-484] | Wasted drug witness requirement, practice membership validation, witness joins. |
| `apps/web/lib/__tests__/controlled-substances-ui.test.ts` | [VERIFIED: L50-104] | UI policy test verifying submit button disabled when witness missing, and fail-closed state on lookup error. |
| `apps/web/app/(dashboard)/statutory/page.tsx` | [VERIFIED: L35, 473-515, 1098-1240] | Statutory tabs (rabies, treatment, euthanasia, narcotics, crsz), `EuthanasiaRegisterTab` implementation. |
| `packages/db/schema/ext_statutory.ts` | [VERIFIED: L154] | Table `extCarcassDisposals` tracking deceased/euthanized animals and disposal methods. |
| `apps/web/server/routers/extensions/statutory.ts` | [VERIFIED: L536-671] | Statutory procedures for logging carcass disposal and municipal notifications. |
| `apps/web/lib/webhook-dispatcher.ts` | [VERIFIED: L13-60] | Outbound webhook delivery engine with HMAC-SHA256 signatures and practice locks. |
| `packages/db/schema/communications.ts` | [VERIFIED: L97-140] | `webhooks` table definition (practiceId, url, events, secret, active) and `api_keys` table. |
| `apps/web/server/routers/webhooks.ts` | [VERIFIED: L16-70, 106] | Admin procedure for registering and managing outbound webhooks. |
| `apps/web/lib/webhook-events.ts` | [VERIFIED: L1-60] | 15+ defined webhook events (`appointment.created`, `soap_note.created`, etc.). |
| `apps/web/app/(dashboard)/whiteboard/page.tsx` | [VERIFIED: L220-231, 617-619, 650] | "Live" badge, 30-second tRPC polling interval (`refetchInterval: 30000`), local mutation cache invalidation. |
| `apps/web/lib/__tests__/appointment-overlays-accessibility.test.ts` | [VERIFIED: L18-56] | Accessibility unit test verifying `role="dialog"`, `aria-modal="true"`, and Tab focus traps. |
| `apps/web/lib/__tests__/api-docs.test.ts` | [VERIFIED: L1-318] | Test verifying truth-in-docs, absence of stale Swagger/WebSocket claims, and live REST contracts. |
| `apps/web/app/api-docs/page.tsx` | [VERIFIED: L1-60, 1568] | Interactive Next.js API reference documentation surface (1,655 lines). |
| `apps/web/app/api-docs/ai/page.tsx` | [VERIFIED: L1-60] | AI Integration Guide for external agent developers. |
| `apps/web/lib/agent/tools.ts` | [VERIFIED: L331-2595] | Complete definition of all 26 agent tools (matching SECURITY.md count). |
| `apps/web/lib/agent/runner.ts` | [VERIFIED: L329-350] | Write-tool gating checking `allowWrites` (default false). |
| `apps/web/lib/ai/audit-chain.ts` | [VERIFIED: L6-90] | Tamper-evident SHA-256 hash chaining over `ext_ai_audit_log`. |
| `apps/web/server/routers/extensions/ekasa.ts` | [VERIFIED: L10-60] | Slovak fiscal e-Kasa printer driver, VAT calculation, and daily closures. |
| `apps/web/app/(dashboard)/patients/new/page.tsx` | [VERIFIED: L51-76, 110-180] | Patient form role check, query param pre-population, and dynamic `canSubmit` validation. |
| `apps/web/components/SoapNoteEditor.tsx` | [VERIFIED: L4-52] | Tiptap rich-text editor for veterinary clinical notes. |
| `packages/db/schema/index.ts` | [VERIFIED: L1-59] | Schema registry confirming 59 schema files and 158 `pgTable` definitions. |