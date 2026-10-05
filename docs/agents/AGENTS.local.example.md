# AGENTS.local.md — Example Template

> Copy this file to `AGENTS.local.md` in the repo root to provide local operational instructions
> for coding agents. `AGENTS.local.md` is gitignored and will never be committed.

## 1. Remote Server & Staging Environment

| Property | Value (Replace with your infrastructure details) |
|---|---|
| Server & SSH | `user@remote.example.com` |
| Public URL | `https://app.example.com` |
| Dokploy Project ID | `<dokploy-project-id>` |
| Dokploy Environment ID | `<dokploy-environment-id>` |
| Dokploy Compose App ID | `<dokploy-compose-id>` |
| Internal Disk Name / Folder | `<internal-compose-dir-name>` |
| Dokploy Webhook URL | Configured in `.env` as `DOKPLOY_DEPLOY_WEBHOOK_URL` |

## 2. Remote Database Access

Remote container targets:
```bash
# Production database query (Docker Swarm or standalone compose)
docker exec -i <remote-postgres-container-name> psql -U <db-user> -d <db-name>
```

## 3. Deployment & Environment Variables

Variables read by deployment and sync scripts:
- `DOKPLOY_HOST`: Hostname for Dokploy API / UI (e.g. `remote.example.com`)
- `DOKPLOY_SSH_TARGET`: SSH target (e.g. `user@remote.example.com`)
- `DOKPLOY_COMPOSE_ID`: Compose service ID in Dokploy
- `DOKPLOY_APP_NAME`: Dokploy compose directory name
- `DEPLOY_PUBLIC_URL`: Public URL of the deployment for smoke tests
- `DOKPLOY_DEPLOY_WEBHOOK_URL`: Webhook URL for triggering deployments

## 4. Operational Troubleshooting

When troubleshooting remote Dokploy or Docker issues:
- Build logs: `/etc/dokploy/logs/<app-dir-name>/`
- RLS fix: `Get-Content packages/db/rls/enable-rls.sql -Raw | ssh <target> "docker exec -i <db-container> psql -U <user> -d <db>"`
- Secret re-encryption: verify `NEXTAUTH_SECRET` matches between local dump and remote environment.
