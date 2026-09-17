---
name: deploy
description: Safe, one-click deployment of the latest remote main branch to Dokploy on dev.significa.sk for OpenVPM AI. Triggers on "deploy", "deployni", "nasad", "deploy main", "dokploy deploy", "nasad na dev.significa.sk". Runs pre-flight checks (git status, i18n symmetry, type-check), verifies git push to origin/main, triggers build & rollout on dev.significa.sk, and runs smoke tests.
---

# Deploy Skill — OpenVPM AI na server dev.significa.sk

Tento skill riadi bezpečný, reprodukovateľný a overený deployment najnovšej vetvy `main` aplikácie **OpenVPM AI** z lokálneho prostredia na server **`dev.significa.sk`** do existujúcej Dokploy Compose aplikácie **`openvpm-ai`**.

---

## 1. Kedy sa tento skill aktivuje

Aktivuje sa vždy, keď používateľ požiada o nasadenie:
- `deploy` / `deployni to`
- `nasad na server` / `nasad na dev.significa.sk`
- `deploy main` / `deploy latest remote main`
- `dokploy deploy`

---

## 2. Architektúra a serverové parametre

- **Server & SSH:** `root@dev.significa.sk`
- **Verejná doména:** `https://vet.dev.significa.sk`
- **Dokploy Project ID:** `DcWUBuOSe4H0UfF-OpLPb` (OpenVPM AI)
- **Dokploy Environment ID:** `dgpMIXk6UxZf_nS2fH3xU` (production)
- **Dokploy Compose App ID:** `pvdhIxlCIhYTKvnmrZ8Mk` (`openvpm-ai`)
- **Interný appName na disku:** `compose-parse-online-port-wdunfq`
- **Cesta ku kódu na serveri:** `/etc/dokploy/compose/compose-parse-online-port-wdunfq/code/`
- **Kľúčové kontajnery a služby:**
  - `compose-parse-online-port-wdunfq-web-1` (Next.js 15 standalone app, port 3000)
  - `openvpm-postgres-cfoqxx` (Dokploy Standalone Database Service, PostgreSQL 16 Alpine, interná sieť `dokploy-network:5432`)
  - `openvpm-arena-postgres-ygh6nf` (Dokploy Standalone Arena Clone DB, verejný port `dev.significa.sk:5434`)
  - `compose-parse-online-port-wdunfq-minio-1` (MinIO S3 storage, volume `minio_data`)
  - `compose-parse-online-port-wdunfq-db-init-1` (Drizzle bootstrap, RLS & Slovak seed)

---

## 3. Automatizovaný postup agenta (Execution Workflow)

Keď používateľ zadá požiadavku na deploy, agent postupuje cez nasledujúce 4 fázy:

### Fáza 1: Lokálne Pre-flight kontroly (Pred odoslaním na server)

1. **Kontrola čistoty gitu a secretov:**
   ```bash
   git status
   ```
   - Ak existujú nezastagované zmeny, agent ich zanalyzuje.
   - Uistí sa, že sa necommituje žiadny `.env`, API kľúče (`sk_`, `pk_`), heslá ani privátne kľúče.
   - Ak sú pripravené zmeny v kóde, commitne ich a pushne:
     ```bash
     git push origin main
     ```
2. **Kontrola symetrie lokalizácie (i18n 100% Symmetry):**
   ```bash
   node -e "const en=require('./apps/web/messages/en.json'); const sk=require('./apps/web/messages/sk.json'); function keys(o,p=''){return Object.keys(o).flatMap(k=>{const path=p?p+'.'+k:k;return(typeof o[k]==='object'&&o[k]!==null)?keys(o[k],path):[path];});} const kEn=keys(en),kSk=keys(sk),sEn=new Set(kEn),sSk=new Set(kSk); const missing=kEn.filter(k=>!sSk.has(k)),extra=kSk.filter(k=>!sEn.has(k)); if(missing.length||extra.length){console.error('i18n asymmetry detected!',{missing,extra});process.exit(1);}else{console.log('✓ i18n 100% symmetric ('+kEn.length+' keys)');}"
   ```
3. **Overenie kompilácie (TypeScript check):**
   ```bash
   pnpm --filter @openpims/web type-check
   ```
   *Ak type-check zlyhá, deploy sa ZASTAVÍ a chyby sa nahlásia.*

---

### Fáza 2: Spustenie deploymentu na dev.significa.sk

Deployment je možné spustiť dvoma spôsobmi:

#### Metóda A: Cez oficiálny Dokploy Webhook (Odporúčaná — zobrazí build v Dokploy UI)
Tento endpoint zaradí build do fronty Dokployu, zobrazí live logy v UI pod **Deployments** a prebuduje kontajnery:

