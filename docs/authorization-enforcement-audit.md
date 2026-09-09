# Authorization Enforcement Audit

**Version:** 2.0.0  
**Date:** 2026-09-09  
**Status:** Post-Fix Implementation Record — `security/authz-fail-closed`  
**Repository:** `badmarsh/openvpm-ai`

---

## 1. Executive Summary

This document records the authorization enforcement audit for OpenVPM AI and the security fixes applied in the `security/authz-fail-closed` work.

### Critical Finding — Fixed

**Fail-open authorization in agent tool role checks.**

Two agent tool role checks in [`apps/web/lib/agent/tools.ts`](../apps/web/lib/agent/tools.ts) used this pattern:

```typescript
// VULNERABLE — fail-open pattern
if (ctx.userRole && !allowedRoles.includes(ctx.userRole)) {
  throw new Error("Access denied");
}
```

When `userRole` is `undefined` (which is structurally possible because `AgentToolContext.userRole` is typed as `string | undefined`), the condition evaluates to `false` and the entire authorization check is **silently bypassed**. Any agent invocation without a role could create prescriptions or read the controlled substances ledger.

**Affected tools:**
- `create_prescription` — allowed anyone without a role to create active prescriptions
- `get_controlled_substances_log` — allowed anyone without a role to read the OPL ledger

**Fix applied:** Replaced with `assertAgentRole()` from [`apps/web/lib/authorization.ts`](../apps/web/lib/authorization.ts), which **defaults to DENY** for absent, null, empty, unknown, and disallowed roles.

---

## 2. Authorization Architecture

### 2.1 tRPC Staff Session Layer

| Mechanism | File | Behavior |
|---|---|---|
| `protectedProcedure` | `apps/web/server/trpc.ts` | Requires valid NextAuth session; throws `UNAUTHORIZED` if absent |
| `requireRole(...roles)` | `apps/web/server/trpc.ts:669` | Checks `!roles.includes(session.user.role)`; throws `FORBIDDEN` for any unmatched role including absent |
| Session source | NextAuth server session only | `practiceId` and `role` never trusted from request body, URL, or model output |

**Assessment:** The tRPC `requireRole` is fail-closed. An absent session throws `UNAUTHORIZED`. An unknown/absent role throws `FORBIDDEN` because it cannot match any allowed role in the typed union.

### 2.2 Agent Tool Layer

| Mechanism | File | Status |
|---|---|---|
| `assertAgentRole()` | `apps/web/lib/authorization.ts` | ✅ **IMPLEMENTED** — central fail-closed boundary |
| `create_prescription` check | `apps/web/lib/agent/tools.ts` | ✅ **FIXED** — uses `assertAgentRole(ctx, ["veterinarian","admin"])` |
| `get_controlled_substances_log` check | `apps/web/lib/agent/tools.ts` | ✅ **FIXED** — uses `assertAgentRole(ctx, ["veterinarian","admin"])` |

### 2.3 Portal Layer

| Mechanism | File | Behavior |
|---|---|---|
| `portalProcedure` | `apps/web/server/trpc.ts` | Uses `portalSessionToken` cookie resolved server-side |
| Client scope | Portal session resolves `clientId` from DB | Never trusted from request body |
| Patient access | Filtered by `clientId` FK + RLS | Cross-tenant isolation enforced |

---

## 3. Domain-by-Domain Enforcement Matrix

### Prescriptions

| Operation | Enforcement Point | Allowed Roles | Test |
|---|---|---|---|
| Create prescription (tRPC) | `requireRole("veterinarian","admin")` on records router | veterinarian, admin | tRPC middleware |
| Create prescription (agent) | `assertAgentRole(ctx, ["veterinarian","admin"])` | veterinarian, admin | `authorization.test.ts` |

### Controlled Substances (OPL — Zákon č. 362/2011 Z. z.)

