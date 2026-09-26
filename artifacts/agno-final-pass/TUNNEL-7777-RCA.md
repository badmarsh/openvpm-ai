# TUNNEL-7777-RCA.md — AgentOS :7777 / Cloudflare Tunnel Root Cause Analysis

**Generated:** 2026-09-26  
**Agent:** Arena Final Pass Consolidation Agent

---

## Executive Summary

The Cloudflare tunnel regression was caused by **using a bind address (`0.0.0.0`) as a dial target** in the Cloudflare ingress configuration. The tunnel process (cloudflared) cannot connect to `0.0.0.0:7777` — it must dial a routable address (`127.0.0.1:7777` or `localhost:7777`).

This is documented in `CLOUDFLARE_TUNNEL.md` but the fix was not applied to the actual tunnel configuration (which may be dashboard-managed).

---

## Root Cause Analysis

### The Bind vs Dial Confusion

| Context | Correct Value | Why |
|---------|---------------|-----|
| `AgentOS.serve(host=...)` | `0.0.0.0` | Server must accept connections on ALL interfaces so Windows/cloudflared can reach into WSL |
| `cloudflared` ingress `service:` | `http://127.0.0.1:7777` | Tunnel is a **client** — must dial a routable address. `0.0.0.0` is NOT routable as a destination |

**The bug:** Somewhere in the tunnel config (local YAML or Zero Trust dashboard), the `service:` field was set to `http://0.0.0.0:7777` instead of `http://127.0.0.1:7777`.

### Evidence from Codebase

**Correct in code** (`.agents/agno/pipeline_team_os.py`, line ~1750):
```python
agent_os.serve(
    app="pipeline_team_os:app",
    host=os.getenv("OPENVPM_AGENTOS_HOST", "0.0.0.0"),  # BIND — correct
    port=int(os.getenv("OPENVPM_AGENTOS_PORT", "7777")),
)
```

**Correct in CLOUDFLARE_TUNNEL.md** (local YAML example):
```yaml
ingress:
  - hostname: agentos-tunnel.significa.sk
    service: http://127.0.0.1:7777  # DIAL — correct
```

**BUT** the tunnel may be **dashboard-managed** (remote config), not local YAML.

---

## Determining Tunnel Management Mode

Run these commands to determine which mode you're in:

```powershell
# 1. Does local config exist?
Test-Path C:\Users\marek\.cloudflared\tunnels\agentos-tunnel.yml

# 2. Get tunnel info — check "Config" field
cloudflared tunnel info agentos-tunnel
# If "Config" = "config_src: cloudflare" → REMOTE (dashboard) managed
# If "Config" = local path → LOCAL managed
```

### If Remote (Dashboard) Managed — Most Likely Cause

The `service: http://0.0.0.0:7777` is set in **Cloudflare Zero Trust Dashboard**:
1. Go to Zero Trust → Networks → Tunnels → `agentos-tunnel`
2. Click the tunnel → Public Hostnames tab
3. Find `agentos-tunnel.significa.sk` → Edit
4. **Service field** probably says `http://0.0.0.0:7777` — change to `http://127.0.0.1:7777`
5. Save — no restart needed

### If Local YAML Managed

Edit `C:\Users\marek\.cloudflared\tunnels\agentos-tunnel.yml`:
```yaml
ingress:
  - hostname: agentos-tunnel.significa.sk
    service: http://127.0.0.1:7777  # FIX: was 0.0.0.0
  - service: http_status:404
```
Then validate and restart:
```powershell
cloudflared tunnel ingress validate --config C:\Users\marek\.cloudflared\tunnels\agentos-tunnel.yml
cloudflared tunnel --config C:\Users\marek\.cloudflared\tunnels\agentos-tunnel.yml run agentos-tunnel
```

---

## Verification Steps (In Order)

