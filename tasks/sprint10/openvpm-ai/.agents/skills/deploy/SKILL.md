---
name: deploy
description: Safe, one-click deployment of the latest remote main branch to Dokploy on dev.significa.sk for OpenVPM AI. Triggers on "deploy", "deployni", "nasad", "deploy main", "dokploy deploy", "nasad na dev.significa.sk". Runs pre-flight checks (env-sync, git status, i18n symmetry, type-check), verifies git push to origin/main, triggers build & rollout on dev.significa.sk, and runs smoke tests.
---

# Deploy Skill — OpenVPM AI na server dev.significa.sk

Tento skill riadi bezpecny, reprodukovatelny a overeny deployment najnovsej vetvy `main` aplikacie **OpenVPM AI** z lokalneho prostredia na server **`dev.significa.sk`** do existujucej Dokploy Compose aplikacie **`openvpm-ai`**.

---

## 1. Kedy sa tento skill aktivuje

Aktivuje sa vzdy, ked pouzivatel poziada o nasadenie:
- `deploy` / `deployni to`
- `nasad na server` / `nasad na dev.significa.sk`
- `deploy main` / `deploy latest remote main`
- `dokploy deploy`

---

## 2. Architektúra a serverové parametre

- **Server & SSH:** `root@dev.significa.sk`
- **Verejna domena:** `https://vet.dev.significa.sk`
- **Dokploy Project ID:** `DcWUBuOSe4H0UfF-OpLPb` (OpenVPM AI)
- **Dokploy Environment ID:** `dgpMIXk6UxZf_nS2fH3xU` (production)
- **Dokploy Compose App ID:** `pvdhIxlCIhYTKvnmrZ8Mk` (`openvpm-ai`)
- **Interni appName na disku:** `compose-parse-online-port-wdunfq`
- **Cesta ku kodu na serveri:** `/etc/dokploy/compose/compose-parse-online-port-wdunfq/code/`
- **Klucove kontajnery:**
  - `compose-parse-online-port-wdunfq-web-1` (Next.js 15 standalone, port 3000)
  - `openvpm-postgres-cfoqxx` (PostgreSQL 16 Alpine, interna siet `dokploy-network:5432`)
  - `openvpm-arena-postgres-ygh6nf` (Arena Clone DB, verejny port `5434`)
  - `compose-parse-online-port-wdunfq-minio-1` (MinIO S3 storage)
  - `compose-parse-online-port-wdunfq-db-init-1` (Drizzle bootstrap + RLS + Slovak seed)

---

## 3. Spravna praca s ENV premennymi (KRITICKE)

### Preco sa env premenne strácajú pri redeploy

Dokploy spravuje `.env` na serveri **zo svojej vlastnej databazy**. Pri kazdom deploy webhookU Dokploy prepise `.env` hodnotami, ktore ma ulozene vo svojej DB. Premenne, ktore neboli pridane cez Dokploy UI alebo CLI, sa stratia.

**Jediny spravny sposob spravy env premennych: `dokploy env push`.**

### Ground truth: `.env.production.local`

Lokalne uloz vsetky produkčné premenne do suboru `.env.production.local` (je v `.gitignore`, nikdy ho necommit).

Tento subor je **jediny zdroj pravdy** pre produkčné env premenne. Vzdy ho udrzuj aktualizovany.

### Dokploy API token — kde ho najst a ako ho ulozit

1. **Vytvorenie tokenu:** Otvor `https://dev.significa.sk/dashboard/settings/profile` → sekcia **Access Tokens** → klikni **Generate**.
2. **Ulozenie tokenu:** Pridaj do lokalneho `.env` (nie `.env.production.local`):
   ```
   DOKPLOY_TOKEN=tvoj_token_tu
   ```
3. **Autentifikácia CLI:**
   ```bash
   dokploy auth -u https://dev.significa.sk -t $DOKPLOY_TOKEN
   ```
4. **REST API:** pouzij header `x-api-key: $DOKPLOY_TOKEN` v kazdom API volani.

### Workflow: Pridanie novej env premennej

```
1. Pridaj kluc a hodnotu do .env.production.local
2. Pushni do Dokploy: dokploy env push .env.production.local
3. Commitni kod (bez .env.production.local!) a spusti deploy
```

### Uzitoné CLI prikazy

```bash
# Inštalacia CLI (ak este nemas)
npm install -g @dokploy/cli

# Autentifikacia
dokploy auth -u https://dev.significa.sk -t $DOKPLOY_TOKEN

# Stiahni aktualne premenne z Dokploy (napr. po strate lokalneho suboru)
dokploy env pull .env.production.local

# Pushni lokalne premenne do Dokploy (toto prezi kazdy redeploy)
dokploy env push .env.production.local

# Overenie
dokploy verify
```

### REST API ekvivalent k `dokploy env push`

