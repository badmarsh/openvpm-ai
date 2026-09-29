# OpenVPM AI — API Security & Authentication Inventory

This document provides a comprehensive security audit of every endpoint under `apps/web/app/api/`.

## Architectural Context
In `apps/web/middleware.ts`, `"/api"` is included in `PUBLIC_PATH_PREFIXES` to avoid session redirection loops on programmatic traffic (e.g. tRPC calls, Webhooks, CRON invocations, Capability URLs, REST API v1 keys). Consequently, **every API route handler must enforce explicit authorization and fail closed**.

---

## Complete Endpoint Audit Matrix

| Category | Endpoint Path | Auth Mechanism | Isolation & Defense |
| :--- | :--- | :--- | :--- |
| **tRPC Engine** | `/api/trpc/*` | Procedure-level (`protectedProcedure` vs `publicProcedure`) | Multi-tenant session context + PostgreSQL RLS. |
| **REST API v1** | `/api/v1/patients/*` | Bearer API Key (`patients:read`, `patients:write`) | `authenticateApiKey` + `withTenant` + RLS. |
| **REST API v1** | `/api/v1/clients/*` | Bearer API Key (`clients:read`, `clients:write`) | `authenticateApiKey` + `withTenant` + RLS. |
| **REST API v1** | `/api/v1/appointments/*` | Bearer API Key (`appointments:read`, `appointments:write`) | `authenticateApiKey` + `withTenant` + RLS. |
| **REST API v1** | `/api/v1/soap-notes/*` | Bearer API Key (`soap-notes:read`, `soap-notes:write`) | `authenticateApiKey` + `withTenant` + RLS. |
| **REST API v1** | `/api/v1/agent/*` | NextAuth Session / API Key | Tenant-scoped assistant invocation. |
| **File Storage** | `/api/upload` | NextAuth Session (`getServerSession(authOptions)`) | MIME verification, Magic bytes, SHA256 checksum, Quota, Rate limit. |
| **File Storage** | `/api/files/[...path]` | NextAuth Session / Capability Token | Path traversal protection, S3 object stream, tenant isolation. |
| **Client Portal** | `/api/portal/session` | Portal JWT Session Token | Sealed HMAC portal token. |
| **Client Portal** | `/api/portal/checkout` | Portal JWT + Stripe session | Rate-limited portal invoice checkout. |
| **Capability Tokens** | `/api/sign/[token]` | Sealed Capability Token (64 hex) | Cryptographic signature request capability. |
| **Capability Tokens** | `/api/sign/receipt` | Capability Token | Verification receipt. |
| **Capability Tokens** | `/api/capture/[token]` | Sealed Capability Token | Photo upload session token. |
| **Capability Tokens** | `/api/treatment-plan/[token]` | Sealed Capability Token | Patient treatment plan approval token. |
| **Capability Tokens** | `/api/calendar/[token]` | Calendar Feed Token | Practice calendar iCal subscription token. |
| **Cron Jobs** | `/api/cron/*` (all 18 cron endpoints) | Bearer `CRON_SECRET` | `authorizeCronRequest(req)` fails closed if secret missing or mismatched. |
| **Webhooks** | `/api/webhooks/stripe` | Stripe HMAC signature (`stripe-signature`) | Webhook signature verification. |
| **Webhooks** | `/api/webhooks/stripe-connect` | Stripe Connect HMAC signature | Connect webhook verification. |
| **Webhooks** | `/api/webhooks/stripe-subscription`| Stripe Subscription HMAC signature | Subscription webhook verification. |
| **Webhooks** | `/api/webhooks/telnyx` | Telnyx Ed25519 public key signature | Inbound SMS & delivery verification. |
| **Webhooks** | `/api/webhooks/twilio` | Twilio HMAC-SHA1 signature | Twilio auth token verification. |
| **Webhooks** | `/api/webhooks/resend` | Resend webhook secret | Resend webhook verification. |
| **Observability** | `/api/health` | Public (Safe) | Deep system health & schema drift probe (no PII leaked). |
| **Observability** | `/api/health/live` | Public (Safe) | Lightweight process liveness probe. |
| **Telemetry** | `/api/funnel-event` | Rate-limited Anonymous Telemetry | Strict Zod schema, IP rate-limit (120/5m), CORS origin check. |
| **Telemetry** | `/api/error-report` | Rate-limited Anonymous Error Tracking | Strict Zod schema, IP rate-limit (30/5m), digest sanitization. |
| **Support** | `/api/support/signaling` | WebSocket upgrade check | Returns HTTP 501 (placeholder for external WebRTC signaling). |

---

## Conclusion & Verification
All 49 API endpoints have verified fail-closed authentication or explicitly bounded, rate-limited public telemetry contracts. No unauthenticated routes expose tenant or clinical data.
