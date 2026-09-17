# OpenVPM AI — Dokploy Deployment Runbook & SOP
**Cieľový server:** `dev.significa.sk` (SSH: `root@dev.significa.sk`)  
**Verejná URL:** [https://vet.dev.significa.sk](https://vet.dev.significa.sk)  
**Dokploy Project ID:** `DcWUBuOSe4H0UfF-OpLPb` (OpenVPM AI)  
**Dokploy Environment ID:** `dgpMIXk6UxZf_nS2fH3xU` (production)  
**Dokploy Compose App ID:** `pvdhIxlCIhYTKvnmrZ8Mk` (`openvpm-ai`)  
**Interný názov na disku servera:** `compose-parse-online-port-wdunfq`  
**Cesta ku kódu na serveri:** `/etc/dokploy/compose/compose-parse-online-port-wdunfq/code/`  

---

## Prehľad architektúry služieb (Multi-Container Compose)

| Služba | Kontajner | Obraz / Base | Porty (interné / Traefik) | Účel |
| :--- | :--- | :--- | :--- | :--- |
| **`postgres`** | `compose-parse-online-port-wdunfq-postgres-1` | `postgres:16-alpine` | `5432` (interná sieť) | PostgreSQL databáza, volume `postgres_data` |
| **`minio`** | `compose-parse-online-port-wdunfq-minio-1` | `quay.io/minio/minio:latest` | `9000` (API), `9001` (Console) | S3-kompatibilné privátne úložisko, volume `minio_data` |
| **`minio-bootstrap`**| `compose-parse-online-port-wdunfq-minio-bootstrap-1` | `minio/mc:latest` | jednorazový (exit 0) | Inicializácia bucketu `openpims` a nastavenie aliasov |
| **`db-init`** | `compose-parse-online-port-wdunfq-db-init-1` | multi-stage `builder` (`apps/web/Dockerfile`) | jednorazový (exit 0) | Spustenie `db:bootstrap` (drizzle schémy/triggery) a `db:seed:sk` (klinické demo dáta) |
| **`web`** | `compose-parse-online-port-wdunfq-web-1` | multi-stage `runner` (`apps/web/Dockerfile`) | `3000` (Traefik proxy) | Next.js 15 standalone produkčný server |

Traefik reverse proxy v Dokploy počúva na externej sieti **`dokploy-network`** a automaticky spravuje Let's Encrypt TLS certifikáty pre doménu `vet.dev.significa.sk`.

---

## Fáza 1: Príprava lokálneho prostredia pred nasadením

Pred každým deploymentom je nevyhnutné overiť integritu repozitára, dodržanie architektonických pravidiel a absenciu uniknutých tajomstiev.

### 1.1 Kontrola čistoty gitu a rozpracovaných zmien
Spusti v koreňovom adresári repozitára (`openvpm-ai`):

```bash
git status
```

Ak máš neuložené zmeny v `apps/web/server/routers/extensions/ai-settings.ts` alebo `apps/web/lib/ai/ai-presets.ts`:
1. Skontroluj diff:
   ```bash
   git diff
   ```
2. Skontroluj, či sa do commitu nedostal `.env`, žiadny API kľúč, token alebo heslo:
   ```bash
   # Pravidlo: Nikdy necommituj .env, kľúče začínajúce na sk_, tokeny ani heslá!
   git diff --staged | grep -E "(sk_|pk_|key-|Bearer|password=)"
   ```
3. Zastaguj overené zmeny a vytvor zmysluplný commit:
   ```bash
   git add apps/web/server/routers/extensions/ai-settings.ts apps/web/lib/ai/ai-presets.ts
   git commit -m "feat(ai): configure model presets and feature mappings"
   ```

### 1.2 Overenie symetrie lokalizácie (i18n 100% Symmetry)
Pravidlo projektu vyžaduje 100% zhodu kľúčov medzi `messages/en.json` a `messages/sk.json`:

```bash
node -e "const en=require('./apps/web/messages/en.json'); const sk=require('./apps/web/messages/sk.json'); function keys(o,p=''){return Object.keys(o).flatMap(k=>{const path=p?p+'.'+k:k;return(typeof o[k]==='object'&&o[k]!==null)?keys(o[k],path):[path];});} const kEn=keys(en),kSk=keys(sk),sEn=new Set(kEn),sSk=new Set(kSk); const missing=kEn.filter(k=>!sSk.has(k)),extra=kSk.filter(k=>!sEn.has(k)); if(missing.length||extra.length){console.error('i18n asymmetry detected!',{missing,extra});process.exit(1);}else{console.log('✓ i18n 100% symmetric ('+kEn.length+' keys)');}"
```
*Očakávaný výstup: `✓ i18n 100% symmetric (6378 keys)`*

### 1.3 TypeScript Type Check
Over, že webová aplikácia kompiluje bez chýb:

```bash
pnpm --filter @openpims/web type-check
```
*Očakávaný výstup: Exit code 0 bez chýb.*

### 1.4 Odoslanie zmien na GitHub
```bash
git push origin main
```

---

## Fáza 2: Synchronizácia a správa premenných (.env)

Dokploy spravuje environment premenné centrálne vo svojej databáze a pri každom builde/deployi generuje `.env` súbor do cieľového priečinka aplikácie.

> [!IMPORTANT]
> **Pravidlo perzistencie v Dokploy:**  
> Premenné prostredia **vždy zadávaj primárne cez webové rozhranie Dokploy** (alebo cez Dokploy API). Ak by si ich upravil len manuálne cez SSH v súbore `.env`, Dokploy ich pri najbližšom automatickom deployi prepíše svojím stavom z UI databázy!

### 2.1 Zoznam povinných produkčných premenných pre server `dev.significa.sk`

Skopíruj a prispôsob si nasledujúci blok premenných pre Dokploy:

```env
# ==============================================================================
# OPENVPM AI — PRODUKČNÁ KONFIGURÁCIA (dev.significa.sk)
# ==============================================================================

# Node / Next.js Runtime
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
NEXT_TELEMETRY_DISABLED=1

# Verejné URL adresy
NEXTAUTH_URL="https://vet.dev.significa.sk"
NEXT_PUBLIC_APP_URL="https://vet.dev.significa.sk"

# NextAuth autentifikačné tajomstvo (vygeneruj: openssl rand -base64 32)
NEXTAUTH_SECRET="VygenerujSilneNahodneTazkeHesloCezOpenssl32Znakov"

# PostgreSQL Databáza (spojenie v rámci internej Docker siete)
POSTGRES_USER=openpims
POSTGRES_PASSWORD=ZadajSilneHesloPrePostgresKliniky
POSTGRES_DB=openpims
DATABASE_URL="postgresql://openpims:ZadajSilneHesloPrePostgresKliniky@postgres:5432/openpims"

# MinIO / S3 Privátne úložisko (fotky pacientov, RTG snímky, laboratórne nálezy)
FILE_STORAGE_PROVIDER=s3
S3_ENDPOINT="http://minio:9000"
S3_ACCESS_KEY="openpims-minio-admin"
S3_SECRET_KEY="VygenerujSilnyMinioSecretKluc123"
S3_BUCKET="openpims"
S3_REGION="us-east-1"

# AI Integrácia (OpenRouter / Gemini 2.5)
OPENROUTER_API_KEY="sk-or-v1-tvoj-openrouter-api-kluc"
AI_API_KEY="sk-or-v1-tvoj-openrouter-api-kluc"
AI_BASE_URL="https://openrouter.ai/api/v1"
AI_MODEL="google/gemini-2.5-flash"

# Voliteľné: e-Kasa (pre dev prostredie ponechané offline)
EKASA_FISCALIZATION_ENABLED=false
```

### 2.2 Postup zápisu v Dokploy UI
1. Otvor Dokploy v prehliadači (napr. `https://dokploy.significa.sk` alebo príslušný port administrácie).
2. Prejdi do projektu **OpenVPM AI** (`DcWUBuOSe4H0UfF-OpLPb`).
3. Zvoľ prostredie **production** (`dgpMIXk6UxZf_nS2fH3xU`).
4. Klikni na Compose aplikáciu **openvpm-ai** (`pvdhIxlCIhYTKvnmrZ8Mk`).
5. Otvor záložku **Environment**.
6. Vlož vyššie uvedené premenné a klikni na tlačidlo **Save** (Uložiť).

### 2.3 Kontrola a záloha .env cez SSH (Voliteľné / Overenie)
Pripoj sa na server:
```bash
ssh root@dev.significa.sk
```
Over obsah súboru na disku:
```bash
cat /etc/dokploy/compose/compose-parse-online-port-wdunfq/code/.env
```

---

## Fáza 3: Spustenie buildu a nasadenia

### 3.1 Produkčný Docker Compose predpis (`docker-compose.dokploy.yml`)

Uisti sa, že v Dokploy (záložka **General** -> **Compose Path** alebo **Raw Docker Compose**) je nastavená nasledujúca špecifikácia:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-openpims}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-openpims}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-openpims} -d ${POSTGRES_DB:-openpims}"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - internal

  minio:
    image: quay.io/minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY}
    volumes:
      - minio_data:/data
    networks:
      - internal

  minio-bootstrap:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_started
    entrypoint: >
      /bin/sh -c "
      until mc alias set local http://minio:9000 $${S3_ACCESS_KEY} $${S3_SECRET_KEY}; do
        sleep 1;
      done;
      mc mb --ignore-existing local/$${S3_BUCKET:-openpims};
      mc anonymous set download local/$${S3_BUCKET:-openpims} || true;
      exit 0;
      "
    networks:
      - internal

  db-init:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      target: builder
    restart: "no"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      OPENPIMS_APP_DB_PASSWORD: ${POSTGRES_PASSWORD}
    depends_on:
      postgres:
        condition: service_healthy
    command: >
      sh -c "
        echo '==> [1/2] Beží Drizzle DB Bootstrap a registrácia schém...' &&
        pnpm --filter @openpims/db db:bootstrap &&
        echo '==> [2/2] Nasadzovanie slovenských klinických demo dát...' &&
        pnpm --filter @openpims/db db:seed:sk &&
        echo '==> Databáza úspešne pripravená.'
      "
    networks:
      - internal

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      target: runner
    restart: unless-stopped
    depends_on:
      db-init:
        condition: service_completed_successfully
      minio-bootstrap:
        condition: service_completed_successfully
    environment:
      NODE_ENV: production
      PORT: 3000
      HOSTNAME: "0.0.0.0"
      DATABASE_URL: ${DATABASE_URL}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL}
      FILE_STORAGE_PROVIDER: s3
      S3_ENDPOINT: ${S3_ENDPOINT}
      S3_ACCESS_KEY: ${S3_ACCESS_KEY}
      S3_SECRET_KEY: ${S3_SECRET_KEY}
      S3_BUCKET: ${S3_BUCKET}
      S3_REGION: ${S3_REGION:-us-east-1}
      AI_BASE_URL: ${AI_BASE_URL}
      AI_API_KEY: ${AI_API_KEY}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      AI_MODEL: ${AI_MODEL:-google/gemini-2.5-flash}
    networks:
      - internal
      - dokploy-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.openvpm-web.rule=Host(`vet.dev.significa.sk`)"
      - "traefik.http.routers.openvpm-web.entrypoints=websecure"
      - "traefik.http.routers.openvpm-web.tls=true"
      - "traefik.http.routers.openvpm-web.tls.certresolver=letsencrypt"
      - "traefik.http.services.openvpm-web.loadbalancer.server.port=3000"

