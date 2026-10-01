# Dokploy Deploy Audit — OpenVPM AI

## Kontext

Máme produkčný deployment OpenVPM AI na `dev.significa.sk` cez Dokploy. Nedávno sme objavili kritický problém: **každý deploy webhook prepíše `.env` na serveri a zmaže ručne pridané premenné** (RESEND_API_KEY, RESEND_WEBHOOK_SECRET a 107 ďalších). Je to preto, lebo Dokploy spravuje `.env` z vlastnej databázy — premenné, ktoré tam nie sú uložené, sa stratia pri každom redeploy.

---

## Krok 1: Nastuduj Dokploy dokumentáciu

Použi **Firecrawl** (self-hosted) a **Exa** na dôkladné preštudovanie Dokploy dokumentácie.

### Firecrawl

API endpoint: `https://firecrawl.dev.significa.sk`
API key: `fc-fa48894f60cc45c0bdbc8db30c459b3f`

Scrapeuj tieto URL pomocou `POST /v1/scrape` s `"formats": ["markdown"]`:

1. `https://docs.dokploy.com/docs/core`
2. `https://docs.dokploy.com/docs/core/environment-variables`
3. `https://docs.dokploy.com/docs/core/docker-compose/overview`
4. `https://docs.dokploy.com/docs/core/deployments/webhook`
5. `https://docs.dokploy.com/docs/api/`

### Exa

API key: `0a78f669-357e-434f-a23a-521e9fccf5d4`
Endpoint: `POST https://api.exa.ai/search` s `"useAutoprompt": true, "numResults": 5, "contents": {"text": true}`

Vyhľadaj:
- `"Dokploy compose environment variables persist redeploy"`
- `"Dokploy CLI env push pull tutorial"`
- `"Dokploy API token generate settings"`
- `"Dokploy self-hosted env variables overwritten on deploy"`

---

## Krok 2: Nastuduj Dokploy API a CLI

### Dokploy REST API

Dokploy má REST API na `https://dev.significa.sk/api`. Endpoint na update env premenných pre Compose aplikáciu je pravdepodobne niečo ako:
```
POST /api/compose.update
Body: { composeId: "pvdhIxlCIhYTKvnmrZ8Mk", env: "KEY=value\nKEY2=value2" }
```

**API Token** — KĽÚČOVÝ DETAIL:
- Dokploy API token sa vytvára v Dokploy UI pod **Settings → API → Generate Token**
- URL: `https://dev.significa.sk/settings` (záložka API alebo Tokens)
- Bez tohto tokenu nefunguje ani CLI ani REST API volania
- Token je potrebné uložiť do lokálneho `.env` ako `DOKPLOY_TOKEN=...`
- V audite musí byť jasný návod kde token nájsť a ako ho uložiť

### Dokploy CLI

Na serveri (`dev.significa.sk`) je nainštalovaný Dokploy CLI v0.2.8 na `/usr/local/bin/dokploy`.

CLI vie:
```bash
# Autentifikácia (token z Dokploy UI → Settings → API)
dokploy authenticate --url=https://dev.significa.sk --token=<TOKEN>

# Push .env súboru do Dokploy (uloží do Dokploy DB, prežije redeploy)
dokploy env push .env.production

# Pull aktuálnych env premenných z Dokploy
dokploy env pull .env.current
```

**Toto je správne riešenie** — `dokploy env push` uloží premenné do Dokploy databázy a každý redeploy ich použije. Nikdy sa nestratia.

CLI sa dá nainštalovať aj lokálne (Windows):
```bash
npm install -g @dokploy/cli
```

---

## Krok 3: Audit aktuálneho deploy skillu a praxe

### Aktuálny stav (fakty)

**Serverový `.env`** (`/etc/dokploy/compose/compose-parse-online-port-wdunfq/code/.env`):
- Obsahuje iba 9 premenných (compose-generované defaults)
- Chýba 109 premenných vrátane: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, všetky CRON_HEARTBEAT_*, Stripe, Telnyx, AI kľúče
- Súbor bol prepísaný deploy webhookom (Sep 23 00:41)
- Súbor **NIE je git-tracked** — Dokploy ho generuje z vlastnej DB pri každom deployi

**Dokploy parametre**:
- Compose App ID: `pvdhIxlCIhYTKvnmrZ8Mk`
- App name na disku: `compose-parse-online-port-wdunfq`
- Deploy webhook: `https://dev.significa.sk/api/deploy/compose/KCp595z_p95jTHcBzoHyQ`
- Dokploy panel: `https://dev.significa.sk`

**Aktuálny `deploy.ps1`**:
1. git status check
2. i18n symmetry check
3. TypeScript type-check
4. `git push origin main`
5. POST na Dokploy webhook

**Žiadny krok** neriadi env premenné — ani neoverí či sú na serveri kompletné, ani ich nepushne.

### Auditné otázky

Na základe naštudovanej dokumentácie zodpovedz:
1. Čo presne Dokploy urobí so súborom `.env` pri deploy webhookU?
2. Ako `dokploy env push` ukladá premenné — do ktorej DB tabuľky, akým formátom?
3. Ako funguje `dokploy env push/pull` z hľadiska autentifikácie (kde je config súbor)?
4. Podporuje Dokploy CLI aj lokálne spustenie (nie len zo servera)?
5. Existuje REST API volanie ekvivalentné k `dokploy env push`?

---

## Krok 4: Výstup auditu

### A. Root Cause Analysis
Prečo sa env premenné strácajú — presný mechanizmus.

### B. Okamžitá oprava
Konkrétne príkazy na obnovenie chýbajúcich env premenných na staging cez `dokploy env push` alebo REST API. Vrátane toho, kde získať API token.

### C. Audit `deploy.ps1` a `SKILL.md`
Čo chýba, čo je zlé — konkrétne riadky a opravy.

### D. Nový deploy workflow

Navrhni aktualizovaný `deploy.ps1` a `SKILL.md` ktorý:

1. **Pred deployom overí** či sú v Dokploy uložené všetky potrebné env premenné (volá Dokploy API alebo CLI)
2. **Používa `dokploy env push`** ako jediný správny spôsob aktualizácie env premenných
3. **Dokumentuje kde sú "ground truth" secrety** — navrhni kde lokálne uložiť production env (napr. `.env.production.local` v gitignore) a ako ho syncovať s Dokploy
4. **Nikdy nestratí env premenné** pri redeploy
5. **Jasný návod** pre pridanie novej env premennej: (a) pridaj do lokálneho `.env.production.local`, (b) spusti `dokploy env push`, (c) commitni/deployni

### E. Kde je Dokploy API token

Vysvetli presne:
- Kde sa token vytvára (URL v Dokploy UI)
- Kde ho uložiť lokálne (`.env` premenná `DOKPLOY_TOKEN`)
- Ako ho použiť v CLI: `dokploy authenticate --url=https://dev.significa.sk --token=$DOKPLOY_TOKEN`
- Ako ho použiť v REST API: `Authorization: Bearer $DOKPLOY_TOKEN` header

---

## Poznámky

- Server: `root@dev.significa.sk`
- Dokploy panel: `https://dev.significa.sk`
- Dokploy CLI na serveri: `/usr/local/bin/dokploy` (v0.2.8)
- Lokálna inštalácia CLI: `npm install -g @dokploy/cli`
- Priorita: zachovanie env premenných cez správny Dokploy workflow, nie hacky
