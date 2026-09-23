# OpenVPM AI — Sklad, Dodávatelia & Import PDF Faktúr (Modul 2)

> **Zadanie pre Arena Agenta:** Tento task rieši kompletný cyklus lekárenského skladu, správy dodávateľov, automatizovaného importu dodacích listov a faktúr (PDF/CSV) od slovenských distribútorov (Cymedica, Pharmos, Samohýl, Biopharm, Henry Schein atď.), párovanie produktov, výpočet marží, sledovanie šarží/expirácií a prísne dodržiavanie zákona o omamných látkach (Zákon 139/1998 Z. z.).

---

## 0. Architektonické a bezpečnostné mantinely (NEPORUŠITEĽNÉ)

1. **Vanilla DB Schema Immutability:** Nikdy nemodifikuj vanilla súbory v `packages/db/schema/*.ts` (produkty, suppliers). Všetky prípadné rozšírenia výhradne v `ext_*.ts`.
2. **Controlled Substances Gate (Zákon 139/1998 Z. z.):**
   - Pri importe z dodacieho listu sa omamné a psychotropné látky (opiáty, ketamín, propofol, fentanyl, butorfanol) nesmú ticho preklopiť do voľného skladu.
   - Musia byť označené príznakom kontrolovanej látky a vyžadovať manuálne potvrdenie zodpovedným veterinárom.
3. **i18n Symetria:** 100% zhodnosť kľúčov medzi `apps/web/messages/en.json` a `sk.json`. Používaj výhradne vnorený JSON (nested keys) a hook `useI18n()`. Žiadny hardcoded text v JSX.
4. **Databáza pri testoch:** V lokálnom prostredí vždy výhradne `-d openvpm_ai` (port 5434), nikdy `-d openpims`.

---

## 1. GUI & UI Craft: Optimalizácia Skladu (`/inventory`)

### Súčasný stav
- Stránka `apps/web/app/(dashboard)/inventory/page.tsx` má tabuľku produktov a dodávateľov.
- Tabuľka trpí nejednotným vertikálnym paddingom, chýbajúcimi `tabular-nums` na číselných hodnotách (množstvo na sklade, nákupná cena, predajná cena, DPH) a absenciou rýchlych filtrov na expirované šarže.

### Požiadavky na úpravu:
1. **Zarovnanie na štandard `ui-craft-dense-dashboard`:**
   - Tabuľka produktov: kompaktné bunky (`py-2.5 px-3`), hlavička `<th className="h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">`.
   - Všetky ceny a skladové zásoby musia mať triedu `tabular-nums`.
   - Vizuálne zvýraznenie kritického stavu skladu:
     - Nulový alebo nízky stav (pod `minStockLevel`): červený / jantárový badge.
     - Blížiaca sa exspirácia šarže (< 30 dní): varovný indikátor.
2. **Kompaktný filter bar:**
   - Rýchle vyhľadávanie (názov, SKU, čiarový kód, účinná látka).
   - Filter podľa kategórie (Liečivá, Spotrebný materiál, Krmivá, Vakcíny).
   - Filter podľa dodávateľa.
   - Prepínač „Len položky pod minimálnym stavom“.

---

## 2. Import Dodacích Listov & PDF Faktúr (Wholesaler Import)

### Súčasný stav:
- `apps/web/components/inventory/wholesaler-import-dialog.tsx`
- `apps/web/lib/inventory/pdf-invoice-parser.ts`
- `apps/web/server/routers/extensions/wholesaler-import.ts`
Podporuje PDF text extraction cez `pdfjs-dist`, AI parsing s fallbackom na regulárne pravidlá pre Cymedica, Pharmos, Samohýl, Henry Schein, Biopharm a generic CSV.

### Požiadavky na vylepšenie a stabilitu:
1. **Robustnosť PDF Text Extraction:**
   - Over, že import `pdfjs-dist/legacy/build/pdf.mjs` funguje stabilne v Next.js serverovom prostredí bez memory leaku.
   - Ošetri poškodené alebo heslom chránené PDF súbory zmysluplnou chybovou hláškou pre používateľa v slovenskom jazyku.
2. **Párovanie položiek (Matching Engine):**
   - Vylepši automatické párovanie položiek z faktúry s existujúcimi produktmi v sklade:
     - 1. Priorita: zhoda podľa kódu dodávateľa / SKU / čiarového kódu.
     - 2. Priorita: normalizovaná textová zhoda názvu produktu.
   - Pri nepárovaných položkách zreteľné tlačidlá: *„Vytvoriť nový produkt“* vs. *„Spárovať s existujúcim produktom“* vs. *„Preskočiť“*.
3. **Správa marží a predajných cien:**
   - Pri importe umožni lekárovi hromadne aplikovať predvolenú maržu (napr. +30% na lieky, +50% na materiál) s okamžitým prepočtom predajnej ceny s DPH.
   - Rešpektuj slovenské sadzby DPH (základná, znížená).

---

## 3. Bezpečnosť a Zákonné Registre (Omamné Látky)

1. **Detekcia kontrolovaných substancií:**
   - Funkcia `isControlledSubstanceName()` musí zachytiť každú dovážanú položku obsahujúcu omamné látky (Ketamín, Diazepam, Butorfanol, Morfín, Fentanyl, Propofol).
2. **Klinická bezpečnostná závora:**
   - Takéto položky nesmú byť ticho zaradené do bežného skladu. V dialógu importu musia byť viditeľne označené fialovým/červeným badgeom *„Zákon 139/1998 Z. z. – Omamná látka“*.
   - Po importe musí vzniknúť záznam pripravený na zápis do knihy omamných látok (`/controlled-substances`).

---

## 4. Preklady & i18n

1. Skontroluj všetky texty v:
   - `apps/web/app/(dashboard)/inventory/page.tsx`
   - `apps/web/components/inventory/wholesaler-import-dialog.tsx`
   - `apps/web/components/inventory/markup-input.tsx`
2. Všetky anglické a hardcoded reťazce nahraď volaním `useI18n()` a doplň ich do `apps/web/messages/en.json` a `sk.json` v identickej štruktúre.
3. Overenie:
   ```bash
   pnpm --filter @openpims/web exec vitest run server/__tests__/i18n-structure.test.ts
   ```

---

## 5. Testy, Verifikácia & PR

1. **Unit & Integračné testy:**
   - Napíš test pre parser dodacích listov s ukážkovým textom dodacieho listu:
     `apps/web/lib/inventory/__tests__/pdf-invoice-parser.test.ts`
   - Otestuj blokovanie a označenie omamných látok pri importe.
2. **Kontrola kvality kódu:**
   ```bash
   pnpm lint
   pnpm --filter @openpims/web type-check
   pnpm --filter @openpims/web test -- run pdf-invoice-parser.test.ts
   ```
3. **Git & PR:**
   - Vytvor vetvu `swarm/inventory-wholesaler-import`.
   - Commit: `feat(inventory): dense table UI, robust PDF wholesaler import, controlled substance detection`.
   - Otvor Pull Request do `main`.