| Operation | Enforcement Point | Allowed Roles | Test |
|---|---|---|---|
| List CS log (tRPC) | `requireRole("admin","veterinarian")` | veterinarian, admin | tRPC middleware |
| Add CS log entry (tRPC) | `requireRole("admin","veterinarian")` | veterinarian, admin | tRPC middleware |
| Read CS log (agent) | `assertAgentRole(ctx, ["veterinarian","admin"])` | veterinarian, admin | `authorization.test.ts` |

### Clinical Records (SOAP, Discharge, Imaging)

| Operation | Enforcement Point | Allowed Roles |
|---|---|---|
| Finalize voice SOAP note | `requireRole("admin","veterinarian")` via `voiceProcedure` | veterinarian, admin |
| Confirm imaging analysis | `requireRole("admin","veterinarian")` via `imagingProcedure` | veterinarian, admin |
| Finalize discharge report | `requireRole("admin","veterinarian")` via `dischargeProcedure` | veterinarian, admin |

### Billing

| Operation | Enforcement Point | Allowed Roles |
|---|---|---|
| Create/edit invoices | `requireRole("admin","front_desk")` | admin, front_desk |
| e-Kasa fiscal operations | `requireRole("admin")` | admin only |
| Financial reports | `requireRole("admin")` | admin only |

### Portal (Client Access)

| Capability | Enforcement | Notes |
|---|---|---|
| View own patient records | `portalProcedure` + `clientId` FK | Cannot traverse to other clients |
| Book appointment | `portalProcedure` + rate limit | No access to staff operations |
| View invoices | `portalProcedure` + `clientId` FK | Cannot access other clients' invoices |
| Raw SOAP / clinical notes | Not exposed | Portal shows only client-safe summaries |

### Cron / Webhook Routes

| Route | Authentication | Notes |
|---|---|---|
| `/api/cron/*` | Bearer `CRON_SECRET` | No user identity; cannot impersonate staff |
| `/api/webhooks/*` | HMAC signature verification | Payload never trusted for authorization decisions |

---

## 4. Negative Test Matrix (Proven by Tests)

| Role | Prescription Create | CS Log Read |
|---|---|---|
| `undefined` | **DENY** ✅ | **DENY** ✅ |
| `null` | **DENY** ✅ | **DENY** ✅ |
| `""` (empty) | **DENY** ✅ | **DENY** ✅ |
| `"   "` (whitespace) | **DENY** ✅ | **DENY** ✅ |
| `"portal_user"` (unknown) | **DENY** ✅ | **DENY** ✅ |
| `"service_cron"` (unknown) | **DENY** ✅ | **DENY** ✅ |
| `"front_desk"` | **DENY** ✅ | **DENY** ✅ |
| `"technician"` | **DENY** ✅ | **DENY** ✅ |
| `"viewer"` | **DENY** ✅ | **DENY** ✅ |
| `"veterinarian"` | **ALLOW** ✅ | **ALLOW** ✅ |
| `"admin"` | **ALLOW** ✅ | **ALLOW** ✅ |

---

## 5. Residual Gaps

| Gap | Severity | Status |
|---|---|---|
| `AgentToolContext.userRole` is typed `string \| undefined` | Low | `assertAgentRole` handles undefined correctly; full type narrowing requires larger refactor |
| Cron routes use `CRON_SECRET` not `requireRole` | Medium | DEPLOYMENT_REQUIREMENT: `CRON_SECRET` must be cryptographically random; cron routes cannot impersonate users |
| File download presigned URL authorization | Medium | IMPLEMENTED — keys are tenant-scoped; requires private bucket deployment |
| Agent tool `allowWrites` gate | Low | Runner checks `readOnly` flag; server-side RBAC is the authoritative control |

---

## 6. Test Commands

```bash
# Authorization unit tests (fail-closed RBAC)
pnpm --filter @openpims/web exec vitest run lib/__tests__/authorization.test.ts

# All agent tool tests
pnpm --filter @openpims/web exec vitest run lib/agent/__tests__/

# Full typecheck
pnpm type-check
```
