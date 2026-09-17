# OpenVPM AI — Agent Rules

These rules are automatically loaded for every agent interaction in this workspace.
For full architectural context, examples, and Slovak legislation references, read the
[openvpm-ai skill](file:///c:/Users/marek/Documents/Vet/openvpm-ai/.agents/skills/openvpm-ai/SKILL.md).

---

## 1. Secrets & Credentials Safety

- **NEVER** commit, copy, log, or hardcode any secret: API keys, tokens, passwords,
  private keys, connection strings with credentials, or encryption keys.
- All secrets belong **exclusively** in `.env` (gitignored) or environment variables.
- Code that needs a secret MUST use `process.env.VARIABLE_NAME` — never a literal value.
- Before `git add` / `git commit`, verify staged files do NOT contain patterns:
  `sk_`, `pk_`, `key-`, `-----BEGIN`, `Bearer ey`, `token=`, `password=`, `secret=`,
  `ANTHROPIC_API_KEY=sk-`, `TELNYX_API_KEY=KEY`, `STRIPE_SECRET_KEY=sk_`,
  `IDEXX_API_KEY=`, `ANTECH_API_KEY=`, `ZOETIS_API_KEY=`.
- `.env`, `.env.local`, `.env.*.local` are in `.gitignore` — **never** remove them.
- When introducing a new environment variable, add a **placeholder** (empty value) to
  `.env.example` with a descriptive comment. Never put real values into `.env.example`.
- OAuth tokens (Google Business Profile, Facebook, Instagram, YouTube) stored in
  `ext_channel_accounts` MUST be encrypted at rest and NEVER exposed over tRPC APIs.

---

## 2. Git Commit Hygiene

- Before every commit, run `git diff --staged` and review the output.
- **Never commit:**
  - Files containing PII (client names, patient UUIDs, phone numbers, real email addresses)
  - Debug `console.log` / `console.error` statements that print sensitive data
  - `node_modules/`, `.next/`, `.env`, `.mcp.json`, or any file listed in `.gitignore`
  - One-off migration scripts from `apps/web/scripts/` (gitignored for GDPR reasons)
  - Production database dumps, JSON exports with real data, or screenshot artifacts
- Commit messages should be descriptive and in English.

---

## 3. Architectural Guardrails (Zero-Conflict Upstream Sync)

- **Do NOT modify** vanilla upstream table definitions in `packages/db/schema/*.ts`.
- All new tables/enums go into `packages/db/schema/ext_{name}.ts` files only.
- Schema changes via `pnpm db:push` — never modify `_journal.json`.
- Custom tRPC routers go under `apps/web/server/routers/extensions/` and mount
  via `extensions: extensionsRouter` in `_app.ts`.
- Navigation items go into `apps/web/config/custom-nav.ts` — do NOT edit `sidebar.tsx` directly.
- When merging from upstream (`https://github.com/evangauer/openvpm.git`):
  1. Verify vanilla schemas remain untouched.
  2. Re-verify 100% i18n dictionary symmetry.
  3. Run: `pnpm --filter @openpims/web type-check`
- **Upstream-Backport-Aware Coding:** We actively contribute improvements back to
  the upstream OpenVPM project. Write code with this in mind:
  - Features touching **vanilla files** (components, hooks, routers outside `extensions/`)
    must be written generically — no Slovak-specific, clinic-specific, or AI-specific
    logic hardcoded into upstream-shared code paths.
  - When a feature benefits both OpenVPM AI and vanilla OpenVPM, implement the generic
    part in vanilla files and the SK/AI-specific part in `ext_*` schemas or `extensions/`
    routers, so the generic part can be cleanly cherry-picked upstream.
  - Bug fixes and improvements to vanilla upstream code should be self-contained,
    well-tested commits that can be submitted as PRs to the upstream repo without
    carrying OpenVPM AI dependencies.

---

## 4. Strict i18n (Multilingual Compatibility)

- Maintain **100% key symmetry** between `apps/web/messages/en.json` and `apps/web/messages/sk.json`.
- **Zero hardcoded text in JSX/TSX** — all user-facing strings via `useI18n()`:
  ```ts
  const { t } = useI18n();
  t("section.key", "Fallback text", { param })
  ```
- Use nested JSON objects for keys (`nav: { item: "..." }`), never dotted root-level
  strings (`"nav.item": "..."`).
- tRPC server routers throw **English** error messages; localization happens on the client only.
- No `app/[locale]/...` URL path prefixes — URLs remain clean and canonical.
- **Conscientious, Independent Translation Quality:**
  - EN and SK translations must each be **authored independently as native-quality text**.
    SK is NOT a mechanical translation of EN — it must read naturally to a Slovak
    veterinarian (correct declension, professional terminology, natural word order).
  - EN must read naturally to an English-speaking vet — not as a back-translation from SK.
  - When adding or updating i18n keys, write **both** translations thoughtfully in the
    same commit. Never leave one language as a placeholder or copy of the other.
  - Use correct Slovak veterinary terminology: "Kniha ošetrení" (not "Treatment Book"),
    "ochranná lehota" (not "withdrawal period" translated literally), "očkovací preukaz"
    (not "vaccination card").
  - Avoid machine-translation artifacts: unnatural word order, missing diacritics,
    incorrect grammatical gender, or literal calques from English.

---

## 5. Clinical & Safety Gates (Slovak Veterinary Law)

- **Human-in-the-loop (Zákon 39/2007 Z. z. §3):** AI is strictly an assistant. AI drafts
  MUST remain in `draft` status until reviewed and signed by a licensed KVL veterinarian
  via `ClinicalDiffConfirmModal`.
- **Zero AI prefill for controlled substances (Zákon 139/1998 Z. z.):** Opiates, ketamine,
  propofol, butorphanol, fentanyl — the system must blank out AI proposals and require
  manual, authenticated entry.
- **Sympathy Gate:** When a patient is `deceased`, immediately suppress all automated
  outreach (reminders, review asks, promotions). Log to `ext_automation_suppression_log`.
- **Clinical claims in marketing** require `clinicalApprovalCheck` + approving vet UUID.
- **Medical imaging** uses category `"imaging"` — never overwrite `patient.photoUrl`.

---

## 6. Next.js 15 & React 19 Runtime

- `optimizePackageImports` in `next.config.js` — **production only** (causes HMR crashes in dev).
- Service Workers **never** register on `localhost`. Gate with production + hostname check.
- Theme-dependent rendering must use a `mounted` state guard to prevent hydration mismatch.
- All `<table>` elements in dashboard/portal must be wrapped in `overflow-x-auto` or `<TableScroll>`.

---

## 7. GDPR & Data Protection

- **Voice audio retention:** Raw audio for voice transcription must be deleted within 24 hours.
- **Suppression logging:** All suppressed messages logged to `ext_automation_suppression_log`
  with reason codes (`sympathy_gate`, `quiet_hours`, `sms_rate_limit`, `opt_out`, `frequency_cap`).
- Legal basis: `contract` for transactional reminders; `consent` / `legitimate_interest` for campaigns.
- One-off ops scripts (`apps/web/scripts/`) contain production UUIDs and PII — they are
  gitignored and must never be committed.

---

## 8. Dokploy Deployment & Remote Server Environment (`dev.significa.sk`)

When the user pastes container logs, mentions `compose-parse-online-port-wdunfq-*`, or reports errors on `vet.dev.significa.sk`, **this refers to the remote Dokploy server, NOT local dev**:

- **Server & SSH:** `root@dev.significa.sk`
- **Public Domain:** `https://vet.dev.significa.sk` (routed via Traefik on external network `dokploy-network` with automatic Let's Encrypt TLS).
- **Dokploy Project:** `DcWUBuOSe4H0UfF-OpLPb` (*OpenVPM AI*), Environment `dgpMIXk6UxZf_nS2fH3xU` (*production*).
- **Compose App:** `openvpm-ai` (ID: `pvdhIxlCIhYTKvnmrZ8Mk`, internal disk name: `compose-parse-online-port-wdunfq`).
- **Server Code Path:** `/etc/dokploy/compose/compose-parse-online-port-wdunfq/code/`
- **Server Deployment Logs:** `/etc/dokploy/logs/compose-parse-online-port-wdunfq/`
- **Server Multi-Container Stack:**
  - `compose-parse-online-port-wdunfq-web-1`: Production Next.js 15 standalone server (port 3000).
  - `compose-parse-online-port-wdunfq-minio-1`: MinIO S3 object storage for patient photos/imaging (`minio:9000`, volume `minio_data`).
  - `compose-parse-online-port-wdunfq-minio-bootstrap-1`: Bucket creation job (`mc`).
  - `compose-parse-online-port-wdunfq-db-init-1`: Initializer running `pnpm db:bootstrap`, `pnpm db:rls` and `pnpm db:seed:sk`.
- **Dokploy Standalone Database Services (Docker Swarm on `dokploy-network`):**
  - **Production DB (`openvpm-postgres-cfoqxx`):** ID `blxZb8obBRSF0J42JjPlL`, PostgreSQL 16 Alpine, volume `openvpm-postgres-cfoqxx-data`. Zero internet exposure, accessible strictly within `dokploy-network` at `openvpm-postgres-cfoqxx:5432`.
  - **Arena Test Clone DB (`openvpm-arena-postgres-ygh6nf`):** ID `XhgvbElGuBewwa6a3xjpy`, PostgreSQL 16 Alpine, external port `5434` mapped to host (`dev.significa.sk:5434`). Dedicated sandbox clone for external Arena AI agents, populated with Slovak clinic demo data. Connection string: `postgresql://openpims:<PASSWORD>@dev.significa.sk:5434/openpims`.

### Deployment Mechanism (Git Remote `main` -> Dokploy Webhook)
- Dokploy builds containers directly from GitHub: `context: https://github.com/badmarsh/openvpm-ai.git#main`.
- Therefore, **any fix for the server must be committed and pushed to `origin/main`** before deployment.
- Trigger deployment via official Dokploy Webhook:
  ```bash
  # Webhook URL is configured in .env as DOKPLOY_DEPLOY_WEBHOOK_URL
  curl -X POST "${DOKPLOY_DEPLOY_WEBHOOK_URL}"
  ```
  Or trigger the `deploy` skill: `powershell -File .agents/skills/deploy/scripts/deploy.ps1`.

### Dokploy Compose Architecture (`sourceType: raw`)
- Dokploy manages the `openvpm-ai` stack as `sourceType: raw`. The compose definition is stored in Dokploy's internal database (`compose.composeFile`).
- On redeploy, Dokploy overwrites `/etc/dokploy/compose/compose-parse-online-port-wdunfq/code/docker-compose.yml` with its stored database definition.
- **Never rely solely on editing `docker-compose.dokploy.yml` in git** for server-side compose changes. Any structural compose change (e.g., environment variables, `db-init` commands) must also be updated in Dokploy UI or synced into Dokploy Postgres (`compose` table).

### Dokploy Deployment Troubleshooting & Common Failures

#### 1. Schema Drift / Missing RLS Policies (`/api/health` HTTP 503 — "29 critical controls missing")
- **Cause:** The `db-init` container ran `db:bootstrap` and `db:seed:sk` but missed `pnpm db:rls`, or `OPENPIMS_APP_DB_PASSWORD` was absent, leaving PostgreSQL RLS policies disabled (`relrowsecurity = false`).
- **Immediate Fix:** Pipe `packages/db/rls/enable-rls.sql` into the remote Postgres container:
  ```powershell
  Get-Content packages/db/rls/enable-rls.sql -Raw | ssh root@dev.significa.sk "docker exec -i \$(docker ps -q -f name=openvpm-postgres-cfoqxx) psql -U openpims -d openpims"
  ```
- **Permanent Fix:** Ensure `db-init` in Dokploy compose definition executes `pnpm db:setup` (or `db:bootstrap && pnpm db:rls && pnpm db:seed:sk`) and defines `OPENPIMS_APP_DB_PASSWORD: ${POSTGRES_PASSWORD}`.

#### 2. Secret Decryption Failures (`Failed to decrypt AI API key`)
- **Cause:** When restoring database dumps from local dev or another environment, encrypted fields in `ext_ai_settings` (`gemini_api_key_encrypted`, `alibaba_api_key_encrypted`) were encrypted with the local `NEXTAUTH_SECRET`, whereas the server uses a different production `NEXTAUTH_SECRET`.
- **Fix:** Re-encrypt the values using the server's `NEXTAUTH_SECRET` inside the container, or clear the corrupted fields so the user can re-enter them in the UI. Application code in `ai-settings.ts` and `ai-config-resolver.ts` handles decryption errors gracefully without fatal crashes.

#### 3. Build Stuck or Failing in Dokploy UI
- **Log Inspection:** Check the latest deployment log on the server:
  ```bash
  ssh root@dev.significa.sk "ls -lt /etc/dokploy/logs/compose-parse-online-port-wdunfq/ | head -n 3"
  ssh root@dev.significa.sk "tail -n 50 /etc/dokploy/logs/compose-parse-online-port-wdunfq/<latest-log>"
  ```
- **Emergency Manual Build via SSH (Bypasses Dokploy Webhook):**
  ```bash
  ssh root@dev.significa.sk "cd /etc/dokploy/compose/compose-parse-online-port-wdunfq/code/ && docker compose build --no-cache web && docker compose up -d --remove-orphans web"
  ```

#### 4. Post-Deploy Smoke Verification
Always verify health and status after deployment:
```bash
curl -s https://vet.dev.significa.sk/api/health
# Expected: {"ok":true,"checks":{"database":{"ok":true},"schema":{"ok":true}}}
curl -s -o /dev/null -w "%{http_code}" https://vet.dev.significa.sk/login
# Expected: 200 (or 307 redirect)
```


---

## Development & Server Environments Quick Reference

| | Primary (Active Local Dev) | Reference (Upstream Vanilla) | Remote Server / Staging (Dokploy) |
|---|---|---|---|
| Host / Access | Local Windows | Local Windows | `dev.significa.sk` (`root@dev.significa.sk`) |
| Path | `C:\Users\marek\Documents\Vet\openvpm-ai` | `C:\Users\marek\Documents\Vet\OpenVPM` | `/etc/dokploy/compose/compose-parse-online-port-wdunfq/code/` |
| URL / Port | `http://localhost:3001` | `http://localhost:3005` | `https://vet.dev.significa.sk` (port 3000 behind Traefik) |
| Database | Docker `openvpm-postgres-1`, port 5434, DB `openvpm_ai` | — | Dokploy Database Service `openvpm-postgres-cfoqxx:5432`, DB `openpims` (Arena Clone: port 5434) |
| Storage | Local MinIO (`localhost:9000`) | — | Server MinIO (`minio:9000`, volume `minio_data`) |
| Logs | Terminal stdout | Terminal stdout | `/etc/dokploy/logs/compose-parse-online-port-wdunfq/` or `docker logs` |


