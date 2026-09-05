# Production environment template and validation

**Do not commit real values.** Copy from root `.env.example`.

## Validation strategy

| Mode | Mechanism |
| --- | --- |
| Hosted (`HOSTED_BILLING_ENABLED` truthy) | `GET /api/health` fails (503) when required env, HTTPS URLs, Stripe, storage, email, AI, ops, optional SMS rollout are incomplete. Verified by `apps/web/app/api/health/route.test.ts`. |
| Self-host | Core process can be live without hosted Stripe. Database + schema drift still affect readiness. |
| Startup | Next.js loads env from the platform. There is no separate Zod process-wide parser covering every key; health is the release gate. |
| Secrets | Generate `NEXTAUTH_SECRET` with `openssl rand -base64 32`. Never reuse demo MinIO keys. |

## Production defaults that must stay fail-closed

- `MESSAGING_PROVISIONING_ENABLED=false`
- `MESSAGING_INBOUND_ENABLED=false`
- `MESSAGING_SENDING_ENABLED=false`
- `AMBULATORY_WORKSPACE_ENABLED=false` unless piloting
- `FILE_REPLICA_ENABLED=false` until replica runbook passes
- `OPENVPM_EXPOSE_AUTH_LINKS` unset
- e-Kasa not pointed at FR SR production

## Operator validation

After deploy, capture `/api/health/ready` JSON (no secrets in body) in the release ticket. That capture is evidence of configuration, not of legal compliance.
