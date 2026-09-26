#requires -Version 5.1
<#
.SYNOPSIS
  OpenVPM Agno launcher — sync, configure (AliProxy), start, verify.

.DESCRIPTION
  One script that makes the WSL AgentOS runtime actually come up healthy:

    1. Verifies runtime sources contain the current fixes (urllib import,
       AliProxy-first model routing) — warns when the branch is not merged.
    2. Checks Linux Chrome CDP (:9222, only needed for Arena dispatch).
    3. Probes AliProxy FROM WSL: 127.0.0.1:8080 first, then the Windows host
       IP (WSL2 NAT), then the LAN default — first HTTP 200 wins. This decides
       whether loopback is usable or must be rewritten (OPENVPM_ALIPROXY_ALLOW_LOOPBACK).
    4. Discovers the real chat-model id on the proxy (default preference: qwen-coder).
    5. Upserts the AliProxy config into repo .env AND /home/ubuntu/agno/.env
       (preserving unrelated keys) and blanks the Antigravity keys, so every
       model factory (orchestrator, learning, qwen) routes to AliProxy.
    6. Syncs .agents/agno sources into /home/ubuntu/agno (ext4 copy).
    7. Restarts tmux session 'agno' and waits up to -HealthTimeoutSec (default
       45 — CUDA embedder/reranker load takes ~20 s; the old 4 s check lied
       "(no response yet)" on healthy boots). Dumps the log tail on failure.
    8. Checks the public tunnel and prints the 502 dial-target hint if broken.

.PARAMETER AliproxyKey
  AliProxy API key. Defaults to $env:ALIPROXY_API_KEY, then the embedded
  homelab key. Once this script has run, the key also lives in the gitignored
  repo .env — the script picks it up from there on later runs.

.EXAMPLE
  .\start-agno.ps1
  .\start-agno.ps1 -SkipTunnelCheck -HealthTimeoutSec 60
#>
param(
  [string]$AliproxyKey,
  [string]$AliproxyUrl = "http://127.0.0.1:8080/v1",
  [string]$Model = "qwen-coder",
  [int]$HealthTimeoutSec = 45,
  [switch]$SkipTunnelCheck
)

$ErrorActionPreference = "Continue"

if (-not $AliproxyKey) { $AliproxyKey = $env:ALIPROXY_API_KEY }
if (-not $AliproxyKey) { $AliproxyKey = "sk-aliproxy-f80a66905318186e73855893ece274876a9d4bd6dc08b0c8" }

$RepoRoot  = Split-Path -Parent $MyInvocation.MyCommand.Definition
$TeamOsSrc = Join-Path $RepoRoot ".agents\agno\pipeline_team_os.py"
$EnvFileWin = Join-Path $RepoRoot ".env"
$Distro  = "Ubuntu"
$WslAgno = "/home/ubuntu/agno"

# ── helpers ──────────────────────────────────────────────────────────────────
function Wsl([string]$Cmd) {
  return ((& wsl.exe -d $Distro -e bash -c $Cmd 2>&1 | Out-String)).Trim()
}
function Step([int]$N, [string]$Msg) { Write-Host ""; Write-Host "[$N/7] $Msg" }
function Ok([string]$Msg)   { Write-Host "  OK: $Msg" -ForegroundColor Green }
function Warn([string]$Msg) { Write-Host "  WARNING: $Msg" -ForegroundColor Yellow }
function Fail([string]$Msg) { Write-Host "  ERROR: $Msg" -ForegroundColor Red }

function Merge-EnvLines([string[]]$Existing, [hashtable]$Values) {
  $lines = New-Object System.Collections.Generic.List[string]
  foreach ($l in $Existing) { if ($null -ne $l) { $lines.Add($l) } }
  foreach ($k in $Values.Keys) {
    $idx = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
      if ($lines[$i] -match ("^" + [regex]::Escape($k) + "=")) { $idx = $i; break }
    }
    if ($idx -ge 0) { $lines[$idx] = ($k + "=" + $Values[$k]) }
    else { $lines.Add(($k + "=" + $Values[$k])) }
  }
  return $lines.ToArray()
}

# ═════════════════════════════════════════════════════════════════════════════
Write-Host "============================================================"
Write-Host "  Agno Pipeline Team - launcher (start-agno.ps1)"
Write-Host "============================================================"

