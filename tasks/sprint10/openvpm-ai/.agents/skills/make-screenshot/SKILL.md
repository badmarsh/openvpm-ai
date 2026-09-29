---
name: make-screenshot
description: End-to-end automated documentation screenshot pipeline for OpenVPM AI and Outline Wiki. Generates clean 1920x1080 Light Mode screenshots for pilot user MVDr. Martin Sýkora (Administrátor), seeds realistic clinic demo data, resets rate limits, runs high-speed production Playwright capture, uploads attachments to Outline Wiki, and updates user guide chapters without emoji duplication.
---

# Make Screenshot Skill — OpenVPM AI & Outline Wiki Automation

Tento skill riadi kompletný a opakovateľný proces generovania dokumentačných screenshotov pre používateľskú príručku systému **OpenVPM AI** a ich automatickú synchronizáciu do **Outline Wiki**.

---

## 1. Kedy sa tento skill aktivuje
Aktivuje sa vždy, keď používateľ zadá pokyn na generovanie, aktualizáciu alebo pregenerovanie screenshotov, napríklad:
- `vytvor screenshoty` / `sprav screenshoty` / `make screenshots`
- `pregeneruj screenshot <nazov>` / `re-do screenshot`
- `aktualizuj screenshoty v outline` / `nahraj screenshoty do wiki`
- `spusť screenshot pipeline`

---

## 2. Vizuálne a dizajnové štandardy (Brand Guidelines)

Každý screenshot MUSÍ spĺňať nasledujúce striktné parametre:

| Parameter | Hodnota | Poznámka |
|-----------|---------|----------|
| **Rozlíšenie** | **1920 × 1080 (Full HD)** | Pomer strán 16:9, `deviceScaleFactor: 1` |
| **Téma (GUI Mode)** | **Svetlý režim (Light Mode)** | `openvpm_gui_mode="light"`, `theme="light"`, `colorScheme="light"` |
| **Identita používateľa** | **MVDr. Martin Sýkora** | `martin.sykora@vetsykora.sk` (Heslo: `password123`) |
| **Rola v systéme** | **Administrátor (`admin`)** | Zobrazuje kompletné menu vrátane OPL, e-Kasy a Nastavení |
| **Prax (Practice ID)** | `5c4ebbbc-90e1-457a-87a7-7895f560317d` | Súkromná veterinárna klinika MVDr. Martin Sýkora |
| **Kľúčový pacient** | **Pupinka** (`5821edf5-e13d-4085-85c4-be6b95b29c34`) | Pacient s reálnymi SOAP záznamami, očkovaniami a anamnézou |
| **Kľúčový klient** | **Margaréta Keľová** (`31b42847-ed4b-4fd5-970b-fbc4b489fe3f`) | Majiteľka mačky Pupinka |
| **Čistota rozhrania** | **Bez demo bannerov a popupov** | Vypnutý konverzný banner, prijaté cookies |

> ⚠️ **Dôležité — Zákaz Demo módu a nastavenie témy:**
> 1. **Demo mód:** V `apps/web/.env` MUSÍ byť `NEXT_PUBLIC_DEMO_MODE=false`. Prihlasovacia obrazovka musí zobrazovať štandardný formulár s poliami Email, Heslo a tlačidlom *„Prihlásiť sa“* (nie demo box *„Otvoriť živé demo“*).
> 2. **Predvolený Light Mode v kóde:** V `apps/web/lib/theme/theme-context.tsx` MUSÍ byť `useState<ThemeMode>("light")` (nie `"dark"`), inak sa pri prvom načítaní aplikujú do `root.style` tmavé CSS premenné (`--background: 0 0% 7.1%`).
> 3. **Skúšobný pruh:** Komponent `apps/web/components/demo/demo-conversion-bar.tsx` musí vracať `return null;`.

---

## 3. Katalóg všetkých 29 screenshotov a presný recept pre každý z nich

Všetky výstupné súbory sa ukladajú do `docs/screenshots/wiki/`:

### Kapitola 1: Začíname s OpenVPM AI
1. **`01-01-prihlasenie.png`**
   - **Trasa:** `/login` (odhlásený stav)
   - **Recept:** Nastaviť Light Mode v localStorage pred navigáciou. Podať `GET /login`. Odkliknúť cookie banner. Zobraziť čistý biely formulár *„Prihláste sa do svojej ambulancie“* s poľami Email, Heslo a tlačidlom *„Prihlásiť sa“*.
2. **`01-02-denny-harmonogram.png`**
   - **Trasa:** `/schedule` (prihlásený Dr. Sýkora)
   - **Recept:** Pohľad na aktuálny deň, kde sú zobrazení pacienti priradení Dr. Sýkorovi (nasadení cez `seed-today-whiteboard.js`).
