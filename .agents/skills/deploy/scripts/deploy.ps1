param (
    [switch]$SkipTypeCheck = $false,
    [switch]$RunDbInit = $false,
    [switch]$SkipEnvCheck = $false,
    [string]$EnvFile = ".env.production.local"
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  OPENVPM AI - DEPLOY TO dev.significa.sk (Dokploy)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# --- Load DOKPLOY_TOKEN from .env if not already in environment ---
if (-not $env:DOKPLOY_TOKEN -and (Test-Path ".env")) {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^DOKPLOY_TOKEN\s*=\s*(.*)") { $env:DOKPLOY_TOKEN = $Matches[1].Trim().Trim('"') }
    }
}

# =============================================
# [0/6] ENV PREMENNE - kontrola a sync
# =============================================
if (-not $SkipEnvCheck) {
    Write-Host "
[0/6] Kontrola env premennych (.env.production.local)..." -ForegroundColor Yellow

    if (-not (Test-Path $EnvFile)) {
        Write-Host "CHYBA: Subor '$EnvFile' neexistuje!" -ForegroundColor Red
        Write-Host "Moznosti obnovy:" -ForegroundColor Cyan
        Write-Host "  1. Stiahni aktualne premenne z Dokploy:" -ForegroundColor Cyan
        Write-Host "     dokploy auth -u https://dev.significa.sk -t $DOKPLOY_TOKEN" -ForegroundColor Gray
        Write-Host "     dokploy env pull $EnvFile" -ForegroundColor Gray
        Write-Host "  2. Alebo vytvor rucne z .env.example a naplnaj hodnoty." -ForegroundColor Cyan
        exit 1
    }

    # Kontrola pritomnosti krit. klucov
    powershell -File ".agents/skills/deploy/scripts/env-check.ps1" -EnvFile $EnvFile
    $envCheckCode = $LASTEXITCODE

    if ($envCheckCode -eq 1) {
        Write-Host "Deployment zastaveny - env subor nenajdeny." -ForegroundColor Red
        exit 1
    }
    if ($envCheckCode -eq 2) {
        Write-Host "VAROVANIE: Niektore kluce chybaju. Pokracujem (deploy moze zlyhaf v produkcii)." -ForegroundColor Yellow
    }

    # AKTIVNA ENV OCHRNA: kazdy deploy prepise .env na serveri (zname dokploy
    # spravanie - 109+ premennych sa strati). Vzdy pushnime lokalny env subor
    # pred webhookom, aby sa hodnoty nevyhodili spolu s buildom.
    Write-Host "  Pushujem env do Dokploy (node push-env.js)..." -ForegroundColor Yellow
    node .agents/skills/deploy/scripts/push-env.js $EnvFile
    if ($LASTEXITCODE -ne 0) {
        Write-Host "CHYBA: Synchronizacia env zlyhala. Deploy zastaveny - pri pokracovani by sa env na serveri vymazali." -ForegroundColor Red
        exit 1
    }
    Write-Host "OK Env synchronizovane s Dokploy." -ForegroundColor Green
} else {
    Write-Host "
[0/6] Kontrola env preskocena (-SkipEnvCheck)." -ForegroundColor DarkGray
}

# =============================================
# [1/6] GIT STATUS
# =============================================
Write-Host "
[1/6] Kontrola lokalneho gitu..." -ForegroundColor Yellow
$status = git status --porcelain -uno
if ($status) {
    Write-Host "VAROVANIE: Lokalny repozitar obsahuje necommitute zmeny:" -ForegroundColor Yellow
    git status -s
    $confirm = Read-Host "Chces pokracovat bez tychto zmien? (a/n)"
    if ($confirm -ne "a" -and $confirm -ne "y") {
        Write-Host "Deployment preruseny." -ForegroundColor Red
        exit 1
    }
}

# =============================================
# [2/6] i18n SYMETRIA
# =============================================
Write-Host "
[2/6] Kontrola i18n symetrie..." -ForegroundColor Yellow
node .agents/skills/deploy/scripts/check-i18n.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "Chyba v i18n symetrii! Deployment zastaveny." -ForegroundColor Red
    exit 1
}

# =============================================
# [3/6] TYPESCRIPT TYPE-CHECK
# =============================================
if (-not $SkipTypeCheck) {
    Write-Host "
[3/6] Spustam TypeScript type-check..." -ForegroundColor Yellow
    pnpm --filter @openpims/web type-check
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Type-check zlyhal! Deployment zastaveny." -ForegroundColor Red
        exit 1
    }
    Write-Host "OK Type-check uspesny." -ForegroundColor Green
} else {
    Write-Host "
[3/6] Type-check preskoceny (-SkipTypeCheck)." -ForegroundColor DarkGray
}

