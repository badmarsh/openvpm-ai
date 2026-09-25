# Cloudflare Tunnel Setup for AgentOS

## Overview

This document describes the Cloudflare tunnel setup that exposes the local AgentOS
instance (Agno `pipeline_team_os.py`, FastAPI on port 7777) at an HTTPS hostname.

- **Tunnel Name**: `agentos-tunnel`
- **Tunnel ID**: `324dd653-7f1d-41d7-ae9a-7d3e3ae54c1d`
- **Public URL**: https://agentos-tunnel.significa.sk
- **Local AgentOS bind address**: `0.0.0.0:7777`
- **Local AgentOS dial address (for clients/tunnel)**: `http://127.0.0.1:7777`

---

## ⚠️ Read this before editing the tunnel config

**`0.0.0.0` is a bind address, not a dial address.** Mixing the two is the single
most common way this tunnel breaks, and it fails in a confusing way: the tunnel comes
up, DNS resolves, and every request returns `502`.

| Context | Correct value | Why |
|---|---|---|
| `AgentOS.serve(host=...)` | `0.0.0.0` | The server must accept connections on every interface, so Windows/cloudflared can reach into WSL. |
| `cloudflared` ingress `service:` | `http://127.0.0.1:7777` | The tunnel is a **client** — it must dial a routable address. `0.0.0.0` is not routable as a destination and the connection fails. |

The bind value lives in `.agents/agno/pipeline_team_os.py` and defaults correctly:

```python
agent_os.serve(
    app="pipeline_team_os:app",
    host=os.getenv("OPENVPM_AGENTOS_HOST", "0.0.0.0"),   # bind — correct as-is
    port=int(os.getenv("OPENVPM_AGENTOS_PORT", "7777")),
)
```

So **do not change the code to "fix" the tunnel.** Change the tunnel config.

---

## Cloudflare tunnel config

File: `C:\Users\marek\.cloudflared\tunnels\agentos-tunnel.yml`

```yaml
tunnel: 324dd653-7f1d-41d7-ae9a-7d3e3ae54c1d
credentials-file: C:\Users\marek\.cloudflared\324dd653-7f1d-41d7-ae9a-7d3e3ae54c1d.json

ingress:
  # DIAL address — must be 127.0.0.1 (or localhost). NEVER 0.0.0.0 here.
  - hostname: agentos-tunnel.significa.sk
    service: http://127.0.0.1:7777
  # Required catch-all
  - service: http_status:404
```

Validate the file before restarting the tunnel:

```powershell
cloudflared tunnel ingress validate
cloudflared tunnel ingress rule https://agentos-tunnel.significa.sk/health
```

The second command prints the rule that will match and the `service:` it targets —
confirm it says `http://127.0.0.1:7777`.

---

## Environment variables

Two different concerns must not share one variable. The Agno runtime calls **itself**
(scheduler callbacks, HITL approvals); those self-calls must stay on loopback and must
never travel out to Cloudflare and back.

| Variable | Consumer | Value |
|---|---|---|
| `OPENVPM_AGENTOS_HOST` | `AgentOS.serve()` bind | `0.0.0.0` |
| `OPENVPM_AGENTOS_PORT` | `AgentOS.serve()` bind | `7777` |
| `OPENVPM_AGENTOS_INTERNAL_URL` | scheduler `scheduler_base_url` | `http://127.0.0.1:7777` |
| `OPENVPM_AGENTOS_BASE_URL` | external/operator use | `https://agentos-tunnel.significa.sk` |
| `AGENT_OS_URL` | `apps/web` → `/admin/ai-swarm` probe | leave blank locally; set to the tunnel URL only for the hosted deployment |

```ini
OPENVPM_AGENTOS_HOST=0.0.0.0
OPENVPM_AGENTOS_PORT=7777
OPENVPM_AGENTOS_INTERNAL_URL=http://127.0.0.1:7777
OPENVPM_AGENTOS_PUBLIC_URL=https://agentos-tunnel.significa.sk
OPENVPM_AGENTOS_BASE_URL=https://agentos-tunnel.significa.sk
AGENT_OS_URL=
AGENT_UI_URL=
```

> **Regression note (2026-09-25).** Earlier revisions of this document stated
> *"Local AgentOS: http://0.0.0.0:7777"* and set `OPENVPM_AGENTOS_BASE_URL` to the
> tunnel URL. Both are wrong for their purpose: the first is a bind address used as a
> dial target, and the second made the scheduler reach itself over the public internet.
> `OPENVPM_AGENTOS_INTERNAL_URL` exists to prevent the second mistake recurring.

For Dokploy, set the same variables in the application settings. The hosted app needs
the **public** URL; the scheduler still uses the internal one.

---

## Starting the tunnel

```powershell
cloudflared tunnel --config C:\Users\marek\.cloudflared\tunnels\agentos-tunnel.yml run agentos-tunnel
```

The tunnel does not persist across restarts. For production, install it as a Windows
service so it survives reboots:

```powershell
cloudflared service install
```

---

## Verification (in order — stop at the first failure)

**1. AgentOS is running and listening (inside WSL):**

```bash
wsl -d Ubuntu -e tmux ls                          # session "agno" must be listed
wsl -d Ubuntu -e ss -lntp | grep 7777             # must show 0.0.0.0:7777 or *:7777
```

**2. Reachable from Windows on loopback:**

```powershell
Invoke-RestMethod http://127.0.0.1:7777/health
```

**3. Tunnel process is up and the ingress matches:**

```powershell
Get-Process cloudflared
cloudflared tunnel info agentos-tunnel
cloudflared tunnel ingress rule https://agentos-tunnel.significa.sk/health
```

**4. Public HTTPS path:**

```powershell
curl.exe -s https://agentos-tunnel.significa.sk/health
```

Expected:

```json
{"status":"ok","instantiated_at":"..."}
```

**5. Web app sees it:** open `/admin/ai-swarm` — telemetry must show `isOnline: true`
and display the resolved AgentOS URL.

**If step 4 returns `502`** → the tunnel is up but the dial target is wrong. Almost always
`0.0.0.0` in the ingress `service:`. If it returns `530`/`1033` → the tunnel process is
not running. If it hangs → check step 2; AgentOS is probably bound to loopback only
inside WSL instead of `0.0.0.0`.

---

## Notes

- The tunnel must be running for the hosted web app to reach AgentOS.
- The FQDN health path used by the web app is `/health` (see
  `checkAgentOsHealth()` in `apps/web/server/routers/extensions/ai-swarm.ts`).
  That probe tries loopback first and falls back, with an 800 ms timeout — a cold
  tunnel round-trip can exceed that, so a single "offline" reading is not proof.