3. **`01-03-rychle-vyhladavanie-cmd-k.png`**
   - **Trasa:** `/schedule`
   - **Recept:** Prepnúť rozvrh na pohľad **Týždeň** (klik na tlačidlo *„Týždeň“*). Otvoriť vyhľadávací dialóg kliknutím na lupu v TopBare (`button[aria-label="Open search"]`) alebo stlačením `Control+k` (**pozor: malé 'k', nie veľké 'K'!**). Do vyhľadávacieho poľa napísať `Pupinka`. Počkať 1.5s na načítanie výsledku `🐱 Pupinka, európska domáca, Owner: Margaréta Keľová`.
4. **`01-04-whiteboard-ambulancie.png`**
   - **Trasa:** `/whiteboard`
   - **Recept:** Zobrazuje hospitalizačnú a ordinačnú tabuľu s pacientmi v stavoch Čakáreň, Vyšetrenie a Hospitalizácia.
5. **`01-05-cakaren-ambulancie.png`**
   - **Trasa:** `/waiting-room`
   - **Recept:** Obrazovka čakárne s príchodmi pacientov.
6. **`01-06-inbox-notifikacie.png`**
   - **Trasa:** `/inbox`
   - **Recept:** Prehľad internej komunikácie, systémových upozornení a správ od klientov.

### Kapitola 2: Kartotéka a zdravotné záznamy
7. **`02-01-zoznam-pacientov.png`**
   - **Trasa:** `/patients`
   - **Recept:** Kartotéka zvierat s filtrami druhov, stavom a vyhľadávaním.
8. **`02-02-profil-pacienta.png`**
   - **Trasa:** `/patients/5821edf5-e13d-4085-85c4-be6b95b29c34`
   - **Recept:** Karta mačky Pupinka (identifikácia, čip, anamnéza, majiteľka Margaréta Keľová).
9. **`02-03-soap-klinicky-zaznam.png`**
   - **Trasa:** `/records`
   - **Recept:** Do vyhľadávača pacientov zadať `Pupinka`, kliknúť na nájdeného pacienta v dropdown zozname, čím sa načíta a otvorí štruktúrovaný SOAP záznam (Subjektívne, Objektívne, Posúdenie, Plán).
10. **`02-04-ockovania-preukaz.png`**
    - **Trasa:** `/care-reminders`
    - **Recept:** Prehľad plánovaných očkovaní a preventívnych úkonov.
11. **`02-05-profil-klienta.png`**
    - **Trasa:** `/clients/31b42847-ed4b-4fd5-970b-fbc4b489fe3f`
    - **Recept:** Profil majiteľky Margaréty Keľovej so zoznamom zvierat a kontaktnými údajmi.

### Kapitola 3: Fakturácia a e-Kasa
12. **`03-01-vystavenie-uctu.png`**
    - **Trasa:** `/billing`
    - **Recept:** Prehľad vystavených faktúr, účtov a tržieb ambulancie.
13. **`03-02-ekasa-prehlad.png`**
    - **Trasa:** `/billing/ekasa`
    - **Recept:** Stav fiškálnej tlačiarne e-Kasa, zoznam bločkov a denná uzávierka.

### Kapitola 4: Sklad a lekáreň
14. **`04-01-skladove-zasoby.png`**
    - **Trasa:** `/inventory`
    - **Recept:** Prehľad liečiv, šarží, expirácií a nákupných/predajných cien.
15. **`04-02-kniha-opl-narkotika.png`**
    - **Trasa:** `/controlled-substances`
    - **Recept:** Zákonná evidencia omamných a psychotropných látok (ketamín, butorfanol atď.).

### Kapitola 5: Legislatíva a štátne hlásenia
16. **`05-01-statne-registre-prehlad.png`**
    - **Trasa:** `/statutory`
    - **Recept:** Modul hlásení do štátnych registrov (KVEPIS, CRSZ, CEHZ).
17. **`05-02-kniha-besnoty.png`**
    - **Trasa:** `/statutory`
    - **Recept:** Kniha vyšetrení na besnotu (3-dňová a 14-dňová zákonná lehota).

### Kapitola 6: Laboratórium a diagnostika
18. **`06-01-laboratorne-vysledky.png`**
    - **Trasa:** `/lab-results`
    - **Recept:** Prehľad laboratórnych vyšetrení (hematológia, biochémia, sono nálezy).

### Kapitola 7: Tvorba webu kliniky
19. **`07-01-website-editor.png`**
    - **Trasa:** `/marketing/website`
    - **Recept:** Vizuálny editor webovej stránky ambulancie.

### Kapitola 8: Marketingové Štúdio
20. **`08-01-marketingove-kampane.png`**
    - **Trasa:** `/marketing`
    - **Recept:** Marketingové kampane, automatické SMS pripomienky a recenzie.