networks:
  internal:
    driver: bridge
  dokploy-network:
    external: true

volumes:
  postgres_data:
  minio_data:
```

---

### 3.2 Spustenie nasadenia cez Dokploy UI

1. V Dokploy aplikácii **openvpm-ai** klikni vpravo hore na tlačidlo **Deploy**.
2. Prejdi na záložku **Deployments** a klikni na najnovší bežiaci záznam.
3. Sleduj build log:
   - Klonovanie / pull repozitára `badmarsh/openvpm-ai` (vetva `main`).
   - Multi-stage Docker build (`deps` -> `builder` -> `runner`).
   - Štart databázy `postgres` a overenie healthchecku.
   - Spustenie `db-init` (`pnpm db:bootstrap` a `pnpm db:seed:sk`).
   - Štart produkčného kontajnera `web` a jeho zaregistrovanie do Traefika.

---

### 3.3 Alternatívny manuálny núdzový postup cez SSH

Ak potrebuješ spustiť deployment ručne na serveri (napr. pri výpadku Dokploy UI alebo ladení):

```bash
# 1. Prihlásenie na server
ssh root@dev.significa.sk

# 2. Presun do projektového adresára
cd /etc/dokploy/compose/compose-parse-online-port-wdunfq/code/

# 3. Aktualizácia kódu z gitu
git fetch origin main
git reset --hard origin/main

