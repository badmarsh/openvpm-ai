# env-check.ps1 - Over, ze .env.production.local existuje a obsahuje klucove premenne
param (
    [string]$EnvFile = ".env.production.local"
)

$ErrorActionPreference = "Stop"

$requiredKeys = @(
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "NEXT_PUBLIC_APP_URL",
    "RESEND_API_KEY",
    "RESEND_WEBHOOK_SECRET"
)

if (-not (Test-Path $EnvFile)) {
    Write-Host "CHYBA: Subor '$EnvFile' neexistuje." -ForegroundColor Red
    Write-Host "Vytvor ho prikazom: dokploy env pull .env.production.local" -ForegroundColor Yellow
    exit 1
}

$content = Get-Content $EnvFile -Raw
$missing = @()

foreach ($key in $requiredKeys) {
    if ($content -notmatch "(?m)^$key\s*=") {
        $missing += $key
    }
}

if ($missing.Count -gt 0) {
    Write-Host "VAROVANIE: V '$EnvFile' chybaju kluce:" -ForegroundColor Yellow
    $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    Write-Host "Spusti: dokploy env push $EnvFile" -ForegroundColor Cyan
    exit 2
}

Write-Host "OK Env subor '$EnvFile' obsahuje vsetky povinne kluce." -ForegroundColor Green