# =============================================
# [4/6] GIT PUSH
# =============================================
Write-Host "
[4/6] Odosielam zmeny na remote GitHub origin/main..." -ForegroundColor Yellow
$isAhead = (git rev-list --count origin/main..main).Trim()
if ([int]$isAhead -gt 0) {
    $ghToken = try { (gh auth token 2>$null).Trim() } catch { $null }
    if ($ghToken) {
        git -c credential.helper= push "https://x-access-token:$ghToken@github.com/badmarsh/openvpm-ai.git" main
    } else {
        git push origin main
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Chyba pri git push! Deployment zastaveny." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Vetva main je aktualna oproti origin/main." -ForegroundColor Green
}
$latestCommit = git log -1 --oneline
Write-Host "OK Nasadzovany commit: $latestCommit" -ForegroundColor Green

# =============================================
# [5/6] DOKPLOY WEBHOOK
# =============================================
Write-Host "
[5/6] Spustam deployment cez Dokploy Webhook..." -ForegroundColor Yellow
$webhookUrl = $env:DOKPLOY_DEPLOY_WEBHOOK_URL
if (-not $webhookUrl -and (Test-Path ".env")) {
    Get-Content ".env" | ForEach-Object { if ($_ -match "^DOKPLOY_DEPLOY_WEBHOOK_URL\s*=\s*(.*)") { $webhookUrl = $Matches[1].Trim().Trim('"') } }
}
if (-not $webhookUrl) {
    # Webhook URL obsahuje token - nesmie sa zapisovat do kodu.
    Write-Host "CHYBA: DOKPLOY_DEPLOY_WEBHOOK_URL nie je nastaveny (env alebo .env). Webhook URL obsahuje token a nesmie sa zapisovat do kodu." -ForegroundColor Red
    exit 1
}

try {
    node -e "const https = require('https'); const req = https.request(process.argv[1], {method: 'POST', rejectUnauthorized: false}, res => { console.log('Status:', res.statusCode); res.on('data', d => process.stdout.write(d)); }); req.on('error', e => { console.error(e); process.exit(1); }); req.end();" "$webhookUrl"
    Write-Host "OK Dokploy odpoved: $($res.message)" -ForegroundColor Green
    Write-Host "Build je aktivny a viditelny v Dokploy UI pod Deployments!" -ForegroundColor Cyan
} catch {
    Write-Host "Webhook zlyhal ($($_.Exception.Message)), spustam manualny SSH fallback..." -ForegroundColor Yellow
    $remoteCommands = "cd /etc/dokploy/compose/compose-parse-online-port-wdunfq/code/ && "
    if ($RunDbInit) {
        $remoteCommands += "echo '==> Spustam db-init...' && docker compose run --rm db-init && "
    }
    $remoteCommands += "echo '==> Prebudovavam web...' && docker compose build --no-cache web && docker compose up -d --remove-orphans web"
    ssh root@dev.significa.sk $remoteCommands
}

# =============================================
# [6/6] SMOKE TEST
# =============================================
Write-Host "
[6/6] Overujem dostupnost https://vet.dev.significa.sk..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
try {
    $response = Invoke-WebRequest -Uri "https://vet.dev.significa.sk" -Method Head -SkipCertificateCheck -ErrorAction SilentlyContinue
    $statusCode = $response.StatusCode
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
}

try {
    $health = Invoke-RestMethod -Uri "https://vet.dev.significa.sk/api/health" -SkipCertificateCheck
    $healthOk = $health.ok
    $dbOk = $health.checks.database.ok
} catch {
    $healthOk = $false
    $dbOk = $false
}

Write-Host "HTTP status: $statusCode | Health: ok=$healthOk | DB: ok=$dbOk" -ForegroundColor $(if ($healthOk) { "Green" } else { "Red" })

if (-not $healthOk -or -not $dbOk) {
    Write-Host "
==================================================" -ForegroundColor Red
    Write-Host "  DEPLOYMENT ZAVRENEGOL NEDOSPOVELIVY SMOKE TEST!" -ForegroundColor Red
    Write-Host "  Health endpoint nedokazal overit database/schema." -ForegroundColor Red
    Write-Host "  URL: https://vet.dev.significa.sk" -ForegroundColor Red
    Write-Host "  Commit: $latestCommit" -ForegroundColor Red
    Write-Host "==================================================" -ForegroundColor Red
    Write-Host "Prave kroky: skontroluj Dokploy logs, over env (dokploy env push .env.production.local), pri potrebe restart web kontainera." -ForegroundColor Yellow
    exit 1
}

Write-Host "
==================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT USPESNE DOKONCENY!" -ForegroundColor Green
Write-Host "  URL: https://vet.dev.significa.sk" -ForegroundColor Green
Write-Host "  Commit: $latestCommit" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green