# ── 1. Source sanity ─────────────────────────────────────────────────────────
Step 1 "Checking runtime sources for current fixes..."
if (-not (Test-Path $TeamOsSrc)) { Fail "pipeline_team_os.py not found at $TeamOsSrc"; exit 1 }
$src = Get-Content $TeamOsSrc -Raw
if ($src -match [regex]::Escape("import urllib.request")) {
  Ok "urllib fix present (proxy model validation works)"
} else {
  Warn "pipeline_team_os.py misses the urllib fix - old tree."
  Write-Host "       Run: git merge origin/arena/01a0df16-openvpm-ai   then re-run this script."
}
if ($src -match [regex]::Escape("_primary_chat_proxy")) {
  Ok "AliProxy-first model routing present"
} else {
  Warn "AliProxy-first routing missing (old tree) - orchestrator/learning would still target Antigravity."
}

# ── 2. Chrome CDP (informational) ────────────────────────────────────────────
Step 2 "Checking Linux Chrome CDP on 127.0.0.1:9222..."
$cdp = Wsl "curl -s -m 2 -o /dev/null -w '%{http_code}' http://127.0.0.1:9222/json/version 2>/dev/null"
if ($cdp -eq "200") { Ok "Chrome CDP active on :9222" }
else { Warn "Chrome CDP not responding (only needed for Arena dispatch - start it with ag-chrome in WSL)." }

# ── 3. AliProxy probe from WSL ───────────────────────────────────────────────
Step 3 "Probing AliProxy from inside WSL..."
function Test-Proxy([string]$Base) {
  $cmd = "curl -s -m 3 -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer $AliproxyKey' '$Base/models'"
  return ((Wsl $cmd) -eq "200")
}
$wslHostIp = Wsl "ip route show default 2>/dev/null | sed -n 's/.*via \([0-9.]*\).*/\1/p'"

$candidates = New-Object System.Collections.Generic.List[string]
$candidates.Add($AliproxyUrl)
if ($wslHostIp) {
  $hostBase = "http://" + $wslHostIp + ":8080/v1"
  if (-not $candidates.Contains($hostBase)) { $candidates.Add($hostBase) }
}
$lanBase = "http://192.168.0.100:8080/v1"
if (-not $candidates.Contains($lanBase)) { $candidates.Add($lanBase) }

$workingBase = $null
foreach ($c in $candidates) {
  Write-Host "  probing $c ..."
  if (Test-Proxy $c) { $workingBase = $c; break }
}
$allowLoopback = "0"
if ($workingBase) {
  Ok "AliProxy reachable at $workingBase"
  if ($workingBase -match "127\.0\.0\.1|localhost") { $allowLoopback = "1" }
} else {
  Warn "No AliProxy candidate reachable from WSL - continuing with $AliproxyUrl (runtime will log connection errors)."
  $workingBase = $AliproxyUrl
  $allowLoopback = "1"
}

# ── 4. Model discovery on the proxy ──────────────────────────────────────────
Step 4 "Resolving chat model id on the proxy..."
$listCmd = "curl -s -m 5 -H 'Authorization: Bearer $AliproxyKey' '$workingBase/models'"
$raw = Wsl $listCmd
$modelIds = @()
try {
  $parsed = $raw | ConvertFrom-Json
  if ($parsed.data) { foreach ($m in $parsed.data) { $modelIds += [string]$m.id } }
} catch { }
if ($modelIds.Count -eq 0) {
  Warn "Could not list proxy models - using '$Model' as configured."
} else {
  $chosen = $null
  if ($modelIds -contains $Model) { $chosen = $Model }
  else { foreach ($m in $modelIds) { if ($m -like ("*" + $Model + "*")) { $chosen = $m; break } } }
  if (-not $chosen) { foreach ($m in $modelIds) { if ($m -like "*qwen*") { $chosen = $m; break } } }
  if (-not $chosen) { $chosen = $modelIds[0] }
  if ($chosen -ne $Model) { Write-Host "  '$Model' not on proxy - using '$chosen'" }
  Ok "chat model: $chosen"
  $Model = $chosen
}

# ── 5. Write config into .env (repo + WSL copy), preserving other keys ───────
Step 5 "Writing AliProxy configuration..."
$values = @{
  ALIPROXY_BASE_URL               = $workingBase
  ALIPROXY_API_KEY                = $AliproxyKey
  OPENVPM_ALIPROXY_ALLOW_LOOPBACK = $allowLoopback
  OPENVPM_ORCHESTRATOR_MODEL      = $Model
  OPENVPM_LEARNING_MODEL          = $Model
  QWEN_CODER_MODEL                = $Model
  ANTIGRAVITY_API_KEY             = ""     # kvóta vyčerpaná -> prázdny kľúč = AliProxy routing
  AGNO_PROXY_API_KEY              = ""
  AI_API_KEY                      = ""
  OPENVPM_AGENTOS_HOST            = "0.0.0.0"
  OPENVPM_AGENTOS_PORT            = "7777"
  OPENVPM_AGENTOS_INTERNAL_URL    = "http://127.0.0.1:7777"
}

