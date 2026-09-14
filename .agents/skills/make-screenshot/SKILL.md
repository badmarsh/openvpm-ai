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
| **Kľúčový pacient** | **Pupinka** (`5821edf5-e13d-4085-85c4-be6b95b29c34`) | Pacient s reálnymi SOAP záznamami a anamnézou |
| **Čistota rozhrania** | **Bez demo bannerov a popupov** | Vypnutý konverzný banner, prijaté cookies |

> [!IMPORTANT]
> **Zákaz Demo módu na prihlasovacej obrazovke:** V `.env` musí byť `NEXT_PUBLIC_DEMO_MODE=false`. Prihlásenie musí obsahovať polia pre Email, Heslo a tlačidlo *„Prihlásiť sa“* (nie demo tlačidlo *„Otvoriť živé demo“*).
> **Potlačenie skúšobného pruhu:** Komponent `apps/web/components/demo/demo-conversion-bar.tsx` musí vracať `return null;` (žiadna výzva *„Páči sa vám tento workflow? Spustite si bezplatnú skúšobnú verziu...“*).

---

## 3. Katalóg 19 dokumentačných screenshotov

Výstupné súbory sa ukladajú do priečinka `docs/screenshots/wiki/`:

```
docs/screenshots/wiki/
├── 01-01-prihlasenie.png                 # /login (Štandardný formulár)
├── 01-02-denny-harmonogram.png           # /schedule (Pohľad na deň)
├── 01-03-rychle-vyhladavanie-cmd-k.png   # /schedule (Pohľad Týždeň + Ctrl+K dialóg "Pupinka")
├── 01-04-whiteboard-ambulancie.png       # /whiteboard (Ordinančná tabuľa s aktívnymi pacientmi)
├── 02-01-zoznam-pacientov.png            # /patients (Kartotéka zvierat)
├── 02-02-profil-pacienta.png             # /patients/5821edf5-e13d-4085-85c4-be6b95b29c34 (Pupinka)
├── 02-03-soap-klinicky-zaznam.png        # /records (Vyhľadaná a vybratá Pupinka + klinický záznam)
├── 02-04-ockovania-preukaz.png           # /care-reminders (Preventívna starostlivosť)
├── 03-01-vystavenie-uctu.png             # /billing (Položková faktúra a účet)
├── 03-02-ekasa-prehlad.png               # /billing/ekasa (Fiškálne doklady a stav pokladnice)
├── 04-01-skladove-zasoby.png             # /inventory (Skladové karty liekov, šarže, exspirácie)
├── 04-02-kniha-opl-narkotika.png         # /controlled-substances (Kniha omamných a psychotropných látok)
├── 05-01-statne-registre-prehlad.png     # /statutory (Hlásenia KVEPIS, CRSZ a CEHZ)
├── 06-01-laboratorne-vysledky.png        # /lab-results (Hematológia, biochémia, RTG)
├── 07-01-website-editor.png              # /marketing/website (Vizuálny editor webu kliniky)
├── 08-01-marketingove-kampane.png        # /marketing (Marketingové štúdio a kampane)
├── 10-01-sprava-personalu-roly.png       # /settings (Správa používateľov a rolí)
├── 11-01-financny-dashboard.png          # /reports (Finančný a prevádzkový dashboard)
└── 14-01-ai-sidebar-konzultacia.png      # /agent (Klinická konzultácia s AI asistentom)
```

---

## 4. Štandardný postup krok za krokom (Runbook)

### Krok 1: Spustenie produkčného webového servera (Vysoký výkon)
> [!CAUTION]
> **NIKDY nespúšťaj Playwright proti `pnpm dev`!** V Next.js App Routeri na Windows dev server dynamicky kompiluje každú trasu pri prvej požiadavke, čo spôsobuje 45-sekundové timeouty a neúplne vyrenderované stránky. Vždy použi **produkčný build**.

1. Skontroluj, či beží PostgreSQL kontajner (port `5434`, DB `openvpm_ai`).
2. Buildni projekt:
   ```bash
   pnpm --filter @openpims/web build
   ```
3. Spusti server na porte `3001`:
   ```bash
   pnpm --filter @openpims/web start -p 3001
   ```

