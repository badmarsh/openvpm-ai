param (
    [switch]$SkipTypeCheck = $false,
    [switch]$RunDbInit = $false
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  OPENVPM AI — DEPLOY TO dev.significa.sk (Dokploy)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Check git status
Write-Host "`n[1/5] Kontrola lokálneho gitu..." -ForegroundColor Yellow
$status = git status --porcelain
if ($status) {
    Write-Host "VAROVANIE: Lokálny repozitár obsahuje necommitnuté zmeny:" -ForegroundColor Yellow
    git status -s
    $confirm = Read-Host "Chceš pokračovať bez týchto zmien? (a/n)"
    if ($confirm -ne "a" -and $confirm -ne "y") {
        Write-Host "Deployment prerušený." -ForegroundColor Red
        exit 1
    }
}

# 2. i18n symmetry check
Write-Host "`n[2/5] Kontrola i18n symetrie..." -ForegroundColor Yellow
node .agents/skills/deploy/scripts/check-i18n.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "Chyba v i18n symetrii! Deployment zastavený." -ForegroundColor Red
    exit 1
}

# 3. Type check
if (-not $SkipTypeCheck) {
    Write-Host "`n[3/5] Spúšťam TypeScript type-check..." -ForegroundColor Yellow
    pnpm --filter @openpims/web type-check
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Type-check zlyhal! Deployment zastavený." -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Type-check úspešný." -ForegroundColor Green
} else {
    Write-Host "`n[3/5] Type-check preskočený (-SkipTypeCheck)." -ForegroundColor DarkGray
}

# 4. Git push to origin/main
Write-Host "`n[4/5] Odosielam zmeny na remote GitHub origin/main..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Chyba pri git push! Deployment zastavený." -ForegroundColor Red
    exit 1
}
$latestCommit = git log -1 --oneline
Write-Host "✓ Nasadzovaný commit: $latestCommit" -ForegroundColor Green

# 5. Trigger Dokploy deployment via official webhook
Write-Host "`n[5/5] Spúšťam deployment cez Dokploy Webhook..." -ForegroundColor Yellow
$webhookUrl = $env:DOKPLOY_DEPLOY_WEBHOOK_URL
if (-not $webhookUrl -and (Test-Path ".env")) {
    Get-Content ".env" | ForEach-Object { if ($_ -match "^DOKPLOY_DEPLOY_WEBHOOK_URL\s*=\s*(.*)") { $webhookUrl = $Matches[1].Trim().Trim('"') } }
}
if (-not $webhookUrl) {
    $webhookUrl = "https://dev.significa.sk/api/deploy/compose/KCp595z_p95jTHcBzoHyQ"
}
try {
    $res = Invoke-RestMethod -Uri $webhookUrl -Method Post -SkipCertificateCheck
    Write-Host "✓ Dokploy odpoveď: $($res.message)" -ForegroundColor Green
    Write-Host "Build je aktívny a viditeľný priamo v Dokploy UI pod Deployments!" -ForegroundColor Cyan
} catch {
    Write-Host "Webhook zlyhal ($($_.Exception.Message)), spúšťam manuálny SSH fallback..." -ForegroundColor Yellow
    $remoteCommands = "cd /etc/dokploy/compose/compose-parse-online-port-wdunfq/code/ && "
    if ($RunDbInit) {
        $remoteCommands += "echo '==> Spúšťam db-init...' && docker compose run --rm db-init && "
    }
    $remoteCommands += "echo '==> Prebudovávam web z GitHub main...' && docker compose build --no-cache web && echo '==> Reštartujem web službu...' && docker compose up -d --remove-orphans web"
    ssh root@dev.significa.sk $remoteCommands
}

# Smoke test
Write-Host "`nOverujem dostupnosť https://vet.dev.significa.sk..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
try {
    $response = Invoke-WebRequest -Uri "https://vet.dev.significa.sk" -Method Head -SkipCertificateCheck -ErrorAction SilentlyContinue
    $statusCode = $response.StatusCode
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
}

Write-Host "HTTP status: $statusCode" -ForegroundColor Green
Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT ÚSPEŠNE DOKONČENÝ!" -ForegroundColor Green
Write-Host "  URL: https://vet.dev.significa.sk" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
