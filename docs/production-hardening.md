# OpenVPM AI — Production Hardening & Operational Runbook

**Document version:** 2.0.0  
**Target Repository:** `badmarsh/openvpm-ai`  
**Date:** 2026-09-09  
**Status:** Evidence-Based Operations Reference

> [!WARNING]
> Claims in this document are labeled with their implementation status. Do not treat DEPLOYMENT_REQUIREMENT items as already implemented — they require explicit deployer action and verification.

---

## 1. Production Network & Infrastructure Hardening

The following are **DEPLOYMENT_REQUIREMENTs** — they must be configured by the operator:

1. **Database Connection Pooling:**
   - DEPLOYMENT_REQUIREMENT: For serverless deployments (Vercel/Supabase), set `DATABASE_POOL_MAX` and `prepare: false` for transaction pooling.
   - DEPLOYMENT_REQUIREMENT: For persistent servers, configure direct connection pools (recommended max 20 connections per pod).

2. **Strict Ingress & Reverse Proxy:**
   - DEPLOYMENT_REQUIREMENT: Terminate TLS 1.3 at Cloudflare / Caddy / Nginx.
   - DEPLOYMENT_REQUIREMENT: Restrict port 5432/5434 (PostgreSQL) and port 9000 (MinIO/S3) to internal networks; never expose to the public internet.

3. **HTTP Security Headers:**
   - IMPLEMENTED_AND_TESTED: CSP, HSTS, X-Content-Type-Options, X-Frame-Options headers are configured in `apps/web/next.config.js`.
   - DEPLOYMENT_REQUIREMENT: Verify headers are applied at the reverse proxy layer for non-Next.js static assets.

---

## 2. Health Monitoring & Observability

> [!NOTE]
> The following health endpoints are documented as design targets. Verify their actual implementation before relying on them in production monitoring.

- `GET /api/health` — DEPLOYMENT_REQUIREMENT: Implement comprehensive health check (PostgreSQL latency, S3 reachability, AI inference status). Must not expose sensitive configuration details.
- `GET /api/health/live` — DEPLOYMENT_REQUIREMENT: Implement lightweight liveness probe (returns 200 if process is running).

### Structured Logging & PII Redaction

- DEPLOYMENT_REQUIREMENT: Configure structured logging with `practiceId`, `requestId`, and `timestamp` correlation fields.
- DEPLOYMENT_REQUIREMENT: Verify that application logs do not contain raw patient audio, bearer tokens, passwords, or unredacted clinical text before enabling log forwarding.
- NOT_IMPLEMENTED: Automated PII redaction rules with test coverage. This requires explicit implementation and verification.

---

## 3. Recovery Targets

> [!CAUTION]
> The following RPO/RTO/uptime targets are **DEPLOYMENT_REQUIREMENTs**, not implemented guarantees. They depend on operator-configured infrastructure that is outside the application codebase.

| Metric | Target | Status | Verification |
|---|---|---|---|
| **RPO (Recovery Point Objective)** | < 1 hour | DEPLOYMENT_REQUIREMENT | Requires WAL archiving + automated backups configured by operator |
| **RTO (Recovery Time Objective)** | < 30 minutes | DEPLOYMENT_REQUIREMENT | Requires tested restore procedure; see `docs/backup-restore-runbook.md` |
| **Uptime Availability** | 99.9% | DEPLOYMENT_REQUIREMENT | Requires redundant infrastructure configured by operator |

**Verification command (DEPLOYMENT_REQUIREMENT):**
```bash
# After restoring a backup, verify database integrity
pnpm audit:verify-ai
pnpm type-check
# Confirm row counts and key table existence
psql $DATABASE_URL -c "\dt ext_ai_audit_log"
```

The backup and restore procedure is documented in `docs/backup-restore-runbook.md`. That document must be reviewed and tested by the operator before going live.

---

## 4. Audit Trail Verification

IMPLEMENTED_AND_TESTED: The audit chain verifier detects hash tampering, sequence gaps, predecessor linkage breaks, and future timestamps.

```bash
# Run before and after any database maintenance
pnpm audit:verify-ai

# Allow empty table in fresh deployments
pnpm audit:verify-ai --allow-empty

# Machine-readable output for monitoring integration
pnpm audit:verify-ai --json
```

---

## 5. Authorization Controls

IMPLEMENTED_AND_TESTED: All tRPC procedures use `requireRole()` with fail-closed behavior. Agent tools use `assertAgentRole()` from `apps/web/lib/authorization.ts`.

```bash
# Verify authorization controls
pnpm --filter @openpims/web exec vitest run lib/__tests__/authorization.test.ts
```

---

## 6. Secret Management

DEPLOYMENT_REQUIREMENT: All secrets must be supplied via environment variables. No secrets should appear in source code, logs, or documentation.

Required secrets — verify all are set before deployment:
```bash
# Verify critical environment variables are set (non-empty)
node -e "
const required = [
  'DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL',
  'S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY',
  'CRON_SECRET'
];
const missing = required.filter(k => !process.env[k]);
if (missing.length) { console.error('Missing:', missing.join(', ')); process.exit(1); }
console.log('All required secrets present.');
"
```

`NEXTAUTH_SECRET` must be a minimum 64-character cryptographically random value:
```bash
# Generate a suitable secret
openssl rand -base64 48
```