# 4. Overenie, že existuje sieť dokploy-network
docker network inspect dokploy-network >/dev/null 2>&1 || docker network create dokploy-network

# 5. Build nových obrazov (Next.js standalone aplikácie a db-init)
docker compose build --no-cache web db-init

# 6. Spustenie infraštruktúrnych služieb a inicializácia databázy
docker compose up -d postgres minio
docker compose up minio-bootstrap
docker compose up db-init

# 7. Štart a plynulý swap webovej aplikácie
docker compose up -d --remove-orphans web

# 8. Kontrola stavu kontajnerov
docker compose ps
```

---

## Fáza 4: Verifikácia a Smoke testy (Overenie funkčnosti)

Po úspešnom ukončení nasadenia vykonaj kontrolné testy:

### 4.1 Test dostupnosti verejnej domény a TLS certifikátu
Spusti lokálne alebo priamo zo servera:

```bash
curl -kIv https://vet.dev.significa.sk
```
*Očakávaný výsledok:*
- TLS handshake overený certifikátom Let's Encrypt.
- HTTP status `307 Temporary Redirect` na `/login` alebo HTTP `200 OK`.

### 4.2 Test systémového Health Endpointu
Zavolaj diagnostický endpoint:

```bash
curl -s https://vet.dev.significa.sk/api/health | jq .
```
*Očakávaný výsledok:*
- `status: "healthy"` alebo `"degraded"` (ak je voliteľná e-kasa v offline móde).
- Potvrdenie pripojenia k Postgres databáze a MinIO storage.

### 4.3 Test prihlásenia používateľov
Otvor v prehliadači: **`https://vet.dev.significa.sk/login`**

