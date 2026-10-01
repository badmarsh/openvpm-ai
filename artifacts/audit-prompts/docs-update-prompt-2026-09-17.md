# OpenVPM AI — Úloha: Aktualizácia lokálnej a Outline dokumentácie (17. 9. 2026)

> **Použitie:** Skopírujte tento prompt do novej session agenta, ktorý má prístup k repozitáru `openvpm-ai` a voliteľne k Outline MCP serveru (`outline.dev.significa.sk`), prípadne ho použite ako presný podklad pre synchronizáciu.

---

Si hlavný technický a medicínsky dokumentačný architekt pre projekt **OpenVPM AI** (veterinárny informačný systém pre slovenské kliniky).

## TVOJA ÚLOHA (MISSION)
Zosynchronizuj a aktualizuj lokálnu dokumentáciu v repozitári (`docs/wiki/` a súvisiace príručky) a online znalostnú bázu v **Outline** (`outline.dev.significa.sk`) o všetky kľúčové novinky, zmeny v architektúre a infraštruktúre implementované **17. septembra 2026**.

Všetky informácie musia striktne vychádzať z kódu a commitov v repozitári — nevymýšľaj žiadne nepodložené fakty.

---

## 1. ZDROJOVÝ KONTEXT V REPOZITÁRI (GROUND TRUTH)

Dnešné commity na vetve `main` (študuj cez `git show <hash>`):
1. **`92dfc516` & `5092a1c9` & `52ca086b`:** Dokploy deployment runbook, webhook v `.env`, troubleshooting postup pre RLS a šifrovanie.
2. **`b0ebe8d2`:** Ochranné spracovanie chýb dešifrovania API kľúčov (`ai-settings.ts`, `ai-config-resolver.ts`).
3. **`e4567502`:** Clinical Guardian (bezpečnostný dohľad nad záznamami a preskripciou), Deep Thinking Concilium (viacmodelové AI konzílium), reorganizácia navigácie automatizácií.
4. **`1534f905`:** Automatizácia RLS inicializácie (`pnpm db:setup`), odolný bootstrap databázy a docker-compose konfigurácia pre produkciu aj lokál.
5. **`452e2d11` & `7415cad9` & `057c05a1` & `2fb778e5`:** AI nastavenia v administrácii (`/admin/settings/ai`), `ModelPicker` combobox, vyhľadávanie modelov z providerov, veterinárne mapovanie na Gemini 3.8 a Alibaba Wan 3.0.
6. **`a3b91a4a` & `e7d6262b`:** P0/P1 automatizácie, segmentácia pacientov podľa životného cyklu (kitten/puppy, senior, chronik), zapojenie cron heartbeatov a frontu správ, Telnyx KEY01 kľúče.
7. **Produkčné nasadenie na `dev.significa.sk`:** Úspešná migrácia plnej databázy MVDr. Martina Sýkoru (2 185 klientov, 2 952 pacientov, 6 664 SOAP záznamov, 50 MB RTG snímok v MinIO) s aktívnymi PostgreSQL RLS politikami.

---

## 2. CIEĽOVÉ DOKUMENTY A POŽADOVANÉ ÚPRAVY

### Oblasť A: Administrátorské nastavenia a konfigurácia AI
- **Lokálne súbory:**
  - `docs/wiki/01-pouzivatelska-prirucka/10. Administrátorské nastavenia kliniky.md`
  - `docs/wiki/03-klinicka-ai-a-datova-bezpecnost/11. Konfigurácia AI agenta a modelov (OpenVPM AI).md`
- **Outline dokumenty:** Príslušné kapitoly v kolekciách *Používateľská príručka* a *Klinická AI & Dátová bezpečnosť*.
- **Čo doplniť:**
  - Nová podsekcia **AI Nastavenia (`/admin/settings/ai`)**: konfigurácia providerov (Google Vertex AI, OpenRouter, Alibaba Cloud, vlastné OpenAI-kompatibilné proxy).
  - Používateľské rozhranie `ModelPicker` s dynamickým vyhľadávaním a filtrovaním modelov.
  - Špecializované mapovanie modelov pre veterinárne úlohy:
    - **Gemini 3.8 Flash:** štruktúrovaná SOAP analýza, detekcia liekových interakcií a sumarizácia karty.
    - **Alibaba Wan 3.0:** medicínske vizualizácie a analýza obrazových dát.
  - Bezpečnosť kľúčov: šifrovanie v PostgreSQL cez AES-256-GCM a automatické ošetrenie pri rotácii alebo nesúlade tajomstiev (stránka nikdy nespadne).

### Oblasť B: Clinical Guardian & Hĺbkové AI Konzílium (Deep Thinking)
- **Lokálne súbory:**
  - `docs/wiki/03-klinicka-ai-a-datova-bezpecnost/1. Bezpečnostné hranice a limity AI.md`
  - `docs/wiki/01-pouzivatelska-prirucka/14. Prirodzená komunikácia s AI asistentom.md`
