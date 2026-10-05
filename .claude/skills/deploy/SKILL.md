---
name: deploy
description: Safe, one-click deployment of the latest remote main branch to Dokploy for OpenVPM AI. Triggers on "deploy", "deployni", "nasad", "deploy main", "dokploy deploy". Runs pre-flight checks (env-sync, git status, i18n symmetry, type-check), verifies git push to origin/main, triggers build & rollout via webhook, and runs smoke tests.
---

# Deploy Skill — OpenVPM AI Deployment Guide

Automates the verified deployment of the latest `main` branch to the remote Dokploy hosting environment.

> **Production Write Policy**: Production is strictly read-only for agents by default. Deployment pushes to live staging/production and requires an explicit instruction in the user message naming the deployment target. Never deploy without explicit user request.
> All private server credentials, container names, and server IDs reside in `AGENTS.local.md` and `.env`. Never commit them to tracked files.

---

## 1. Triggers

Triggers when the user explicitly requests deployment:
- "deploy" / "deploy to staging" / "deployni to"
- "nasad na server"
- "deploy main" / "dokploy deploy"

---

## 2. Configuration & Environment Variables

Deployment scripts read configuration from the local environment and `.env` (see `docs/agents/AGENTS.local.example.md`):
- `DOKPLOY_HOST`: Hostname for Dokploy API / UI
- `DOKPLOY_SSH_TARGET`: SSH target for manual fallback or logs
- `DOKPLOY_COMPOSE_ID`: Compose service ID in Dokploy
- `DOKPLOY_APP_NAME`: Internal directory name on remote host
- `DEPLOY_PUBLIC_URL`: Public base URL for smoke tests
- `DOKPLOY_DEPLOY_WEBHOOK_URL`: Secret webhook URL triggering build
- `DOKPLOY_TOKEN`: API token for environment sync (`dokploy env push`)

Ground truth for production environment variables is the gitignored `.env.production.local`.

---

## 3. Deployment Workflow

Automated via `.agents/skills/deploy/scripts/deploy.ps1`:

```powershell
# Standard deployment
powershell -File .agents/skills/deploy/scripts/deploy.ps1

# With database schema changes (triggers db-init container)
powershell -File .agents/skills/deploy/scripts/deploy.ps1 -RunDbInit

# Hotfix (skips typecheck)
powershell -File .agents/skills/deploy/scripts/deploy.ps1 -SkipTypeCheck
```

### Execution Phases:
1. **[0/6] Environment Check & Sync**: Verifies `.env.production.local` and syncs keys with Dokploy via `node push-env.js`.
2. **[1/6] Git Status Check**: Ensures no uncommitted working tree changes.
3. **[2/6] i18n Symmetry**: Verifies complete symmetry between `en.json` and `sk.json`.
4. **[3/6] TypeScript Check**: Runs `pnpm --filter @openpims/web type-check`.
5. **[4/6] Git Push**: Pushes verified changes to `origin/main`.
6. **[5/6] Dokploy Trigger**: Triggers deploy webhook (with SSH fallback if configured).
7. **[6/6] Smoke Verification**: Queries public health endpoint (`/api/health`) to verify schema and database status.

---

## 4. Troubleshooting & Rollback

- **Health Check Failure (`/api/health` 503)**:
  Usually indicates missing RLS policies after migration. Re-run RLS policies against remote database using the instructions in `AGENTS.local.md`.
- **Secret Decryption Errors**:
  Ensure encrypted fields in database match the active remote `NEXTAUTH_SECRET`.
- **Stuck Builds / Container Logs**:
  Refer to `AGENTS.local.md` for exact log paths and diagnostic commands on the remote host.
- **Rollback**:
  Use Dokploy dashboard **Deployments -> Rollback** to restore the previous stable build, or point git to the previous commit.