| Úloha | Email | Predvolené heslo zo seedu | Čo overiť po prihlásení |
| :--- | :--- | :--- | :--- |
| **Správca kliniky (Admin)** | `admin@vetsykora.sk` | `password123` | Prístup do nastavení kliniky, správa používateľov, AI konfigurácia |
| **Ošetrujúci veterinár** | `veterinar@vetsykora.sk` *(alebo `zuzana.horvathova@vetsykora.sk`)* | `password123` | Zoznam pacientov, založenie nového SOAP vyšetrenia, recepty |
| **Recepcia / Pokladňa** | `recepcia@vetsykora.sk` | `password123` | Kalendár termínov, príjem klienta, pokladničné doklady |

> [!CAUTION]
> **Bezpečnostné upozornenie:**  
> Heslo `password123` je určené výhradne na inicializáciu testovacieho a pilotného prostredia. Po prvom prihlásení administrátora ihneď zmeň heslá kľúčových účtov!

### 4.4 Kontrola behu a logov webového kontajnera
Pripoj sa cez SSH a sleduj logy produkčného kontajnera v reálnom čase:

```bash
docker logs -f compose-parse-online-port-wdunfq-web-1 --tail=100
```
*Čo sledovať:*
- Hláška Next.js: `Ready in ...ms` / `Listening on port 3000`.
- Žiadne chyby týkajúce sa `Missing NEXTAUTH_SECRET` alebo `Database connection timeout`.
- Žiadne chyby hydratácie SSR (React 19).

### 4.5 Test MinIO úložiska (Nahratie prílohy / RTG)
1. Prihlás sa ako veterinár (`veterinar@vetsykora.sk`).
2. Otvor kartu ľubovoľného pacienta (napr. *Bono — Pes, Nemecký ovčiak*).
3. Prejdi na záložku **Dokumenty / Prílohy** a nahraj testovací obrázok alebo PDF.
4. Over, že sa náhľad súboru zobrazuje korektne a URL smeruje na interný úložný subsystém.
5. Overenie na serveri cez MinIO CLI:
   ```bash
   docker exec -it compose-parse-online-port-wdunfq-minio-bootstrap-1 mc ls local/openpims
   ```

