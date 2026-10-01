# OpenVPM AI — Úloha: Aktualizácia a Synchronizácia Outline Dokumentácie

> **Použitie:** Skopírujte text nižšie do novej session agenta s prístupom k repozitáru `openvpm-ai` 
> a k Outline MCP serveru (`outline.dev.significa.sk`), prípadne použite ako podklad pre manuálnu 
> aktualizáciu Outline znalostnej bázy.

---

Si technický dokumentačný architekt pre projekt **OpenVPM AI** (veterinárny informačný systém 
pre slovenské kliniky).

## TVOJA ÚLOHA (MISSION)
Zosynchronizuj a aktualizuj znalostnú bázu v **Outline** (`outline.dev.significa.sk`) tak, 
aby presne odzrkadľovala produkčný stav verzie **v0.6-PILOT-READY** (k 14. 9. 2026). 

Informácie nesmieš vymýšľať — musíš čerpať z overených zdrojov priamo v repozitári.

---

## 1. ZDROJOVÉ SÚBORY V REPOZITÁRI (INPUTS)
Pred úpravami v Outline si povinne naštuduj tieto overené súbory:
1. `README.md` a `CHANGELOG.md` — verzia v0.6.0, reálny pilotný klient MVDr. Martin Sýkora (Rimavská Sobota).
2. `docs/help/sk/*.md` (10 súborov) — kompletná používateľská príručka v slovenčine:
   - `getting-started.md`, `billing-finance.md`, `statutory-compliance.md`, `admin-settings.md`,
   - `inventory-pharmacy.md`, `lab-imaging.md`, `reports.md`, `marketing.md`,
   - `website-builder.md` (NOVINKA: drag-and-drop editor webu, Brand Kit), `wellness.md`.
3. `docs/ai-evidence/MODEL_CARDS.md` — klinické bezpečnostné hranice AI, modely, Zero Data Retention.
4. `docs/production-readiness/` — `OFFLINE_AND_DISASTER_RECOVERY.md`, `OPERATIONS_RUNBOOK.md`, `GAP_ANALYSIS_POST_PILOT_READY.md`.
5. `docs/ekasa-certified-hardware-and-runbook.md` — e-Kasa postupy a certifikovaný hardvér.
6. `docs/security/row-level-security.md` — multitenant izolácia kliník.

---

## 2. CIEĽOVÁ ŠTRUKTÚRA KOLEKCIÍ V OUTLINE

Vytvor alebo zaktualizuj v Outline nasledujúce 4 hlavné kolekcie a ich podstránky:

### Kolekcia A: „Používateľská príručka (Návody pre ambulanciu)“
- **1. Začíname s OpenVPM AI:** Prihlásenie, roly personálu, denný prehľad (`/schedule`).
- **2. Kartotéka a zdravotné záznamy:** Vedenie karty pacienta, očkovania, anamnéza, váha.
- **3. Fakturácia a e-Kasa:** Vystavenie dokladu, úhrada kartou/hotovosťou, offline režim pri výpadku siete.
- **4. Sklad a lekáreň:** Príjem tovaru, výdaj liekov, Kniha omamných a psychotropných látok (OPL).
- **5. Legislatíva a štátne hlásenia:** Hlásenie besnoty (3-dňová lehota RVPS), ochranné lehoty, kafiléria.
- **6. Laboratórium a RTG/Sono:** Zadávanie výsledkov, multimodálna AI analýza snímok.
- **7. Tvorba webu kliniky (Website Builder):** Vizuálny editor, 17 sekčných šablón, nastavenie Brand Kitu, publikovanie zmien.
- **8. Marketingové Štúdio a pripomienky:** Automatické SMS/emaily o očkovaní, Sympathy Gate.
- **9. Klientsky portál (PWA):** Ako poslať link majiteľovi zvieraťa, online objednávky.

### Kolekcia B: „Slovenská legislatíva a integrácie“
- **e-Kasa integrácia (Zákon č. 289/2008 Z. z.):** Podporované fiškálne tlačiarne (FT4000/Varos), offline front, postup storna.
- **Štátne veterinárne registre:** KVEPIS (XML export a XSD validácia), CRSZ (čipy a PetPasy), CEHZ (hospodárske zvieratá).
- **Poistenie PetExpert:** Vytvorenie a export poistnej udalosti.

### Kolekcia C: „Klinická AI & Dátová bezpečnosť“
- **Bezpečnostné hranice AI:** Čo AI NIKDY nesmie robiť (žiadne autonómne recepty ani diagnózy).
- **Povinné potvrdenie lekárom:** Princíp jednorazových autorizačných tokenov.
- **Dátová suverenita & GDPR:** Zero Data Retention, žiadne trénovanie modelov na pacientoch, 24-hodinový výmaz audio nahrávok diktátu SOAP.
- **Multitenant izolácia:** PostgreSQL Row-Level Security (RLS) — garancia, že žiadna iná klinika neuvidí dáta iného lekára.

### Kolekcia D: „Prevádzka, Pilot a Podpora“
- **Pilotné nasadenie:** Súkromná veterinárna klinika MVDr. Martin Sýkora (Rimavská Sobota).
- **Riešenie výpadkov a Disaster Recovery:** Lokálny režim, obnova zo záloh (RTO < 30 min).
- **Podpora a eskalácia:** Zodpovedné osoby a kontakty pri technických problémoch.

---

## 3. PRAVIDLÁ PRE FORMÁT A ŠTÝL V OUTLINE
1. **Pravidlo nadpisov v Outline:** Telo dokumentu NESMIE začínať H1 nadpisom (`# Nadpis`) — názov dokumentu v Outline je samostatné pole. Telo začni priamo úvodným textom alebo H2 (`##`).
2. **Konzistentná slovenská terminológia:** Používaj presnú veterinárnu terminológiu (napr. *anamnéza*, *ochranná lehota*, *omamné a psychotropné látky*, *kniha besnoty*, *CHDU*).
3. **Žiadne fiktívne dáta:** Neuvádzaj MVDr. Sýkoru ako fiktívny demo prípad; je to prvý reálny pilotný klient.
4. **Praktické callouty:** Využívaj v texte dôležité upozornenia:
   - `> [!NOTE]` — Praktické tipy pre lekára a personál.
   - `> [!IMPORTANT]` — Legislatívne a zákonné lehoty (napr. 3 dni na nahlásenie besnoty).
   - `> [!WARNING]` — Upozornenia pre bezpečnosť e-Kasy a prácu s omamnými látkami.

---

## 4. VÝSTUPNÝ REPORT
Po dokončení synchronizácie vytvor report, v ktorom uvedieš:
- Zoznam vytvorených / aktualizovaných kolekcií a dokumentov v Outline.
- Identifikované nezrovnalosti, ak niektorá časť v Outline nezodpovedala stavu v repo.
- Odkazy na aktualizované dokumenty v Outline.