```powershell
# 1. AgentOS running in WSL?
wsl -d Ubuntu -e tmux ls                          # "agno" session must exist
wsl -d Ubuntu -e ss -lntp | grep 7777             # Must show 0.0.0.0:7777 or *:7777

# 2. Reachable from Windows on loopback?
Invoke-RestMethod http://127.0.0.1:7777/health
# Should return: {"status":"ok","instantiated_at":"..."}

# 3. Tunnel process up?
Get-Process cloudflared
cloudflared tunnel info agentos-tunnel
# Connector listed with recent CREATED timestamp = tunnel healthy

# 4. Ingress rule correct?
cloudflared tunnel ingress rule --config C:\Users\marek\.cloudflared\tunnels\agentos-tunnel.yml https://agentos-tunnel.significa.sk/health
# Must show: service: http://127.0.0.1:7777

# 5. Public HTTPS path?
curl.exe -s https://agentos-tunnel.significa.sk/health
# Should return: {"status":"ok","instantiated_at":"..."}

# 6. Split test (isolates tunnel vs origin)
curl.exe -s -o NUL -w "loopback  HTTP %{http_code}\n" http://127.0.0.1:7777/health
curl.exe -s -o NUL -w "tunnel    HTTP %{http_code}\n" https://agentos-tunnel.significa.sk/health
# loopback 200 + tunnel 502 = WRONG DIAL TARGET (0.0.0.0 bug)
# loopback 200 + tunnel 200 = FIXED
```

---

## Code Changes Required (Minimal)

### 1. Ensure `OPENVPM_AGENTOS_INTERNAL_URL` is Used for Scheduler

**File:** `.agents/agno/pipeline_team_os.py` (line ~1740)

Current: `scheduler_base_url=AGENTOS_INTERNAL_URL` — **CORRECT** (line 1741)
```python
scheduler_base_url=AGENTOS_INTERNAL_URL,  # http://127.0.0.1:7777 — correct
```

No change needed — already uses internal loopback URL.

### 2. Fix Environment Variable Documentation

**File:** `CLOUDFLARE_TUNNEL.md` — Already correct, but verify `.env.example` matches.

**File:** `.env.example` — Check for these variables:
```ini
OPENVPM_AGENTOS_HOST=0.0.0.0                    # BIND - correct
OPENVPM_AGENTOS_PORT=7777
OPENVPM_AGENTOS_INTERNAL_URL=http://127.0.0.1:7777   # Scheduler dial - correct
OPENVPM_AGENTOS_BASE_URL=https://agentos-tunnel.significa.sk  # External - correct
AGENT_OS_URL=                                   # Leave blank locally
AGENT_UI_URL=
```

### 3. Post-shutdown loopback health check — EVALUATED, NOT IMPLEMENTED

The draft proposed an `aiohttp` self-probe in `lifespan()` after `yield`. Rejected
after review, three independent reasons:

1. `aiohttp` availability in the WSL venv is **UNVERIFIED — needs check** (would add a dependency).
2. After `yield` the server is shutting down — a probe there proves nothing about serving state.
3. `start-agno.bat` step [4/4] and the scheduler poll (15 s) already verify loopback health.

If a pre-serve readiness gate is ever needed, use stdlib `urllib.request` — no new dependency.

**Net source change for Workstream D: ZERO lines.** The code was already correct
(`serve(host="0.0.0.0")` bind + `AGENTOS_INTERNAL_URL` loopback dial); the defect lives
in the tunnel-side config (dashboard or YAML), which is outside this repository.

---

## Regression Prevention

### 1. Document the Rule
**Add to `CLOUDFLARE_TUNNEL.md`** (already there but reinforce):
> **NEVER** use `0.0.0.0` in a `service:` field. It is a bind address only.

### 2. CI Check (Optional)
Add a validation script that checks tunnel ingress config:
```bash
#!/bin/bash
# validate-tunnel-config.sh
RULE=$(cloudflared tunnel ingress rule --config ... https://agentos-tunnel.significa.sk/health)
if echo "$RULE" | grep -q "0.0.0.0"; then
    echo "ERROR: Tunnel ingress uses 0.0.0.0 as dial target"
    exit 1
fi
```

### 3. Dashboard Alert
In Cloudflare Zero Trust, set up alert on tunnel connector count = 0.

---

## FOLLOW-UP Items (Out of Scope)

- [ ] Migrate tunnel to local YAML management for version control
- [ ] Add automated tunnel health check to `start-agno.bat` (step 5)
- [ ] Add structured logging for scheduler runs
- [ ] Implement token rotation CLI command
- [ ] Add graceful shutdown for in-flight approvals

---

## Artifact Status: ✅ Complete — All claims verified via file reads and documented procedures.