### 4.6 Test AI Modulu (OpenRouter & Gemini)
1. V aplikácii otvor modul **AI Asistent** (`/agent`) alebo otvor existujúce vyšetrenie (Encounter) a klikni na **Generovať SOAP / Plán ošetrenia**.
2. Zadaj klinickú anamnézu: *"Pes, 3 roky, zvracanie 2 dni, apatia, afebrilný."*
3. Over, že AI asistent vráti štruktúrovaný návrh vyšetrenia a diferenciálnu diagnostiku v slovenčine.
4. Skontroluj, že v logoch webového kontajnera nie sú chyby `401 Unauthorized` z OpenRouter API.

---

## Fáza 5: Rollback stratégia a riešenie problémov (Troubleshooting)

### 5.1 Čo robiť, ak `db-init` zlyhá na migráciách alebo seede
Ak kontajner `db-init` skončí s chybou `exit 1`, kontajner `web` sa nespustí (podmienka `service_completed_successfully`).

**Postup diagnostiky:**
```bash
docker logs compose-parse-online-port-wdunfq-db-init-1
```

**Najčastejšie príčiny a riešenia:**
1. **Databáza Postgres ešte nebola pripravená:**
   - Skontroluj healthcheck databázy:
     ```bash
     docker inspect --format='{{json .State.Health.Status}}' compose-parse-online-port-wdunfq-postgres-1
     ```
   - Malo by vrátiť `"healthy"`. Ak nie, over logy databázy:
     ```bash
     docker logs compose-parse-online-port-wdunfq-postgres-1
     ```
2. **Chyba unikátnych kľúčov v Drizzle migráciách:**
   - Spusti bootstrap manuálne s podrobným výpisom:
     ```bash
     docker compose run --rm db-init pnpm --filter @openpims/db db:bootstrap
     ```
3. **Manuálne opätovné nasadenie slovenského seedu:**
   ```bash
   docker compose run --rm db-init pnpm --filter @openpims/db db:seed:sk
   ```

---

### 5.2 Okamžitý návrat (Rollback) pri fatálnej chybe

#### Možnosť A: Rollback v Dokploy UI
1. V Dokploy otvor aplikáciu **openvpm-ai** -> záložka **Deployments**.
2. Vyhľadaj predchádzajúci úspešný deployment.
3. Klikni na **Redeploy** / **Rollback** danej verzie.

#### Možnosť B: Git Rollback cez SSH
```bash
cd /etc/dokploy/compose/compose-parse-online-port-wdunfq/code/

# Zobrazenie histórie posledných commitov
git log --oneline -n 5

# Návrat na predchádzajúci stabilný commit (nahraď HASH konkrétnym hash-om)
git reset --hard <STABLE_COMMIT_HASH>

# Znovuspustenie buildu
docker compose build web
docker compose up -d web
```

---

### 5.3 Užitočné SSH príkazy pre rýchlu diagnostiku

```bash
# 1. Rýchly prehľad stavu všetkých kontajnerov v projekte
docker compose -f /etc/dokploy/compose/compose-parse-online-port-wdunfq/code/docker-compose.yml ps

# 2. Živé sledovanie logov webovej aplikácie
docker logs -f --tail=100 compose-parse-online-port-wdunfq-web-1

# 3. Priamy vstup do PostgreSQL databázy
docker exec -it compose-parse-online-port-wdunfq-postgres-1 psql -U openpims -d openpims

# 4. Rýchle overenie počtu zaevidovaných používateľov a pacientov v DB
docker exec -i compose-parse-online-port-wdunfq-postgres-1 psql -U openpims -d openpims -c "SELECT email, role, name FROM users;"
docker exec -i compose-parse-online-port-wdunfq-postgres-1 psql -U openpims -d openpims -c "SELECT count(*) AS total_patients FROM patients;"

# 5. Kontrola stavu a zaplnenia MinIO disku
docker exec -it compose-parse-online-port-wdunfq-minio-1 df -h /data

# 6. Kontrola systémových prostriedkov (RAM, CPU)
docker stats --no-stream
```

---

*Dokumentácia bola overená pre verziu OpenVPM AI s Next.js 15, Drizzle ORM, Docker Compose a Dokploy na serveri `dev.significa.sk`.*
