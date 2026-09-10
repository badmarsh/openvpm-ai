# OpenVPM AI — Release Checklist & Deployment Runbook

**Version Target:** v0.1.0-rc.1  
**Target Repository:** `badmarsh/openvpm-ai`  
**Date:** 2026-09-09  
**Status:** Updated — v2.0.0

---

## 1. Pre-Flight Quality Gates

All gates must pass with zero errors before any production or pilot deployment.

### Typecheck
```bash
pnpm type-check
# Expected: 0 errors across @openpims/web, @openpims/db, @openpims/email
```

### Lint
```bash
pnpm lint
# Expected: 0 errors, 0 warnings (warnings treated as errors in CI)
```

### Unit Tests — Authorization (fail-closed RBAC)
```bash
pnpm --filter @openpims/web exec vitest run lib/__tests__/authorization.test.ts
# Expected: All tests passing — proves absent/unknown roles are denied
```

### Unit Tests — Audit Chain (tamper detection)
```bash
pnpm --filter @openpims/web exec vitest run lib/ai/__tests__/audit-chain.test.ts
# Expected: All tests passing — proves hash chain detects all tamper scenarios
```

### Unit Tests — Clinical AI (deterministic harness)
```bash
pnpm --filter @openpims/web exec vitest run lib/ai/__tests__/clinical-eval-harness.test.ts
# Expected: All tests passing
```

### Full Unit Test Suite
```bash
pnpm --filter @openpims/web exec vitest run
# Expected: All tests passing, no skipped tests without documented reason
```

### Audit Trail Integrity Verification
```bash
pnpm audit:verify-ai --allow-empty
# Expected: exit 0 (empty table is OK on first run)
# On a database with existing records:
pnpm audit:verify-ai
# Expected: exit 0, 0 errors
```

### i18n Symmetry
```bash
# Verify 100% key parity between sk.json and en.json
node -e "
const sk = Object.keys(require('./apps/web/messages/sk.json'));
const en = Object.keys(require('./apps/web/messages/en.json'));
const missing = en.filter(k => !sk.includes(k));
const extra = sk.filter(k => !en.includes(k));
if (missing.length || extra.length) {
  console.error('Missing in SK:', missing); console.error('Extra in SK:', extra); process.exit(1);
}
console.log('i18n symmetry OK:', en.length, 'keys');
"
```

### Upstream Migration Journal Integrity
```bash
# Confirm _journal.json is pristine (not modified by ext_ schema changes)
git diff HEAD -- packages/db/drizzle/meta/_journal.json
# Expected: no diff
```

### Production Build
```bash
pnpm build
# Expected: exit 0, no build errors
```

---

## 2. Database Migration Protocol

- [ ] Connect to staging/production PostgreSQL.
- [ ] Apply schema updates: `pnpm db:push` (adds `ext_*` chain columns without touching upstream migration journals).
- [ ] Verify chain columns added: `psql $DATABASE_URL -c "\d ext_ai_audit_log" | grep sequence_number`
- [ ] Verify RLS is enabled: `psql $DATABASE_URL -f packages/db/rls/enable-rls.sql`
- [ ] Run post-migration audit verification: `pnpm audit:verify-ai --allow-empty`

### Post-Migration Verification
```bash
# Verify table structure
psql $DATABASE_URL -c "\d ext_ai_audit_log"

# Count existing records and check for chain columns
psql $DATABASE_URL -c "SELECT COUNT(*), COUNT(sequence_number), COUNT(event_hash) FROM ext_ai_audit_log;"

# Run chain verifier
pnpm audit:verify-ai --allow-empty
```

---

## 3. Environment & Secrets Verification

- [ ] `DATABASE_URL`: PostgreSQL 16 connection string with SSL in production.
- [ ] `NEXTAUTH_SECRET`: Minimum 64-char cryptographically random secret.
- [ ] `NEXTAUTH_URL`: Canonical practice URL (e.g. `https://app.vetsykora.sk`).
- [ ] `AI_MODEL`: Supported model ID (default `gemini-2.5-flash`).
- [ ] `GOOGLE_VERTEX_PROJECT` / `ANTHROPIC_API_KEY`: Active inference provider credentials.
- [ ] `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`: Private storage — bucket must NOT be publicly accessible.
- [ ] `CRON_SECRET`: Cryptographically random bearer token for cron routes.

---

## 4. Security Verification

- [ ] Run authorization tests: `pnpm --filter @openpims/web exec vitest run lib/__tests__/authorization.test.ts`
- [ ] Run audit chain tests: `pnpm --filter @openpims/web exec vitest run lib/ai/__tests__/audit-chain.test.ts`
- [ ] Verify S3 bucket is not publicly accessible (attempt anonymous GET on a known key — must return 403).
- [ ] Verify RLS: `psql $DATABASE_URL -f packages/db/rls/enable-rls.sql`
- [ ] Review `docs/authorization-enforcement-audit.md` for any residual gaps.

---

## 5. Pilot Clinic Verification (Pre-Go-Live)

- [ ] Supervising veterinarian has reviewed drug dose reference ranges in `lib/dosing.ts`.
- [ ] Supervising veterinarian has reviewed VHS reference ranges in `lib/imaging/vhs-calculator.ts`.
- [ ] Slovak veterinary terminology in system prompts reviewed by a Slovak veterinarian.
- [ ] OPL (controlled substances) electronic logging workflow validated by supervising vet before replacing paper registers.
- [ ] Informed consent templates reviewed by veterinary legal advisor.
- [ ] e-Kasa integration tested on-site with the clinic's certified fiscal printer.
- [ ] CRSZ microchip verification tested with the clinic's CRSZ credentials.

---

## 6. Command Reference Summary

| Purpose | Command |
|---|---|
| Typecheck | `pnpm type-check` |
| Lint | `pnpm lint` |
| Unit tests (all) | `pnpm --filter @openpims/web exec vitest run` |
| Authorization tests | `pnpm --filter @openpims/web exec vitest run lib/__tests__/authorization.test.ts` |
| Audit chain tests | `pnpm --filter @openpims/web exec vitest run lib/ai/__tests__/audit-chain.test.ts` |
| Audit ledger tests | `pnpm --filter @openpims/web exec vitest run lib/ai/__tests__/audit-ledger.test.ts` |
| Confirmation envelope tests | `pnpm --filter @openpims/web exec vitest run lib/ai/__tests__/clinician-confirmation.test.ts` |
| AI finalization integration | `pnpm --filter @openpims/web exec vitest run server/__tests__/extensions-ai-finalization.integration.test.ts` |
| Pilot E2E operational flow | `pnpm --filter @openpims/web exec vitest run server/__tests__/pilot-e2e-flow.integration.test.ts` |
| Clinical AI eval | `pnpm --filter @openpims/web exec vitest run lib/ai/__tests__/clinical-eval-harness.test.ts` |
| Audit chain verify | `pnpm audit:verify-ai` |
| Audit chain verify (dev) | `pnpm audit:verify-ai --allow-empty` |
| Audit chain verify (CI) | `pnpm audit:verify-ai --json` |
| Production build | `pnpm build` |
| Schema push | `pnpm db:push` |