$winExisting = @()
if (Test-Path $EnvFileWin) { $winExisting = @(Get-Content $EnvFileWin) }
$winMerged = Merge-EnvLines $winExisting $values
Set-Content -Path $EnvFileWin -Value $winMerged -Encoding ASCII
Ok "repo .env updated ($EnvFileWin - gitignored)"

$wslExisting = @()
$rawEnv = Wsl ("cat $WslAgno/.env 2>/dev/null")
if ($rawEnv) { $wslExisting = $rawEnv -split "`r?`n" }
$merged = Merge-EnvLines $wslExisting $values
$envContent = ($merged -join "`n") + "`n"
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($envContent))
$null = Wsl ("mkdir -p $WslAgno/tmp && echo $b64 | base64 -d > $WslAgno/.env && chmod 600 $WslAgno/.env")
Ok "$WslAgno/.env written (chmod 600)"

# ── 6. Sync sources + restart tmux + health wait ─────────────────────────────
Step 6 "Syncing Agno sources and restarting AgentOS..."
$repoWsl = Wsl ("wslpath -a '" + $RepoRoot + "'")
if (-not $repoWsl) { Fail "wslpath failed for '$RepoRoot'"; exit 1 }
$agnoWsl = $repoWsl + "/.agents/agno"
$sync = Wsl ("mkdir -p $WslAgno && cp -f '" + $agnoWsl + "'/*.py $WslAgno/ && cp -f '" + $agnoWsl + "'/*.ts $WslAgno/ && echo SYNCED")
if ($sync -match "SYNCED") { Ok "sources synced to $WslAgno" }
else { Fail "sync failed: $sync"; exit 1 }

$null = Wsl "tmux kill-session -t agno 2>/dev/null; tmux new-session -d -s agno 'cd /home/ubuntu/agno && .venv/bin/python pipeline_team_os.py 2>&1 | tee /tmp/agno_os.log'"
Ok "tmux session 'agno' started"

Write-Host ""
Write-Host "  Waiting for /health (up to $HealthTimeoutSec s - CUDA model load can take ~20 s)..."
$deadline = (Get-Date).AddSeconds($HealthTimeoutSec)
$healthy = $false
$resp = ""
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 2
  $resp = Wsl "curl -s -m 3 http://127.0.0.1:7777/health 2>/dev/null"
  if ($resp -match '"status"\s*:\s*"ok"') { $healthy = $true; break }
}
if ($healthy) {
  Ok "AgentOS healthy: $resp"
} else {
  Fail "AgentOS did not answer /health within $HealthTimeoutSec s. Last 40 log lines:"
  Write-Host (Wsl "tail -n 40 /tmp/agno_os.log")
  exit 1
}

# ── 7. Tunnel check ──────────────────────────────────────────────────────────
if (-not $SkipTunnelCheck) {
  Step 7 "Public tunnel check..."
  $code = & curl.exe -s -m 8 -o NUL -w "%{http_code}" "https://agentos-tunnel.significa.sk/health" 2>$null
  if ($code -eq "200") { Ok "tunnel HTTP 200" }
  elseif ($code -eq "502") {
    Warn "tunnel HTTP 502 - ingress 'service:' must dial http://127.0.0.1:7777 (never 0.0.0.0). See CLOUDFLARE_TUNNEL.md."
  } else {
    Warn "tunnel HTTP $code (530/1033 = cloudflared not running; start it, or skip with -SkipTunnelCheck)."
  }
}

Write-Host ""
Write-Host "============================================================"
Write-Host "  AgentOS is RUNNING"
Write-Host "    chat model : $Model @ $workingBase (AliProxy-first)"
Write-Host "    AgentOS    : http://127.0.0.1:7777"
Write-Host "    tunnel     : https://agentos-tunnel.significa.sk"
Write-Host "    logs       : wsl -d Ubuntu -e bash -c 'tail -f /tmp/agno_os.log'"
Write-Host "    tmux       : wsl -d Ubuntu tmux attach -t agno"
Write-Host "============================================================"