### Krok 2: Príprava a reset dát v databáze
Pred spustením screenshotov vždy vyčisti rate-limity a naplň dnešný rozvrh čerstvými dátami:

```bash
# 1. Vyčistiť prihlasovacie rate limity v Postgres
node scripts/clear-rate-limits.js

# 2. Naplniť ordinačnú tabuľu dnešnými aktívnymi pacientmi (pre MVDr. Sýkoru)
node scripts/seed-today-whiteboard.js
```

### Krok 3: Zhotovenie screenshotov cez Playwright
- **Všetky screenshoty (Master suite):**
  ```bash
  npx playwright test e2e/capture-wiki-screenshots.spec.ts --project=chromium
  ```
- **Iba vybrané / cielené screenshoty (Targeted suite):**
  ```bash
  npx playwright test e2e/redo-four-screenshots.spec.ts --project=chromium
  ```

#### Kľúčové špecifiká v Playwright kóde:
- **Light Mode vynútenie:**
  ```typescript
  await page.addInitScript(() => {
    window.localStorage.setItem("openvpm_gui_mode", "light");
    window.localStorage.setItem("theme", "light");
    window.localStorage.setItem("openvpm.cookie-consent.v1", "essential");
    window.sessionStorage.setItem("ovpm_verify_email_dismissed", "1");
  });
  ```
- **Zobrazenie Týždňa v rozvrhu (01-03):** Kliknúť na tlačidlo `Týždeň`, následne stlačiť `Control+K` a napísať `Pupinka`.
- **Výber pacienta v Záznamoch (02-03):** Vyhľadať `Pupinka` a kliknúť na nájdeného pacienta v dropdown zozname pre zobrazenie SOAP formulára.

---

## 5. Synchronizácia s Outline Wiki

Na nahratie vytvorených PNG súborov do Outline a prepojenie s dokumentáciou slúži automatizačný skript:

```bash
node scripts/upload_and_sync_all_screenshots.js
```

### Ako synchronizácia funguje:
1. **Upload prílohy (`attachments.create`):** Skript požiada Outline o presigned token a odošle binárne dáta cez multipart POST na `https://outline.dev.significa.sk/api/files.create`.
2. **Generovanie redirect URL:** Každá príloha získa stabilnú adresu tvaru `https://outline.dev.significa.sk/api/attachments.redirect?id=<attachment-id>`.
3. **Uloženie mapy:** Vytvorí alebo aktualizuje `docs/screenshots/wiki/attachments_map.json`.
4. **Aktualizácia kapitol:** Prejde všetkých 15 kapitol v `docs/wiki/01-pouzivatelska-prirucka/*.md`, nahradí lokálne cesty `../../screenshots/wiki/<nazov>.png` skutočnými URL z Outline a aktualizuje dokument cez `documents.update`.

---

## 6. Pravidlo zamedzenia duplicity emoji (Strict Rule)

> [!WARNING]
> **Outline Wiki Icon vs. Document Title:**
> Outline priraďuje každému dokumentu samostatný atribút **`icon`** (napr. `icon: "🚀"`).
> V bočnom paneli Outline automaticky vykresľuje:
> `[icon] [title]`
> 
> **Pravidlo:** Názov dokumentu (`title`) **NESMIE** obsahovať počiatočné emoji!
> - ❌ NESPRÁVNE: `title: "🚀 1. Začíname s OpenVPM AI"` -> Outline zobrazí: `🚀 🚀 1. Začíname...` (dvojité emoji)
> - ✅ SPRÁVNE: `title: "1. Začíname s OpenVPM AI"`, `icon: "🚀"` -> Outline zobrazí: `🚀 1. Začíname...` (jediné čisté emoji)

Ak by sa kedykoľvek v budúcnosti objavili zdvojené emoji, spusť automatickú nápravu:
```bash
node scripts/fix_duplicate_emojis.js
```

---

## 7. Git Commit & Push kontrola

Po úspešnom zhotovení a synchronizácii over čistotu pracovného stromu a odošli zmeny do gitu:

```bash
git status
git add docs/screenshots/wiki/ e2e/ scripts/ docs/wiki/
git commit -m "feat(docs): update user guide screenshots in light mode and sync to outline wiki"
git push origin feat/webstranka-data-integration
```
