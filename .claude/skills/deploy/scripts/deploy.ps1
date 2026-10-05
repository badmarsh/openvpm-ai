param (
    [switch]$SkipTypeCheck = $false,
    [switch]$RunDbInit = $false,
    [switch]$SkipEnvCheck = $false,
    [string]$EnvFile = ".env.production.local"
)

$ErrorActionPreference = "Stop"

function Get-EnvKey([string]$key) {
    $val = [System.Environment]::GetEnvironmentVariable($key)
    if ($val) { return $val }
    if (Test-Path ".env") {
        foreach ($line in Get-Content ".env") {
            $trimmed = $line.Trim()
            if ($trimmed -match "^$([regex]::Escape($key))\s*=\s*(.*)") {
                return $Matches[1].Trim().Trim('"').Trim("'")
            }
        }
    }
    return $null
}

$dokployHost = Get-EnvKey "DOKPLOY_HOST"
$dokployToken = Get-EnvKey "DOKPLOY_TOKEN"
$dokploySshTarget = Get-EnvKey "DOKPLOY_SSH_TARGET"
$dokployAppName = Get-EnvKey "DOKPLOY_APP_NAME"
$deployPublicUrl = Get-EnvKey "DEPLOY_PUBLIC_URL"
$webhookUrl = Get-EnvKey "DOKPLOY_DEPLOY_WEBHOOK_URL"
$insecureTls = (Get-EnvKey "DOKPLOY_INSECURE_TLS") -eq "true"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  OPENVPM AI - DEPLOY (Dokploy)" -ForegroundColor Cyan
if ($dokployHost) { Write-Host "  Target: $dokployHost" -ForegroundColor Cyan }
Write-Host "==================================================" -ForegroundColor Cyan

if (-not $SkipEnvCheck) {
    Write-Host "`n[0/6] Kontrola env premennych ($EnvFile)..." -ForegroundColor Yellow
    if (-not (Test-Path $EnvFile)) {
        Write-Host "CHYBA: Subor '$EnvFile' neexistuje!" -ForegroundColor Red
        Write-Host "Vytvorte subor z .env.example alebo stiahnite z Dokploy." -ForegroundColor Cyan
        exit 1
    }
    powershell -File ".agents/skills/deploy/scripts/env-check.ps1" -EnvFile $EnvFile
    $envCheckCode = $LASTEXITCODE
    if ($envCheckCode -eq 1) {
        Write-Host "Deployment zastaveny - env subor nenajdeny." -ForegroundColor Red
        exit 1
    }
    if ($envCheckCode -eq 2) {
        Write-Host "VAROVANIE: Niektore kluce chybaju. Pokracujem." -ForegroundColor Yellow
    }
    Write-Host "  Pushujem env do Dokploy (node push-env.js)..." -ForegroundColor Yellow
    node .agents/skills/deploy/scripts/push-env.js $EnvFile
    if ($LASTEXITCODE -ne 0) {
        Write-Host "CHYBA: Synchronizacia env zlyhala. Deploy zastaveny." -ForegroundColor Red
        exit 1
    }
    Write-Host "OK Env synchronizovane s Dokploy." -ForegroundColor Green
} else {
    Write-Host "`n[0/6] Kontrola env preskocena (-SkipEnvCheck)." -ForegroundColor DarkGray
}

Write-Host "`n[1/6] Kontrola lokalneho gitu..." -ForegroundColor Yellow
$status = git status --porcelain -uno
if ($status) {
    Write-Host "VAROVANIE: Lokalny repozitar obsahuje necommitnute zmeny:" -ForegroundColor Yellow
    git status -s
    $confirm = Read-Host "Chces pokracovat bez tychto zmien? (a/n)"
    if ($confirm -ne "a" -and $confirm -ne "y") {
        Write-Host "Deployment preruseny." -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n[2/6] Kontrola i18n symetrie..." -ForegroundColor Yellow
node .agents/skills/deploy/scripts/check-i18n.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "Chyba v i18n symetrii! Deployment zastaveny." -ForegroundColor Red
    exit 1
}

if (-not $SkipTypeCheck) {
    Write-Host "`n[3/6] Spustam TypeScript type-check..." -ForegroundColor Yellow
    pnpm --filter @openpims/web type-check
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Type-check zlyhal! Deployment zastaveny." -ForegroundColor Red
        exit 1
    }
    Write-Host "OK Type-check uspesny." -ForegroundColor Green
} else {
    Write-Host "`n[3/6] Type-check preskoceny (-SkipTypeCheck)." -ForegroundColor DarkGray
}