### Kapitola 9: Klientsky portál (PWA)
21. **`09-01-klientsky-portal-prehlad.png`**
    - **Trasa:** `/portal`
    - **Recept:** Cez zabezpečený odkaz `/portal/access/test-portal-token-sykora` (pripravený cez `setup-portal-token.js`). Prehľad zvierat prihláseného majiteľa.
22. **`09-02-klientsky-portal-profil.png`**
    - **Trasa:** `/portal/pets/5821edf5-e13d-4085-85c4-be6b95b29c34`
    - **Recept:** Profil mačky Pupinka v klientskom portáli. Záložka **Vaccinations (3)** obsahuje reálne demo očkovania (Nobivac Tricat Trio, Nobivac Rabies, Purevax FeLV) so stavom *„Up to date“* a tlačidlami na stiahnutie certifikátu (nasadené cez `seed-pupinka-vaccinations.js`).
23. **`09-03-klientsky-portal-objednavanie.png`**
    - **Trasa:** `/portal/book`
    - **Recept:** Obrazovka online rezervácie termínu s výberom zvieratka, lekára a času.

### Kapitola 10: Administrátorské nastavenia
24. **`10-01-sprava-personalu-roly.png`**
    - **Trasa:** `/settings`
    - **Recept:** Konfigurácia ambulancie, správa používateľov, oprávnenia a personál.

### Kapitola 11: Finančné reporty
25. **`11-01-financny-dashboard.png`**
    - **Trasa:** `/reports`
    - **Recept:** Grafy tržieb, priemerný účet, analýza návštevnosti a výkon lekárov.

### Kapitola 12: Wellness plány
26. **`12-01-wellness-plany-prehlad.png`**
    - **Trasa:** `/marketing/wellness`
    - **Recept:** Balíčky preventívnej starostlivosti a predplatné plány pre pacientov.

### Kapitola 13: Správa dát a zálohy
27. **`13-01-sprava-dat-exporty.png`**
    - **Trasa:** `/settings?tab=data`
    - **Recept:** Exporty do Excel/CSV, zálohovanie a GDPR výmazy.

### Kapitola 14: AI Asistent
28. **`14-01-ai-sidebar-konzultacia.png`**
    - **Trasa:** `/agent`
    - **Recept:** Interaktívny čet s klinickým AI asistentom.

### Kapitola 15: iCal / Webcal integrácia
29. **`15-01-ical-subscribe-dialog.png`**
    - **Trasa:** `/schedule`
    - **Recept:** Klik na tlačidlo kalendára s popiskom *„Odoberať kalendár“* / *„Subscribe“*, čím sa otvorí modálne okno s webcal URL odkazom a QR kódom pre Apple Calendar / Google Calendar.

---

## 4. Runbook: Spustenie od nuly na prvú šupu

```bash
# 1. Kontrola Postgres (port 5434)
# 2. Build produkčného webu
pnpm --filter @openpims/web build

# 3. Spustenie produkčného servera (daemon)
pnpm --filter @openpims/web start -p 3001

# 4. Príprava a seeding dát
node scripts/clear-rate-limits.js
node scripts/seed-today-whiteboard.js
node scripts/setup-portal-token.js
node scripts/seed-pupinka-vaccinations.js

# 5. Zachytenie screenshotov
npx playwright test e2e/capture-wiki-screenshots.spec.ts --project=chromium
npx playwright test e2e/capture-additional-screenshots.spec.ts --project=chromium

# 6. Upload a synchronizácia s Outline Wiki
node scripts/upload_and_sync_all_screenshots.js
```

---

## 5. Pravidlá Outline Wiki (Odsúhlasené štandardy)

1. **Žiadne GitHub alerty:** Outline nepodporuje `> [!NOTE]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!TIP]`, `> [!CAUTION]`. Vždy používať emoji blockquotes:
   - `> 📝 **Poznámka:**`
   - `> ⚠️ **Dôležité:**`
   - `> 💡 **Tip:**`
   - `> 🚨 **Pozor:**`
   Pre automatický prevod markdown súborov a synchronizáciu s Outline slúži skript `node scripts/convert-alerts.js` (`--wiki`, `--sync-outline`, `--all`).
2. **Žiadne dvojité emoji v názvoch:** V `documents.update` odstraňovať úvodné emoji z `title`, pretože Outline ich dopĺňa z atribútu `icon`.
3. **Rate limiting pri uploade:** Outline API má limit ~25 requestov/minútu. Medzi jednotlivými uploadmi držať pauzu minimálne 1.5–2 sekundy a neuploadovať zbytočne súbory s rovnakou veľkosťou.
