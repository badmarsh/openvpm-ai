# Threat model

Scope: OpenVPM web app, PostgreSQL, object storage, cron, webhooks, AI providers, public tokens.  
Actors: clinic staff, pet-owner portal users, platform operators, integrators with API keys, anonymous internet, compromised staff, malicious tenant.

Abuse cases are tied to **implemented** or **missing** controls in this repository. Residual items require owner action.

| ID | Abuse case | Impact | Implemented technical control | Gap |
| --- | --- | --- | --- | --- |
| T01 | Unauthenticated dashboard access | PHI/clinical data | Middleware JWT; `protectedProcedure` | `/api` is public at middleware; handlers must enforce auth |
| T02 | Cross-tenant IDOR | Other clinic’s records | `withTenant` GUC + RLS + `practiceId` from session | Owner-role self-host bypasses RLS; production must use `openpims_app` |
| T03 | Vertical privilege (viewer mutates) | Record integrity | Viewer mutations forbidden in tRPC | UI hiding is not auth |
| T04 | Session reuse after deactivation | Unauthorized access | `activeSessionOrNull` re-checks user/practice | 30s cache TTL |
| T05 | Portal token theft | Client PHI | Opaque portal cookie; origin check on portal mutations | Token entropy/expiry must be verified per issuance path |
| T06 | Webhook spoof | Fake payments/SMS | Provider signature secrets in env; hosted health requires secrets | Replay window depends on each handler |
| T07 | Cron without secret | Background job abuse | `CRON_SECRET` | Weak secret is operator failure |
| T08 | File IDOR | Medical images/audio | Upload policy + tenant-scoped storage keys (inspect `lib/upload-policy.ts`) | Must keep private buckets; never public ACL |
| T09 | AI prompt injection | Wrong chart / leaked tools | Agent tools scoped to `practiceId`; writes need `allowWrites` | External retrieved content still model-influenced; human review required |
| T10 | AI as diagnosis | Clinical harm | Product policy: draft/assistive | UX must not present as diagnosis; legal review |
| T11 | Marketing SMS to deceased | Harm / complaint | CLAUDE.md sympathy gate; SMS consent events | Must remain fail-closed in dispatch code |
| T12 | Secret in git | Credential leak | `verify:oss-release` private-key + vercel token | Narrow patterns; no gitleaks in CI |
| T13 | e-Kasa forgery | Fiscal fraud / clinic liability | Receipt numbers + advisory lock | **HMAC placeholder PKP is not a fiscal signature** |
| T14 | SSRF via e-Kasa API URL | Internal network | Timeout 8s | Operator-controlled `ekasaApiUrl` must be allowlisted in production |
| T15 | Platform admin takeover | Cross-tenant | `PLATFORM_ADMIN_EMAILS` allowlist | Compromised mailbox is P0 incident |
| T16 | Recovery-hold bypass | Corrupt restored clinic | Hold blocks mutations and provider sends | Owner release procedure is human |
| T17 | Demo password in README | Trivial access to demo | Synthetic seed only | Never use seed passwords in production |

## Trust boundaries

1. Browser ↔ Next.js (session cookie / portal cookie)
2. App ↔ PostgreSQL (`openpims_app` vs owner)
3. App ↔ S3/MinIO
4. App ↔ Stripe / Resend / Telnyx / Vertex / Anthropic
5. App ↔ FR SR e-Kasa (not production-ready)

## Residual risk statement

Tenant isolation is **designed** with RLS + tests in CI, but **not re-executed** in this sandbox. e-Kasa must be treated as a **non-certified prototype**.