```bash
# Webhook URL načítava skript deploy.ps1 z .env (DOKPLOY_DEPLOY_WEBHOOK_URL)
powershell -File .agents/skills/deploy/scripts/deploy.ps1
```
Alebo priamo cez curl:
```bash
curl -X POST "${DOKPLOY_DEPLOY_WEBHOOK_URL}"
```

#### Metóda B: Manuálny núdzový postup cez SSH
Ak je potrebné vykonať build priamo bez Dokploy UI:
```bash
ssh root@dev.significa.sk "cd /etc/dokploy/compose/compose-parse-online-port-wdunfq/code/ && docker compose build --no-cache web && docker compose up -d --remove-orphans web"
```

> [!NOTE]
> **Zmena schémy / migrácií databázy:**  
> Ak nasadzovaný commit obsahuje zmeny v schéme databázy (`packages/db/schema/` alebo `seed-sk.ts`), pred reštartom webu sa spustí inicializačný kontajner:
> ```bash
> ssh root@dev.significa.sk "cd /etc/dokploy/compose/compose-parse-online-port-wdunfq/code/ && docker compose run --rm db-init"
> ```


---

### Fáza 3: Post-Deploy Verifikácia (Smoke Testy)

Hneď po reštarte kontajnera agent automaticky overí funkčnosť:

1. **HTTP dostupnosť domény a TLS:**
   ```bash
   curl -kIv https://vet.dev.significa.sk
   ```
   *Očakávaný stav:* HTTP `307 Temporary Redirect` (na `/login`) alebo HTTP `200 OK`.

2. **Systémový Health Check:**
   ```bash
   curl -s https://vet.dev.significa.sk/api/health
   ```
   *Overenie:* Databázový ping v poriadku, schémy v stave bez nežiaduceho driftu.

3. **Kontrola logov nového kontajnera:**
   ```bash
   ssh root@dev.significa.sk "docker logs compose-parse-online-port-wdunfq-web-1 --tail=40"
   ```
   *Overenie:* Žiadne `UnhandledPromiseRejection`, žiadne fatálne chyby pri štarte Next.js.

---

### Fáza 4: Správa pre používateľa

Agent používateľovi oznámi:
- Commit hash a správu commitu, ktorý bol nasadený z vetvy `main`.
- Stav kontajnerov (`web`, `postgres`, `minio`).
- Výsledok smoke testu na doméne `https://vet.dev.significa.sk`.
- Čas trvania buildu a pripravenosť systému na testovanie.

---

## 4. Núdzový Rollback

V prípade fatálnej chyby po deployi agent okamžite ponúkne alebo vykoná návrat na predchádzajúci stabilný stav:

```bash
# Návrat na predchádzajúci git commit na serveri
ssh root@dev.significa.sk "cd /etc/dokploy/compose/compose-parse-online-port-wdunfq/code/ && git log -n 3 --oneline"
```
Pre prebudovanie staršieho commitu stačí zmeniť tag alebo prepnúť context na konkrétny commit hash a spustiť:
```bash
docker compose build web && docker compose up -d web
```
Alebo v Dokploy UI kliknúť na **Deployments** -> **Rollback**.

---

## 5. Riešenie bežných problémov (Troubleshooting)

### A. Schema Drift / Missing RLS Policies (`/api/health` 503)
Ak `/api/health` hlási chýbajúce RLS politiky (napr. `29 critical controls missing`):
```powershell
Get-Content packages/db/rls/enable-rls.sql -Raw | ssh root@dev.significa.sk "docker exec -i compose-parse-online-port-wdunfq-postgres-1 psql -U openpims -d openpims"
```

### B. Zlyhanie dešifrovania kľúčov (`Failed to decrypt AI API key`)
Ak po obnovení databázy padá stránka AI nastavení, databáza obsahuje kľúče zašifrované lokálnym tajomstvom. Je potrebné ich nanovo prešifrovať na serveri s použitím produkčného `NEXTAUTH_SECRET` alebo vymazať v `ext_ai_settings`, aby ich používateľ zadal znova.

### C. Zaseknutý build v Dokploy UI
Overenie aktuálnych logov buildu na serveri:
```bash
ssh root@dev.significa.sk "ls -lt /etc/dokploy/logs/compose-parse-online-port-wdunfq/ | head -n 3"
ssh root@dev.significa.sk "tail -n 50 /etc/dokploy/logs/compose-parse-online-port-wdunfq/<posledny-log>"
```
V prípade potreby spustiť manuálny núdzový build podľa Metódy B vyššie.