Write-Host "`n[4/6] Odosielam zmeny na remote GitHub origin/main..." -ForegroundColor Yellow
$isAhead = (git rev-list --count origin/main..main).Trim()
if ([int]$isAhead -gt 0) {
    git push origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Chyba pri git push! Deployment zastaveny." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Vetva main je aktualna oproti origin/main." -ForegroundColor Green
}
$latestCommit = git log -1 --oneline
Write-Host "OK Nasadzovany commit: $latestCommit" -ForegroundColor Green

Write-Host "`n[5/6] Spustam deployment cez Dokploy Webhook..." -ForegroundColor Yellow
if (-not $webhookUrl) {
    Write-Host "CHYBA: DOKPLOY_DEPLOY_WEBHOOK_URL nie je nastaveny v env ani v .env." -ForegroundColor Red
    exit 1
}
$tlsOpt = if ($insecureTls) { "rejectUnauthorized: false" } else { "rejectUnauthorized: true" }
try {
    node -e "const https = require('https'); const req = https.request(process.argv[1], {method: 'POST', $tlsOpt}, res => { console.log('Status:', res.statusCode); res.on('data', d => process.stdout.write(d)); }); req.on('error', e => { console.error(e); process.exit(1); }); req.end();" "$webhookUrl"
    Write-Host "OK Webhook odoslany. Build prebieha v Dokploy." -ForegroundColor Green
} catch {
    Write-Host "Webhook zlyhal ($($_.Exception.Message))." -ForegroundColor Yellow
    if ($dokploySshTarget -and $dokployAppName) {
        Write-Host "Spustam manualny SSH fallback na $dokploySshTarget..." -ForegroundColor Yellow
        $remoteCommands = "cd /etc/dokploy/compose/$dokployAppName/code/ && "
        if ($RunDbInit) {
            $remoteCommands += "echo '==> Spustam db-init...' && docker compose run --rm db-init && "
        }
        $remoteCommands += "echo '==> Prebudovavam web...' && docker compose build --no-cache web && docker compose up -d --remove-orphans web"
        ssh $dokploySshTarget $remoteCommands
    } else {
        Write-Host "SSH fallback nie je mozny - chybaju DOKPLOY_SSH_TARGET alebo DOKPLOY_APP_NAME." -ForegroundColor Red
        exit 1
    }
}

if ($deployPublicUrl) {
    Write-Host "`n[6/6] Overujem dostupnost $deployPublicUrl..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    $webArgs = @{ Uri = $deployPublicUrl; Method = "Head"; ErrorAction = "SilentlyContinue" }
    $restArgs = @{ Uri = "$deployPublicUrl/api/health"; ErrorAction = "SilentlyContinue" }
    if ($insecureTls) {
        $webArgs["SkipCertificateCheck"] = $true
        $restArgs["SkipCertificateCheck"] = $true
    }
    try {
        $response = Invoke-WebRequest @webArgs
        $statusCode = $response.StatusCode
    } catch {
        $statusCode = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { 0 }
    }
    try {
        $health = Invoke-RestMethod @restArgs
        $healthOk = $health.ok
        $dbOk = $health.checks.database.ok
    } catch {
        $healthOk = $false
        $dbOk = $false
    }
    Write-Host "HTTP status: $statusCode | Health: ok=$healthOk | DB: ok=$dbOk" -ForegroundColor $(if ($healthOk) { "Green" } else { "Red" })
    if (-not $healthOk -or -not $dbOk) {
        Write-Host "`n==================================================" -ForegroundColor Red
        Write-Host "  SMOKE TEST ZLYHAL!" -ForegroundColor Red
        Write-Host "  Health endpoint neoveril databazu/schemu." -ForegroundColor Red
        Write-Host "  URL: $deployPublicUrl" -ForegroundColor Red
        Write-Host "  Commit: $latestCommit" -ForegroundColor Red
        Write-Host "==================================================" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`n[6/6] Smoke test preskoceny (DEPLOY_PUBLIC_URL nie je nastavena)." -ForegroundColor DarkGray
}

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT USPESNE DOKONCENY!" -ForegroundColor Green
if ($deployPublicUrl) { Write-Host "  URL: $deployPublicUrl" -ForegroundColor Green }
Write-Host "  Commit: $latestCommit" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
