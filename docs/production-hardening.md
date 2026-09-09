# OpenVPM AI — Production Hardening & Operational Runbook

**Document version:** 1.0.0  
**Target Repository:** `badmarsh/openvpm-ai`  
**Date:** 2026-09-09  
**Status:** Operations Standard (Phase 4 Deliverable)  

---

## 1. Production Network & Infrastructure Hardening

1. **Database Connection Pooling & PgBouncer:**
   - For serverless deployments (Vercel / Supabase), configure `DATABASE_POOL_MAX` and set `prepare: false` to accommodate transaction pooling.
   - For persistent servers (Docker / Kubernetes), maintain direct connection pools with max 20 connections per pod.
2. **Strict Ingress & Reverse Proxy:**
   - Terminate TLS 1.3 at Cloudflare / Caddy / Nginx.
   - Restrict port 5434 (PostgreSQL) and port 9000 (MinIO) to internal VPC networks; never expose database or storage ports to the public internet.
3. **HTTP Security Headers:**
   - Enforce CSP: `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`.
   - HSTS enabled with two-year duration, `includeSubDomains`, and `preload`.
   - `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY`.

---

## 2. Health Monitoring & Observability

OpenVPM provides dedicated health check endpoints:
- `GET /api/health` — Comprehensive dependency health check (PostgreSQL database latency, S3 storage reachability, AI inference proxy status).
- `GET /api/health/live` — Lightweight liveness probe for load balancer health checking.

### Structured Logging & PII Redaction
- Application logs automatically strip sensitive parameters: passwords, bearer tokens, credit card details, and raw patient audio.
- Logs include `practiceId`, `requestId`, and `timestamp` for correlation across distributed requests.

---

## 3. SLA & Recovery Targets

| Metric | Target | Verification Mechanism |
|---|---|---|
| **RPO (Recovery Point Objective)** | **< 1 hour** | Hourly WAL archiving & daily full automated exports (`/api/cron/backup`). |
| **RTO (Recovery Time Objective)** | **< 30 minutes** | Containerized database restore procedure (`docs/backup-restore-runbook.md`). |
| **Uptime Availability** | **99.9%** | Redundant container instances and multi-region S3 replication. |