```bash
# Precitaj .env.production.local a posli cez API
$envContent = Get-Content .env.production.local -Raw
Invoke-RestMethod -Uri "https://dev.significa.sk/api/compose.update" `
    -Method Post `
    -Headers @{"x-api-key" = $env:DOKPLOY_TOKEN; "Content-Type" = "application/json"} `
    -Body (ConvertTo-Json @{composeId = "pvdhIxlCIhYTKvnmrZ8Mk"; env = $envContent})
```

---

## 4. Automatizovany postup agenta (Execution Workflow)

Skript: `.agents/skills/deploy/scripts/deploy.ps1`

```powershell
# Standardny deploy
powershell -File .agents/skills/deploy/scripts/deploy.ps1

# So schema zmenami (spusti db-init kontajner)
powershell -File .agents/skills/deploy/scripts/deploy.ps1 -RunDbInit

# Preskoc typcheck (rychly hotfix)
powershell -File .agents/skills/deploy/scripts/deploy.ps1 -SkipTypeCheck
```

### Faza 0: ENV premenne (NOVA FAZA)

1. Overenie existencie `.env.production.local`
2. Kontrola kriticke klucov (DATABASE_URL, NEXTAUTH_SECRET, RESEND_API_KEY, ...)
3. Pripomenutie: ak boli env premenne zmenene, treba najprv spustit `dokploy env push`

### Faza 1: Lokalne Pre-flight kontroly

1. Git status — ziadne necommitute zmeny
2. i18n symetria — `node .agents/skills/deploy/scripts/check-i18n.js`
3. TypeScript type-check — `pnpm --filter @openpims/web type-check`

### Faza 2: Git Push & Dokploy Deploy

1. `git push origin main`
2. POST na Dokploy Webhook `$DOKPLOY_DEPLOY_WEBHOOK_URL`
3. SSH fallback ak webhook zlyha

> **Zmena schematu / migracii:** Ak commit obsahuje zmeny v `packages/db/schema/`, pridaj `-RunDbInit` flag.

### Faza 3: Post-Deploy Smoke Testy

1. HTTP dostupnost — `curl -kIv https://vet.dev.significa.sk`
2. Health check — `curl -s https://vet.dev.significa.sk/api/health` (ocakava `{"ok":true,"checks":{"database":{"ok":true}}}`)
3. Container logy — `ssh root@dev.significa.sk "docker logs compose-parse-online-port-wdunfq-web-1 --tail=40"`

### Faza 4: Sprava pre pouzivatela

Agent oznamı: commit hash, stav kontajnerov, vysledok smoke testov.

---

## 5. Okamzita oprava stratených env premennych (Incident Recovery)

Ak sa env premenne stratili pri redeploy:

```bash
# Krok 1: Autentifikuj sa (ak este nie si)
dokploy auth -u https://dev.significa.sk -t $DOKPLOY_TOKEN

# Krok 2: Pushni lokalne premenne do Dokploy
dokploy env push .env.production.local

# Krok 3: Triggeruj redeploy (teraz Dokploy pouzije spravne premenne)
curl -X POST "https://dev.significa.sk/api/deploy/compose/KCp595z_p95jTHcBzoHyQ"

# Alebo cez powershell
Invoke-RestMethod -Uri "https://dev.significa.sk/api/deploy/compose/KCp595z_p95jTHcBzoHyQ" -Method Post
```

Ak nemas `.env.production.local`, stiahni to co Dokploy aktualne ma:
```bash
dokploy env pull .env.production.local
# Potom manualne doplnenie chybajucich premennych
```

---

## 6. Rollback

```bash
# Aktualne logy a git historia na serveri
ssh root@dev.significa.sk "cd /etc/dokploy/compose/compose-parse-online-port-wdunfq/code/ && git log -n 3 --oneline"
```

Alebo v Dokploy UI: **Deployments → Rollback** na predchadzajuci build.

---

## 7. Troubleshooting

### A. Schema Drift / Missing RLS (`/api/health` 503)
```powershell
Get-Content packages/db/rls/enable-rls.sql -Raw | ssh root@dev.significa.sk "docker exec -i compose-parse-online-port-wdunfq-postgres-1 psql -U openpims -d openpims"
```

### B. Zlyhanie desifrovania klucov (`Failed to decrypt AI API key`)
Kluce boli zasifrovane lokalnym tajomstvom. Treba ich nanovo zasifrovaf s produkčnym `NEXTAUTH_SECRET` alebo vymazat v `ext_ai_settings`.

### C. Zaseknuty build v Dokploy UI
```bash
ssh root@dev.significa.sk "ls -lt /etc/dokploy/logs/compose-parse-online-port-wdunfq/ | head -n 3"
ssh root@dev.significa.sk "tail -n 50 /etc/dokploy/logs/compose-parse-online-port-wdunfq/<posledny-log>"
```

### D. Manuálny emergency SSH build (bez Dokploy UI)
```bash
ssh root@dev.significa.sk "cd /etc/dokploy/compose/compose-parse-online-port-wdunfq/code/ && docker compose build --no-cache web && docker compose up -d --remove-orphans web"
```

