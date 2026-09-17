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
node -e "const en=require('./apps/web/messages/en.json'); const sk=require('./apps/web/messages/sk.json'); function keys(o,p=''){return Object.keys(o).flatMap(k=>{const path=p?p+'.'+k:k;return(typeof o[k]==='object'&&o[k]!==null)?keys(o[k],path):[path];});} const kEn=keys(en),kSk=keys(sk),sEn=new Set(kEn),sSk=new Set(kSk); const missing=kEn.filter(k=>!sSk.has(k)),extra=kSk.filter(k=>!sEn.has(k)); if(missing.length||extra.length){console.error('i18n asymmetry detected!',{missing,extra});process.exit(1);}else{console.log('✓ i18n 100% symmetric ('+kEn.length+' keys)');}"
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

# 5. Remote deploy via SSH on dev.significa.sk
Write-Host "`n[5/5] Spúšťam zostavenie a nasadenie na serveri dev.significa.sk..." -ForegroundColor Yellow

$remoteCommands = "cd /etc/dokploy/compose/compose-parse-online-port-wdunfq/code/ && "
if ($RunDbInit) {
    $remoteCommands += "echo '==> Spúšťam db-init...' && docker compose run --rm db-init && "
}
$remoteCommands += "echo '==> Prebudovávam web z GitHub main...' && docker compose build --no-cache web && echo '==> Reštartujem web službu...' && docker compose up -d --remove-orphans web"

ssh root@dev.significa.sk $remoteCommands
if ($LASTEXITCODE -ne 0) {
    Write-Host "Chyba pri zostavovaní na serveri!" -ForegroundColor Red
    exit 1
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
