# Compliance evidence matrix

**Not a legal opinion.** Status values: implemented / partial / unverified / out of scope.

| Requirement / expectation | Module | Technical control | Evidence | Automated test | Human review | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Access control | tRPC / REST | Session + RBAC + tenant GUC | `server/trpc.ts` | CI RLS job, router tests | Operator: `openpims_app` in prod | implemented (app); unverified in this sandbox |
| Tenant isolation | Postgres RLS | `packages/db` RLS SQL | `docs/security/row-level-security.md` | `db:rls:test` | Ops | implemented in CI definition |
| Auditability | Mutations | `recordAuditLog` | `lib/audit.ts` | Partial | DPO: retention | partial |
| Minimization | APIs | Zod inputs; health omits secret names | health tests | `route.test.ts` | DPO | partial |
| Retention / deletion | Account closure | Backup runbook 60-day window | runbook | Owner purge procedure | **Legal/DPO** | partial / requires legal review |
| Processors (Stripe, Resend, Telnyx, GCP, Anthropic) | Integrations | Env kill switches | `.env.example` | Health hosted checks | **DPA confirmation** | unverified contracts |
| Breach response | Ops | SECURITY.md 48h ack | `SECURITY.md` | n/a | Legal | process documented |
| Clinical record governance | SOAP/labs | Immutable notes, lab safety doc | `docs/lab-result-safety.md` | treatment-plan/consent DB tests | Veterinary domain | partial |
| Slovak statutory books / CRŠZ | `ext_crsz.ts` | Extension schema + router | code | tests if present under extensions | Veterinary/regulatory | unverified legally |
| Consent / marketing | SMS/email | Default-off SMS; consent events | messaging flags | reminder eligibility integration tests | DPO | partial |
| e-Kasa / fiscal | `lib/ekasa` | Prototype HMAC PKP | this matrix / RISK R-P0-001 | VAT unit tests only | **Accounting + FR SR** | **not legally validated** |
| AI transparency | Agent/SOAP/voice | Draft + allowWrites | AI_SAFETY doc | agent error mapping | Legal + clinicians | partial |
| Accessibility | UI | Radix components | n/a | no a11y CI | Design | unverified |
| Localization SK/EN | `messages/` | Dictionaries | `docs/I18N.md` | not CI | Linguist | partial |
| Security headers | middleware | CSP/HSTS helpers | `lib/security-headers.js` | middleware tests | Security | implemented (config) |
| Backup | cron JSON | export + drill | backup runbook | restore-drill opt-in | Ops | partial |

Never describe the product as “GDPR compliant” or “e-Kasa certified” based on this matrix.