- **Outline dokumenty:** Kapitoly o klinickej bezpečnosti a AI asistentovi.
- **Čo doplniť:**
  - **Clinical Guardian:** automatický bezpečnostný modul sledujúci rizikové kombinácie liečiv, nesprávne dávkovanie vzhľadom na hmotnosť/druh pacienta a zákonné obmedzenia OPL.
  - **Deep Thinking Concilium:** režim viacmodelového konzília pre komplikované medicínske prípady (diferenciálna diagnostika, interpretácia protichodných laboratórnych výsledkov).
  - Dôraz na slovenskú legislatívu (Zákon č. 39/2007 Z. z. §3 — lekár ako konečný schvaľovateľ).

### Oblasť C: Marketingové Štúdio, Pripomienky a Životný cyklus pacienta
- **Lokálne súbory:**
  - `docs/wiki/01-pouzivatelska-prirucka/8. Marketingové Štúdio a pripomienky.md`
- **Outline dokumenty:** Kapitola *Marketingové Štúdio a pripomienky*.
- **Čo doplniť:**
  - Segmentácia podľa životného cyklu zvieraťa: cielené preventívne kampane pre juniorov (vakcinačné schémy šteniat/mačiatok), dospelé zvieratá, geriatrických pacientov a chronikov.
  - Infraštruktúra rozosielania: spracovanie odchádzajúcej fronty správ cez asynchrónne cron heartbeaty, podpora moderných Telnyx API kľúčov (`KEY01`).
  - Prísne rešpektovanie Sympathy Gate a Quiet Hours.

### Oblasť D: Dokploy Deployment & Serverová Infraštruktúra (`dev.significa.sk`)
- **Lokálne súbory:**
  - `docs/wiki/04-prevadzka-pilot-a-podpora/6. Riešenie výpadkov a Disaster Recovery (SLA, RPO-RTO).md` (alebo vytvorenie nového dedikovaného dokumentu `docs/wiki/04-prevadzka-pilot-a-podpora/Dokploy Deployment a Serverovy Runbook.md`).
  - `docs/wiki/03-klinicka-ai-a-datova-bezpecnost/4. Multitenant izolácia (PostgreSQL Row-Level Security).md`.
- **Outline dokumenty:** Kolekcia *Prevádzka, Pilot a Podpora*.
- **Čo doplniť:**
  - **Architektúra nasadenia:** Dokploy na `dev.significa.sk`, automatický build z GitHub `origin/main` cez zabezpečený webhook (`DOKPLOY_DEPLOY_WEBHOOK_URL`).
  - **PowerShell deploy skript:** `deploy.ps1` s automatickou kontrolou gitu, i18n symetrie a type-checku.
  - **Databázový setup & RLS automatizácia:** príkaz `pnpm db:setup` spájajúci `db:bootstrap`, `db:rls` a `db:seed:sk`.
  - **Troubleshooting Runbook:**
    - Riešenie schema driftu a chýbajúcich RLS politík pomocou `packages/db/rls/enable-rls.sql`.
    - Riešenie dešifrovania kľúčov pri nesúlade `NEXTAUTH_SECRET` po obnove databázy.
    - Núdzový manuálny build cez SSH pri výpadku webhooku.
  - **Stav pilotnej databázy:** Reálne overené dáta kliniky MVDr. Sýkoru (2 185 klientov, 2 952 pacientov, 6 664 SOAP, 50 MB MinIO).

---

## 3. FORMÁTOVACIE A ŠTÝLOVÉ PRAVIDLÁ

1. **Pravidlo Outline nadpisov:** Telo dokumentov v Outline NESMIE začínať H1 nadpisom (`# ...`), pretože názov dokumentu tvorí samostatné pole v Outline. Telo začínaj priamo perexom alebo H2 (`##`).
2. **Lokálne Markdown súbory:** V `docs/wiki/*.md` dodržiavaj štandardné formátovanie s H1 názvom na začiatku, aby boli súbory plne čitateľné na GitHube.
3. **Terminológia:** Dôsledne používaj prirodzenú slovenskú veterinárnu terminológiu bez anglicizmov (napr. *anamnéza*, *receptúrny formulár*, *ochranná lehota*, *knihy ošetrení*, *fiškálny modul*).
4. **Informačné bloky (Callouts):**
   - `> [!NOTE]` — Praktické rady pre kliniku.
   - `> [!IMPORTANT]` — Legislatívne podmienky a zákonné lehoty.
   - `> [!WARNING]` — Bezpečnostné upozornenia a zaobchádzanie s tajomstvami/kľúčmi.

---

## 4. POSTUP REALIZÁCIE A VÝSTUP

1. **Analýza:** Prečítaj dotknuté lokálne markdown súbory v `docs/wiki/`.
2. **Lokálna aktualizácia:** Zapracuj zmeny priamo do súborov v `docs/wiki/`.
3. **Outline synchronizácia:**
   - Ak je k dispozícii Outline MCP server, vyhľadaj dokumenty cez `outline` nástroje a aplikuj zmeny do príslušných kolekcií.
   - Ak MCP server nie je dostupný, priprav jasný štruktúrovaný text pripravený na vloženie do Outline UI.
4. **Záverečný report:** Poskytni používateľovi prehľadný zoznam všetkých upravených súborov s krátkym zhrnutím zmien v každom z nich.
